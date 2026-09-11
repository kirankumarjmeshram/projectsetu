import { describe, expect, it } from "vitest";
import { countIssuesByStep, mapIssueToWizard } from "./wizard-issues";

describe("wizard validation mapping", () => {
  it.each([
    ["revenueProducts.0.capacityUtilisationYear1", 5],
    ["loan.annualInterestRate", 7],
    ["costItems.0.amount", 3],
    [undefined, 10],
  ])("maps %s to step %s", (path, step) => {
    expect(
      mapIssueToWizard({
        code: "REQUIRED",
        severity: "ERROR",
        message: "Required",
        path,
      }).step,
    ).toBe(step);
  });
  it("classifies and counts affected tabs", () => {
    const issues = [
      {
        code: "MISSING_RATE",
        severity: "ERROR",
        message: "Rate is required",
        path: "loan.annualInterestRate",
      },
      {
        code: "CHECK_RATE",
        severity: "WARNING",
        message: "Check rate",
        path: "loan.annualInterestRate",
      },
    ];
    expect(mapIssueToWizard(issues[0]).kind).toBe("MISSING_INFORMATION");
    expect(mapIssueToWizard(issues[1]).kind).toBe("WARNING");
    expect(countIssuesByStep(issues)).toEqual({ 7: 2 });
  });
});
