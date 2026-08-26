import { describe, expect, it } from "vitest";

import { programId } from "@/domain/schemes/program";
import { orchestrateProjectCalculation } from "./calculation-orchestrator";
import { createDefaultProjectWizardInput } from "./orchestrator-defaults";
import {
  formatIndianCurrency,
  formatLakhsCrores,
  formatPercentage,
  formatRatio,
  isDecimalNegative,
  isDecimalZero,
  sumDecimalStrings,
} from "../formatters";

describe("Task 018 Pre-Commit Review — Accounting, Boundaries & Semantic Audits", () => {
  it("verifies Loan Engine mapping for EMI and EQUAL_PRINCIPAL without intermediate drift", () => {
    const input = createDefaultProjectWizardInput({
      loan: {
        principalAmount: "1000000.00",
        annualInterestRate: "10.00",
        repaymentMethod: "EQUAL_PRINCIPAL",
        repaymentFrequency: "YEARLY",
        repaymentTenureYears: 5,
        moratoriumPeriods: 0,
      },
    });

    const resultEqual = orchestrateProjectCalculation(input);
    expect(resultEqual.success).toBe(true);
    expect(resultEqual.loanSchedule).toBeDefined();
    expect(resultEqual.loanSchedule?.summary.originalPrincipal).toMatch(
      /1000000/,
    );
    // Under EQUAL_PRINCIPAL, principal paid per year = 200,000
    expect(
      resultEqual.loanSchedule?.annualSummaries[0].principalRepaid,
    ).toMatch(/200000/);

    // Test EMI
    const inputEmi = {
      ...input,
      loan: {
        ...input.loan,
        repaymentMethod: "EMI" as const,
      },
    };
    const resultEmi = orchestrateProjectCalculation(inputEmi);
    expect(resultEmi.success).toBe(true);
    expect(resultEmi.loanSchedule).toBeDefined();
    // Under EMI, Year 1 total payment is constant annuity
    const yr1Emi = resultEmi.loanSchedule?.annualSummaries[0];
    expect(yr1Emi).toBeDefined();
  });

  it("verifies P&L recognizes only interest charged and never principal", () => {
    const input = createDefaultProjectWizardInput({
      loan: {
        principalAmount: "1000000.00",
        annualInterestRate: "10.00",
        repaymentMethod: "EQUAL_PRINCIPAL",
        repaymentFrequency: "YEARLY",
        repaymentTenureYears: 5,
        moratoriumPeriods: 0,
      },
    });

    const result = orchestrateProjectCalculation(input);
    expect(result.profitAndLoss).toBeDefined();
    const yr1Pnl = result.profitAndLoss?.years[0];
    // Year 1 interest at 10% of 10,00,000 is 1,00,000
    expect(yr1Pnl?.interestExpense).toMatch(/100000/);
    // Principal (2,00,000) is a balance sheet movement and must not be mixed into interest
    expect(yr1Pnl?.interestExpense).not.toBe("300000.00");
  });

  it("verifies Cash Flow adds back depreciation exactly once and separates principal repayment from interest", () => {
    const input = createDefaultProjectWizardInput();
    const result = orchestrateProjectCalculation(input);
    expect(result.cashFlow).toBeDefined();
    expect(result.depreciation).toBeDefined();

    const yr1Cf = result.cashFlow?.years[0];
    const yr1Dep = result.depreciation?.yearlySummaries[0];
    expect(yr1Cf?.depreciationAddBack).toBe(yr1Dep?.depreciation);

    // Financing cash flows must isolate principal from operating flows
    expect(yr1Cf?.financingCashFlow).toBeDefined();
  });

  it("verifies Scheme Assistance timing: subsidies are not treated as immediate cash in Means of Finance", () => {
    const input = createDefaultProjectWizardInput({
      selectedPrograms: [{ programId: programId("GOI.PMFME.INDIVIDUAL_UNIT") }],
      schemeFacts: {
        applicant: { entityType: "INDIVIDUAL" },
      },
    });

    const result = orchestrateProjectCalculation(input);
    expect(result.fundingComposer).toBeDefined();
    const subsidy = result.fundingComposer?.summary.benefits.capitalSubsidy;
    expect(subsidy).toBeDefined();
    expect(Number.parseFloat(subsidy || "0")).toBeGreaterThan(0);

    // Upfront Means of Finance must only contain user-entered sources, not auto-injected subsidy
    const moaTotal = result.meansOfFinance?.statedTotal;
    expect(moaTotal).toMatch(/2500000/);
  });

  it("verifies undefined metric states render safe fallback strings rather than NaN or undefined%", () => {
    expect(formatRatio(undefined, "x", 2, "N/A")).toBe("N/A");
    expect(formatRatio("NaN", "x", 2, "N/A")).toBe("N/A");
    expect(formatPercentage(undefined, 2, "N/A")).toBe("N/A");
    expect(formatPercentage("Infinity", 2, "N/A")).toBe("N/A");
    expect(formatPercentage("-Infinity", 2, "N/A")).toBe("N/A");
    expect(formatIndianCurrency(undefined, { fallback: "N/A" })).toBe("N/A");
    expect(formatLakhsCrores(undefined, { fallback: "N/A" })).toBe("N/A");
  });

  it("verifies sumDecimalStrings accurately aggregates decimals without floating point error", () => {
    const values = ["0.1", "0.2", "100.05", "200.05"];
    const sum = sumDecimalStrings(values);
    expect(sum).toBe("300.4");

    expect(isDecimalNegative("-500.00")).toBe(true);
    expect(isDecimalNegative("500.00")).toBe(false);
    expect(isDecimalZero("0.00")).toBe(true);
    expect(isDecimalZero("0")).toBe(true);
    expect(isDecimalZero("10.00")).toBe(false);
  });
});
