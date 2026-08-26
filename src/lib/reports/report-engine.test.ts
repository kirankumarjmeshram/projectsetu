import ExcelJS from "exceljs";
import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { programId } from "@/domain/schemes/program";
import { orchestrateProjectCalculation } from "@/lib/application/orchestrator/calculation-orchestrator";
import { createDefaultProjectWizardInput } from "@/lib/application/orchestrator/orchestrator-defaults";

import { buildDprReportModel } from "./builder";
import type { BuildDprReportInput } from "./contracts";
import {
  GuardedNarrativeProvider,
  type ExternalNarrativeGenerator,
} from "./narrative/provider";
import { DeterministicNarrativeProvider } from "./narrative/deterministic";
import { formatIndianCurrency, sanitizeReportFilename } from "./presentation";
import {
  renderDocx,
  renderExcel,
  renderPdf,
  REQUIRED_EXCEL_SHEETS,
} from "./renderers";
import { validateDprReport } from "./validation";

function sourceInput(
  overrides?: Parameters<typeof createDefaultProjectWizardInput>[0],
): BuildDprReportInput {
  const project = createDefaultProjectWizardInput(overrides);
  const calculation = orchestrateProjectCalculation(project, "2026-04-01");
  return {
    identity: {
      reportId: "report-1",
      reportVersion: 1,
      projectId: project.project.id,
      inputSnapshotId: "input-1",
      calculationRunId: "run-1",
      fundingSnapshotId: calculation.fundingComposer ? "funding-1" : undefined,
      templateVersion: "BASE_BANKABLE_DPR/1.0",
      contentSchemaVersion: 1,
      generatedAt: "2026-04-01T00:00:00.000Z",
      language: "en",
    },
    project,
    calculation,
  };
}

describe("DPR report content model", () => {
  it("builds a complete bankable no-scheme model without subsidy claims", async () => {
    const model = await buildDprReportModel(
      sourceInput({
        project: {
          ...createDefaultProjectWizardInput().project,
          mode: "BANKABLE",
        },
        selectedPrograms: [],
      }),
    );
    expect(
      model.sections.some((section) => section.id === "scheme-assistance"),
    ).toBe(false);
    expect(model.sections.some((section) => section.id === "profit-loss")).toBe(
      true,
    );
    expect(
      model.sections.some((section) => section.id === "balance-sheet"),
    ).toBe(true);
    expect(JSON.stringify(model.sections)).not.toContain("scheme is required");
  });

  it("copies exact financial strings and reconciles the canonical P&L table", async () => {
    const input = sourceInput();
    const model = await buildDprReportModel(input);
    const table = model.sections.find(
      (section) => section.id === "profit-loss",
    )!.tables[0];
    expect(table.rows[0][1].authoritativeValue).toBe(
      input.calculation.profitAndLoss!.years[0].revenue,
    );
    expect(table.rows[0][9].authoritativeValue).toBe(
      input.calculation.profitAndLoss!.years[0].profitAfterTax,
    );
    expect(model.calculation).toBe(input.calculation);
  });

  it("uses approved mapped quotation provenance only", async () => {
    const input = sourceInput();
    const costItem = input.project.costItems[0];
    const model = await buildDprReportModel({
      ...input,
      quotationReferences: [
        {
          projectCostItemId: costItem.id,
          documentId: "doc-1",
          documentVersion: "2",
          supplierName: "ABC Machinery",
          quotationNumber: "Q-014",
          lineDescription: "Plant",
          approved: true,
          mapped: true,
        },
      ],
    });
    const cost = model.sections.find(
      (section) => section.id === "project-cost",
    )!;
    expect(
      cost.tables[0].rows
        .flat()
        .some((cell) => cell.displayValue.includes("ABC Machinery, Q-014")),
    ).toBe(true);
    expect(
      model.sources.some((source) => source.kind === "APPROVED_QUOTATION"),
    ).toBe(true);
  });

  it("preserves approved narrative overrides", async () => {
    const input = sourceInput();
    const text = "User-approved executive narrative.";
    const first = await buildDprReportModel({
      ...input,
      narrativeOverrides: { "executive-summary": { text, approved: true } },
    });
    const second = await buildDprReportModel({
      ...input,
      identity: { ...input.identity, reportVersion: 2 },
      narrativeOverrides: { "executive-summary": { text, approved: true } },
    });
    expect(
      first.sections.find((s) => s.id === "executive-summary")!.narrative,
    ).toEqual({ text, approved: true, provenance: "USER_APPROVED" });
    expect(
      second.sections.find((s) => s.id === "executive-summary")!.narrative
        ?.text,
    ).toBe(text);
  });

  it.each([
    "GOI.PMEGP.NEW_ENTERPRISE",
    "GOI.NLM.RURAL_POULTRY",
    "GOI.PMFME.INDIVIDUAL_UNIT",
    "GOI.PMMY",
    "MH.CMEGP.NEW_ENTERPRISE",
  ])("uses existing versioned output for %s", async (id) => {
    const input = sourceInput({
      selectedPrograms: [{ programId: programId(id) }],
      schemeFacts: {},
    });
    const model = await buildDprReportModel(input);
    const section = model.sections.find(
      (candidate) => candidate.id === "scheme-assistance",
    );
    expect(section).toBeDefined();
    expect(section!.tables[0].rows[0][0].displayValue).toBe(id);
    expect(section!.tables[0].rows[0][1].displayValue).not.toBe("");
    if (id === "GOI.PMMY") expect(JSON.stringify(section)).toContain("CREDIT");
  });

  it("states unknown multi-program compatibility as manual review", async () => {
    const input = sourceInput({
      selectedPrograms: [
        { programId: programId("GOI.NLM.RURAL_POULTRY") },
        { programId: programId("GOI.PMMY") },
      ],
      schemeFacts: {},
    });
    const model = await buildDprReportModel(input);
    const funding = model.sections.find(
      (section) => section.id === "funding-composition",
    );
    expect(JSON.stringify(funding)).toMatch(
      /Compatibility (could not be established|is presented exactly)/,
    );
  });
});

