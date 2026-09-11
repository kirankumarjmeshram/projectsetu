import { describe, expect, it } from "vitest";
import { orchestrateProjectCalculation } from "@/lib/application/orchestrator/calculation-orchestrator";
import type { ProjectWizardInput } from "@/lib/application/orchestrator/orchestrator-types";
import { buildDprReportModel } from "@/lib/reports/builder";
import { validateDprReport } from "@/lib/reports/validation";
import fixture from "./mock-project.json";

describe("fictional mock project", () => {
  it("calculates through the input path and retains intentional advisory gaps", async () => {
    const input = fixture as ProjectWizardInput;
    const calculation = orchestrateProjectCalculation(input, "2026-09-10");
    expect(calculation.success).toBe(true);
    const model = await buildDprReportModel({
      project: input,
      calculation,
      identity: {
        reportId: "mock-report",
        reportVersion: 1,
        projectId: input.project.id,
        inputSnapshotId: "mock-input",
        calculationRunId: "mock-run",
        templateVersion: "BASE_BANKABLE_DPR/1.0",
        contentSchemaVersion: 1,
        generatedAt: "2026-09-10T00:00:00Z",
        language: "en",
      },
    });
    const validation = validateDprReport(model);
    expect(validation.validForExport).toBe(true);
    expect(validation.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "MISSING_MARKET_INFORMATION",
        "MISSING_RISK_INFORMATION",
      ]),
    );
  });
});
