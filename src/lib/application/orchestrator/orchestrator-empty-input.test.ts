import { describe, expect, it } from "vitest";

import { createEmptyProjectWizardInput } from "./orchestrator-defaults";

describe("production project initialization", () => {
  it("does not silently populate financially meaningful assumptions", () => {
    const input = createEmptyProjectWizardInput({
      id: "project-empty",
      name: "Applicant Project",
      mode: "BANKABLE",
      industryActivity: "Repair services",
      stage: "PLANNING",
      status: "DRAFT",
      areaClassification: "UNCLASSIFIED",
      projectionPeriodYears: 5,
    });

    expect(input.costItems).toEqual([]);
    expect(input.financingSources).toEqual([]);
    expect(input.revenueProducts).toEqual([]);
    expect(input.operatingExpenses).toEqual([]);
    expect(input.applicant.name).toBe("");
    expect(input.loan.principalAmount).toBe("0");
    expect(input.loan.annualInterestRate).toBe("0");
    expect(input.workingCapital.rawMaterialDays).toBe("0");
    expect(input.taxAndReturns.initialOpeningCash).toBe("0");
  });

  it("retains only facts explicitly supplied at creation", () => {
    const input = createEmptyProjectWizardInput(
      {
        id: "project-known",
        name: "Applicant Project",
        mode: "SUBSIDY",
        industryActivity: "Food processing",
        stage: "PLANNING",
        status: "DRAFT",
        areaClassification: "RURAL",
        projectionPeriodYears: 7,
      },
      {
        applicantName: "Applicant supplied name",
        projectDescription: "Applicant supplied description",
      },
    );

    expect(input.applicant.name).toBe("Applicant supplied name");
    expect(input.project.projectDescription).toBe(
      "Applicant supplied description",
    );
  });
});