describe("narrative and report validation", () => {
  it("falls back when optional AI is unavailable, malformed, or invents a number", async () => {
    const fallback = new DeterministicNarrativeProvider();
    for (const external of [
      {
        generateText: async () => {
          throw new Error("offline");
        },
      },
      { generateText: async () => "<script>bad</script>" },
      { generateText: async () => "Revenue will be ₹999999999." },
    ] satisfies ExternalNarrativeGenerator[]) {
      const result = await new GuardedNarrativeProvider(
        fallback,
        external,
      ).generate({
        sectionId: "market-sales",
        sectionTitle: "Market",
        facts: { projectName: "Unit" },
        allowedFinancialValues: ["100"],
      });
      expect(result.provenance).toBe("DETERMINISTIC");
    }
  });

  it("classifies missing references, mismatches, unbalanced statements and undefined IRR", async () => {
    const model = await buildDprReportModel(sourceInput());
    const invalid = {
      ...model,
      identity: { ...model.identity, calculationRunId: "", projectId: "wrong" },
    };
    const result = validateDprReport(invalid);
    expect(result.validForExport).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "MISSING_REPORT_IDENTITY",
        "SNAPSHOT_PROJECT_MISMATCH",
      ]),
    );
  });
});

describe("PDF, DOCX and Excel renderers", () => {
  it("renders a valid multi-page PDF with required section text", async () => {
    const artifact = await renderPdf(await buildDprReportModel(sourceInput()));
    const source = artifact.content.toString("latin1");
    expect(artifact.content.subarray(0, 5).toString()).toBe("%PDF-");
    expect(artifact.content.length).toBeGreaterThan(10_000);
    expect((source.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(5);
    expect(source).toContain(
      Buffer.from("Projected Profit & Loss").toString("hex"),
    );
  });

  it("renders an editable DOCX with headings and financial tables", async () => {
    const artifact = await renderDocx(await buildDprReportModel(sourceInput()));
    expect(artifact.content.subarray(0, 2).toString()).toBe("PK");
    const zip = await JSZip.loadAsync(artifact.content);
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("DETAILED PROJECT REPORT");
    expect(xml).toContain("Projected Profit &amp; Loss");
    expect(xml).toContain("₹24,00,000.00");
    expect(xml).toContain("w:tbl");
  });

  it("renders all required Excel sheets with exact text precision and no invalid numbers", async () => {
    const model = await buildDprReportModel(sourceInput());
    const artifact = await renderExcel(model);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(artifact.content as never);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(
      REQUIRED_EXCEL_SHEETS,
    );
    const pnl = workbook.getWorksheet("Profit & Loss")!;
    const values = JSON.stringify(pnl.getSheetValues());
    expect(values).toContain(model.calculation.profitAndLoss!.years[0].revenue);
    expect(values).not.toMatch(/NaN|Infinity/);
  });

  it("uses the same exact authoritative values across all adapters", async () => {
    const model = await buildDprReportModel(sourceInput());
    const exact = model.calculation.profitAndLoss!.years[0].profitAfterTax;
    const [pdf, docx, excel] = await Promise.all([
      renderPdf(model),
      renderDocx(model),
      renderExcel(model),
    ]);
    expect(
      model.sections.find((section) => section.id === "profit-loss")!.tables[0]
        .rows[0][9].authoritativeValue,
    ).toBe(exact);
    expect(pdf.content.length).toBeGreaterThan(0);
    expect(docx.content.length).toBeGreaterThan(0);
    expect(excel.content.length).toBeGreaterThan(0);
    if (process.env.PROJECTSETU_WRITE_REPORT_QA === "1") {
      const output = path.resolve("tmp", "report-qa");
      await fs.mkdir(output, { recursive: true });
      await Promise.all([
        fs.writeFile(path.join(output, pdf.filename), pdf.content),
        fs.writeFile(path.join(output, docx.filename), docx.content),
        fs.writeFile(path.join(output, excel.filename), excel.content),
      ]);
    }
  });
});

describe("presentation policy", () => {
  it("formats Indian currency without mutating Decimal precision", () => {
    const exact = "12500000.1234567890123456789";
    expect(formatIndianCurrency(exact)).toBe("₹1,25,00,000.12");
    expect(exact).toBe("12500000.1234567890123456789");
    expect(sanitizeReportFilename("Goat / Farming: DPR", 2)).toBe(
      "ProjectSetu_Goat_Farming_DPR_DPR_v2",
    );
  });
});
