import ExcelJS from "exceljs";

import type {
  DprReportModel,
  RenderedReportArtifact,
  ReportTable,
} from "../contracts";

export const REQUIRED_EXCEL_SHEETS = [
  "Project Summary",
  "Project Cost",
  "Means of Finance",
  "Working Capital",
  "Loan Schedule",
  "Revenue",
  "Operating Expenses",
  "Depreciation",
  "Profit & Loss",
  "Cash Flow",
  "Balance Sheet",
  "Ratios & DSCR",
  "Investment Returns",
  "Scheme Funding",
  "Assumptions",
] as const;

const mapping: Record<
  (typeof REQUIRED_EXCEL_SHEETS)[number],
  readonly string[]
> = {
  "Project Summary": [
    "executive-summary",
    "applicant-profile",
    "project-profile",
  ],
  "Project Cost": ["project-cost"],
  "Means of Finance": ["means-of-finance"],
  "Working Capital": ["working-capital"],
  "Loan Schedule": ["loan-assumptions", "repayment-schedule"],
  Revenue: ["revenue-projections"],
  "Operating Expenses": ["operating-expenses"],
  Depreciation: ["depreciation"],
  "Profit & Loss": ["profit-loss"],
  "Cash Flow": ["cash-flow"],
  "Balance Sheet": ["balance-sheet"],
  "Ratios & DSCR": ["dscr", "break-even", "financial-ratios"],
  "Investment Returns": ["investment-returns"],
  "Scheme Funding": ["scheme-assistance", "funding-composition"],
  Assumptions: ["assumptions-notes", "sources", "annexures"],
};

function addTable(
  sheet: ExcelJS.Worksheet,
  table: ReportTable,
  startRow: number,
): number {
  sheet.getCell(startRow, 1).value = table.title;
  sheet.getCell(startRow, 1).font = {
    bold: true,
    color: { argb: "FF17365D" },
    size: 12,
  };
  const headerRow = sheet.getRow(startRow + 1);
  const headers = table.columns.flatMap((column) => [
    column,
    `${column} · exact snapshot value`,
  ]);
  headerRow.values = headers;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF17365D" },
    };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  table.rows.forEach((row, index) => {
    const values = row.flatMap((cell) => [
      cell.displayValue,
      cell.authoritativeValue ?? "",
    ]);
    const excelRow = sheet.getRow(startRow + 2 + index);
    excelRow.values = values;
    excelRow.eachCell((cell, column) => {
      cell.font = {
        color: { argb: column % 2 === 0 ? "FF008000" : "FF000000" },
      };
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = { bottom: { style: "hair", color: { argb: "FFD7DEE7" } } };
      cell.numFmt = "@";
    });
  });
  let next = startRow + table.rows.length + 3;
  for (const note of table.notes ?? []) {
    sheet.getCell(next++, 1).value = note;
    sheet.getCell(next - 1, 1).font = {
      italic: true,
      color: { argb: "FF475569" },
    };
  }
  return next + 1;
}

export async function renderExcel(
  model: DprReportModel,
): Promise<RenderedReportArtifact> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ProjectSetu";
  workbook.title = model.title;
  workbook.subject = "Authoritative DPR financial workbook";
  workbook.created = new Date(model.identity.generatedAt);
  workbook.calcProperties.fullCalcOnLoad = false;

  for (const name of REQUIRED_EXCEL_SHEETS) {
    const sheet = workbook.addWorksheet(name, {
      views: [{ state: "frozen", ySplit: 4, showGridLines: false }],
    });
    sheet.getCell("A1").value = `${model.project.project.name} — ${name}`;
    sheet.getCell("A1").font = {
      bold: true,
      size: 16,
      color: { argb: "FF17365D" },
    };
    sheet.getCell("A2").value =
      `Report v${model.identity.reportVersion} · Calculation run ${model.identity.calculationRunId}`;
    sheet.getCell("A2").font = { italic: true, color: { argb: "FF64748B" } };
    sheet.getCell("A3").value =
      "Exact snapshot columns are stored as text to preserve Decimal.js precision; display columns use the central presentation policy.";
    sheet.getCell("A3").font = { color: { argb: "FF475569" } };
    let row = 5;
    for (const section of model.sections.filter((candidate) =>
      mapping[name].includes(candidate.id),
    )) {
      if (section.narrative) {
        sheet.getCell(row, 1).value = section.title;
        sheet.getCell(row, 1).font = {
          bold: true,
          color: { argb: "FF17365D" },
        };
        sheet.getCell(row + 1, 1).value = section.narrative.text;
        sheet.getCell(row + 1, 1).alignment = {
          wrapText: true,
          vertical: "top",
        };
        sheet.mergeCells(row + 1, 1, row + 1, 8);
        row += 3;
      }
      for (const reportTable of section.tables)
        row = addTable(sheet, reportTable, row);
    }
    if (row === 5) {
      sheet.getCell(row, 1).value = "Not applicable for this report version.";
      sheet.getCell(row, 1).font = {
        italic: true,
        color: { argb: "FF64748B" },
      };
    }
    sheet.columns.forEach((column, index) => {
      column.width = index % 2 === 0 ? 22 : 24;
    });
    sheet.autoFilter = undefined;
    sheet.pageSetup = {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2,
      },
    };
    sheet.headerFooter.oddFooter = `ProjectSetu · ${model.filenameStem} · &P of &N`;
  }
  const content = Buffer.from(await workbook.xlsx.writeBuffer());
  return {
    format: "XLSX",
    filename: `${model.filenameStem}.xlsx`,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    content,
  };
}
