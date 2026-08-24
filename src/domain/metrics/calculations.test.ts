import { describe, expect, it } from "vitest";

import { calculateBalanceSheetSchedule } from "../balance-sheet/calculations";
import type {
  BalanceSheetProjectionInput,
  BalanceSheetSchedule,
  BalanceSheetYearInput,
} from "../balance-sheet/balance-sheet";
import { generateLoanRepaymentSchedule } from "../loan/calculations";
import type { LoanRepaymentSchedule, LoanTerms } from "../loan/loan";
import { calculateProjectedProfitAndLoss } from "../profit-and-loss/calculations";
import type { ProfitAndLossSchedule } from "../profit-and-loss/profit-and-loss";
import { calculateProjectCost } from "../project-cost/calculations";
import type { ProjectCost } from "../project-cost/project-cost";
import { calculateRevenueAndOperatingExpenseProjection } from "../projection/calculations";
import type {
  RevenueAndOperatingExpenseProjection,
  RevenueAndOperatingExpenseProjectionInput,
} from "../projection/projection";
import type { Assumption } from "../shared/assumptions";
import type { CalculationResult } from "../shared/calculation";
import {
  decimalValue,
  monetaryAmount,
  percentage,
  toDecimal,
} from "../shared/decimal";
import type { DecimalValue, MonetaryAmount, Percentage } from "../shared/types";
import { sampleUserSource } from "../testing/domain-fixtures";
import {
  adaptBalanceSheetToMetrics,
  adaptLoanScheduleToMetricsDebtService,
  adaptProfitAndLossToMetrics,
  adaptProjectCostToMetrics,
  adaptProjectionToBreakEvenInputs,
  calculateBankabilityMetricsFromAuthoritativeSchedules,
  composeBankabilityMetricsYearInputs,
} from "./adapters";
import type { BankabilityMetricsAuthoritativeSchedules } from "./metrics";
import {
  calculateAverageDscr,
  calculateBankabilityMetricsSchedule,
  calculateBreakEvenMetrics,
  calculateCurrentRatio,
  calculateDebtEquityRatio,
  calculateDscr,
  calculateInterestCoverageRatio,
  calculateProfitabilityMargins,
  calculateRoce,
  calculateRoi,
} from "./calculations";
import type {
  BankabilityMetricsYearInput,
  DefinedMetricResult,
  MetricResult,
  OperatingCostClassification,
  ProjectionCostClassification,
} from "./metrics";

function unwrap<TValue>(result: CalculationResult<TValue>): TValue {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.errors.map((error) => error.code).join(", "));
  }
  return result.value;
}

function expectError<TValue>(
  result: CalculationResult<TValue>,
  code: string,
): void {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected calculation failure.");
  expect(result.errors.map((error) => error.code)).toContain(code);
}

function definedValue<TValue extends DecimalValue>(
  result: MetricResult<TValue>,
): TValue {
  expect(result.status).toBe("DEFINED");
  return (result as DefinedMetricResult<TValue>).value;
}

function expectUndefined(
  result: MetricResult,
  status: MetricResult["status"],
): void {
  expect(result).toEqual({ status });
  expect(result).not.toHaveProperty("value");
}

function m(value: string): MonetaryAmount {
  return monetaryAmount(value);
}

function assumedAmount(value: string): Assumption<MonetaryAmount> {
  return { value: m(value), source: sampleUserSource };
}

function assumedPercentage(value: string): Assumption<Percentage> {
  return { value: percentage(value), source: sampleUserSource };
}

function assumedDecimal(value: string): Assumption<DecimalValue> {
  return { value: decimalValue(value), source: sampleUserSource };
}

function metricYear(
  year = 1,
  overrides: Partial<BankabilityMetricsYearInput> = {},
): BankabilityMetricsYearInput {
  return {
    year,
    revenue: m("1000"),
    variableCosts: m("400"),
    fixedCosts: m("300"),
    ebitda: m("300"),
    ebit: m("200"),
    profitBeforeTax: m("150"),
    profitAfterTax: m("120"),
    depreciation: m("100"),
    interestExpense: m("50"),
    principalRepayment: m("100"),
    longTermDebt: m("500"),
    currentDebt: m("100"),
    totalCurrentAssets: m("400"),
    totalCurrentLiabilities: m("200"),
    totalAssets: m("1200"),
    totalEquity: m("450"),
    totalProjectCost: m("1000"),
    ...overrides,
  };
}

function projectionInput(): RevenueAndOperatingExpenseProjectionInput {
  return {
    projectId: "project-metrics",
    projectionPeriodYears: 2,
    revenueAssumptions: [
      {
        id: "product-1",
        productOrServiceName: "Service",
        unit: "engagement",
        quantity: assumedDecimal("1000"),
        unitPrice: assumedAmount("1"),
        capacityUtilisation: assumedPercentage("100"),
        quantityGrowth: assumedPercentage("0"),
        sellingPriceEscalation: assumedPercentage("0"),
      },
    ],
    operatingExpenseAssumptions: [
      {
        id: "expense-variable",
        name: "Materials",
        category: "RAW_MATERIALS",
        calculationMethod: "FIXED_ANNUAL_AMOUNT",
        annualAmount: assumedAmount("400"),
        annualEscalation: assumedPercentage("0"),
      },
      {
        id: "expense-fixed",
        name: "Salary",
        category: "SALARIES",
        calculationMethod: "FIXED_ANNUAL_AMOUNT",
        annualAmount: assumedAmount("300"),
        annualEscalation: assumedPercentage("0"),
      },
      {
        id: "expense-custom",
        name: "Custom licence",
        category: "CUSTOM",
        calculationMethod: "FIXED_ANNUAL_AMOUNT",
        annualAmount: assumedAmount("50"),
        annualEscalation: assumedPercentage("0"),
      },
    ],
  };
}

function calculatedProjection(): RevenueAndOperatingExpenseProjection {
  return unwrap(
    calculateRevenueAndOperatingExpenseProjection(projectionInput()),
  );
}

function costClassifications(
  overrides: Partial<ProjectionCostClassification> = {},
): ProjectionCostClassification {
  const classified = (
    value: OperatingCostClassification,
  ): Assumption<OperatingCostClassification> => ({
    value,
    source: sampleUserSource,
  });
  return {
    projectId: "project-metrics",
    expenses: [
      {
        expenseId: "expense-variable",
        classification: classified("VARIABLE"),
      },
      {
        expenseId: "expense-fixed",
        classification: classified("FIXED"),
      },
      {
        expenseId: "expense-custom",
        classification: classified("FIXED"),
      },
    ],
    ...overrides,
  };
}

function calculatedProfitAndLoss(): ProfitAndLossSchedule {
  const projection = calculatedProjection();
  return unwrap(
    calculateProjectedProfitAndLoss({
      projectId: projection.projectId,
      years: projection.years.map((year, index) => ({
        year: year.year,
        revenue: year.totalRevenue,
        operatingExpenses: year.totalOperatingExpenses,
        depreciation: m("100"),
        interestExpense: index === 0 ? m("50") : m("25"),
      })),
      taxConfiguration: { mode: "NO_TAX" },
    }),
  );
}

function calculatedLoan(): LoanRepaymentSchedule {
  const terms: LoanTerms = {
    id: "loan-1",
    type: "TERM_LOAN",
    principal: assumedAmount("1000"),
    annualInterestRate: assumedPercentage("5"),
    repaymentPeriods: 2,
    repaymentFrequency: "YEARLY",
    repaymentMethod: "EQUAL_PRINCIPAL",
  };
  return unwrap(generateLoanRepaymentSchedule(terms));
}

function balanceYear(
  year: number,
  profitAfterTax: MonetaryAmount,
  longTermLoanOutstanding: MonetaryAmount,
  accumulatedDepreciation: MonetaryAmount,
): BalanceSheetYearInput {
  return {
    year,
    grossFixedAssets: m("1000"),
    accumulatedDepreciation,
    inventory: m("100"),
    receivables: m("100"),
    otherCurrentAssets: m("50"),
    cashAndBank: m("150"),
    longTermLoanOutstanding,
    currentDebt: m("0"),
    payables: m("100"),
    otherCurrentLiabilities: m("100"),
    promoterCapital: m("300"),
    profitAfterTax,
    retainedEarningsAdjustments: m("0"),
    otherEquity: m("0"),
  };
}

function calculatedBalanceSheet(): BalanceSheetSchedule {
  const profitAndLoss = calculatedProfitAndLoss();
  const input: BalanceSheetProjectionInput = {
    projectId: "project-metrics",
    openingRetainedEarnings: assumedAmount("0"),
    years: [
      balanceYear(
        1,
        profitAndLoss.years[0]!.profitAfterTax,
        m("500"),
        m("100"),
      ),
      balanceYear(2, profitAndLoss.years[1]!.profitAfterTax, m("0"), m("200")),
    ],
  };
  return unwrap(calculateBalanceSheetSchedule(input));
}

function projectCost(): ProjectCost {
  return {
    projectId: "project-metrics",
    items: [
      {
        id: "cost-1",
        description: "Project assets",
        category: "PLANT_AND_MACHINERY",
        amount: assumedAmount("1000"),
      },
    ],
    statedTotal: m("1000"),
  };
}

function authoritativeSchedules(): BankabilityMetricsAuthoritativeSchedules {
  return {
    profitAndLoss: unwrap(
      adaptProfitAndLossToMetrics(calculatedProfitAndLoss()),
    ),
    debtService: unwrap(
      adaptLoanScheduleToMetricsDebtService(
        "project-metrics",
        calculatedLoan(),
      ),
    ),
    balanceSheet: unwrap(adaptBalanceSheetToMetrics(calculatedBalanceSheet())),
    projectCost: unwrap(
      adaptProjectCostToMetrics(unwrap(calculateProjectCost(projectCost()))),
    ),
    breakEven: unwrap(
      adaptProjectionToBreakEvenInputs(
        calculatedProjection(),
        costClassifications(),
      ),
    ),
  };
}

describe("DSCR", () => {
  it("calculates profitable-project CADS, debt service, and DSCR", () => {
    const result = unwrap(
      calculateDscr({
        year: 1,
        profitAfterTax: m("120"),
        depreciation: m("100"),
        interestExpense: m("50"),
        principalRepayment: m("100"),
      }),
    );
    expect(result.cashAvailableForDebtService).toBe("270");
    expect(result.debtService).toBe("150");
    expect(definedValue(result.dscr)).toBe("1.8");
  });

  it("allows negative PAT and a negative DSCR", () => {
    const result = unwrap(
      calculateDscr({
        year: 1,
        profitAfterTax: m("-500"),
        depreciation: m("100"),
        interestExpense: m("50"),
        principalRepayment: m("50"),
      }),
    );
    expect(result.cashAvailableForDebtService).toBe("-350");
    expect(definedValue(result.dscr)).toBe("-3.5");
  });

  it("handles zero PAT", () => {
    const result = unwrap(
      calculateDscr({
        year: 1,
        profitAfterTax: m("0"),
        depreciation: m("20"),
        interestExpense: m("10"),
        principalRepayment: m("20"),
      }),
    );
    expect(definedValue(result.dscr)).toBe("1");
  });

  it("handles zero depreciation", () => {
    const result = unwrap(
      calculateDscr({
        year: 1,
        profitAfterTax: m("25"),
        depreciation: m("0"),
        interestExpense: m("5"),
        principalRepayment: m("10"),
      }),
    );
    expect(definedValue(result.dscr)).toBe("2");
  });

  it("supports principal-only debt service", () => {
    const result = unwrap(
      calculateDscr({
        year: 1,
        profitAfterTax: m("80"),
        depreciation: m("20"),
        interestExpense: m("0"),
        principalRepayment: m("50"),
      }),
    );
    expect(result.debtService).toBe("50");
    expect(definedValue(result.dscr)).toBe("2");
  });

  it("supports interest-only debt service", () => {
    const result = unwrap(
      calculateDscr({
        year: 1,
        profitAfterTax: m("20"),
        depreciation: m("10"),
        interestExpense: m("10"),
        principalRepayment: m("0"),
      }),
    );
    expect(result.debtService).toBe("10");
    expect(definedValue(result.dscr)).toBe("4");
  });

  it("returns an explicit undefined result for zero debt service", () => {
    const result = unwrap(
      calculateDscr({
        year: 1,
        profitAfterTax: m("20"),
        depreciation: m("10"),
        interestExpense: m("0"),
        principalRepayment: m("0"),
      }),
    );
    expectUndefined(result.dscr, "UNDEFINED_ZERO_DENOMINATOR");
    expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity/);
  });

  it("preserves Decimal.js division precision without intermediate rounding", () => {
    const result = unwrap(
      calculateDscr({
        year: 1,
        profitAfterTax: m("1"),
        depreciation: m("0"),
        interestExpense: m("0"),
        principalRepayment: m("3"),
      }),
    );
    expect(definedValue(result.dscr)).toBe(
      "0.3333333333333333333333333333333333333333",
    );
  });

  it("calculates multi-year weighted Average DSCR from totals", () => {
    const result = unwrap(
      calculateAverageDscr([
        {
          year: 1,
          profitAfterTax: m("50"),
          depreciation: m("0"),
          interestExpense: m("0"),
          principalRepayment: m("100"),
        },
        {
          year: 2,
          profitAfterTax: m("900"),
          depreciation: m("0"),
          interestExpense: m("0"),
          principalRepayment: m("900"),
        },
      ]),
    );
    expect(result.totalCashAvailableForDebtService).toBe("950");
    expect(result.totalDebtService).toBe("1000");
    expect(definedValue(result.averageDscr)).toBe("0.95");
  });

  it("proves weighted Average DSCR is not the simple yearly mean", () => {
    const inputs = [
      {
        year: 1,
        profitAfterTax: m("50"),
        depreciation: m("0"),
        interestExpense: m("0"),
        principalRepayment: m("100"),
      },
      {
        year: 2,
        profitAfterTax: m("900"),
        depreciation: m("0"),
        interestExpense: m("0"),
        principalRepayment: m("900"),
      },
    ] as const;
    const annual = inputs.map((input) =>
      definedValue(unwrap(calculateDscr(input)).dscr),
    );
    expect(annual).toEqual(["0.5", "1"]);
    expect(definedValue(unwrap(calculateAverageDscr(inputs)).averageDscr)).toBe(
      "0.95",
    );
    expect("0.95").not.toBe("0.75");
  });

  it("excludes zero-debt-service years from both Average DSCR totals", () => {
    const result = unwrap(
      calculateAverageDscr([
        {
          year: 1,
          profitAfterTax: m("999"),
          depreciation: m("1"),
          interestExpense: m("0"),
          principalRepayment: m("0"),
        },
        {
          year: 2,
          profitAfterTax: m("100"),
          depreciation: m("0"),
          interestExpense: m("0"),
          principalRepayment: m("100"),
        },
      ]),
    );
    expect(result.totalCashAvailableForDebtService).toBe("100");
    expect(definedValue(result.averageDscr)).toBe("1");
  });

  it("returns undefined Average DSCR when all debt service is zero", () => {
    const result = unwrap(
      calculateAverageDscr([
        {
          year: 1,
          profitAfterTax: m("10"),
          depreciation: m("0"),
          interestExpense: m("0"),
          principalRepayment: m("0"),
        },
      ]),
    );
    expectUndefined(result.averageDscr, "UNDEFINED_ZERO_DENOMINATOR");
  });
});

describe("interest coverage", () => {
  it("uses EBIT rather than EBITDA", () => {
    const result = unwrap(
      calculateInterestCoverageRatio({
        year: 1,
        ebit: m("200"),
        interestExpense: m("50"),
      }),
    );
    expect(definedValue(result.interestCoverageRatio)).toBe("4");
  });

  it("allows negative EBIT and negative coverage", () => {
    const result = unwrap(
      calculateInterestCoverageRatio({
        year: 1,
        ebit: m("-25"),
        interestExpense: m("5"),
      }),
    );
    expect(definedValue(result.interestCoverageRatio)).toBe("-5");
  });

  it("returns undefined for zero interest", () => {
    const result = unwrap(
      calculateInterestCoverageRatio({
        year: 1,
        ebit: m("50"),
        interestExpense: m("0"),
      }),
    );
    expectUndefined(result.interestCoverageRatio, "UNDEFINED_ZERO_DENOMINATOR");
  });

  it("accepts zero EBIT with positive interest", () => {
    const result = unwrap(
      calculateInterestCoverageRatio({
        year: 1,
        ebit: m("0"),
        interestExpense: m("5"),
      }),
    );
    expect(definedValue(result.interestCoverageRatio)).toBe("0");
  });

  it("reconciles exact Decimal.js coverage", () => {
    const result = unwrap(
      calculateInterestCoverageRatio({
        year: 1,
        ebit: m("1"),
        interestExpense: m("8"),
      }),
    );
    expect(definedValue(result.interestCoverageRatio)).toBe("0.125");
  });
});

describe("debt-equity ratio", () => {
  it("uses long-term plus current interest-bearing debt", () => {
    const result = unwrap(
      calculateDebtEquityRatio({
        year: 1,
        longTermDebt: m("500"),
        currentDebt: m("100"),
        totalEquity: m("300"),
      }),
    );
    expect(result.interestBearingDebt).toBe("600");
    expect(definedValue(result.debtEquityRatio)).toBe("2");
  });

  it("returns undefined for zero equity", () => {
    const result = unwrap(
      calculateDebtEquityRatio({
        year: 1,
        longTermDebt: m("1"),
        currentDebt: m("0"),
        totalEquity: m("0"),
      }),
    );
    expectUndefined(result.debtEquityRatio, "UNDEFINED_ZERO_DENOMINATOR");
  });

  it("returns a distinct undefined status for negative equity", () => {
    const result = unwrap(
      calculateDebtEquityRatio({
        year: 1,
        longTermDebt: m("100"),
        currentDebt: m("0"),
        totalEquity: m("-50"),
      }),
    );
    expectUndefined(result.debtEquityRatio, "UNDEFINED_NEGATIVE_EQUITY");
  });

  it("returns defined zero for zero debt and positive equity", () => {
    const result = unwrap(
      calculateDebtEquityRatio({
        year: 1,
        longTermDebt: m("0"),
        currentDebt: m("0"),
        totalEquity: m("50"),
      }),
    );
    expect(definedValue(result.debtEquityRatio)).toBe("0");
  });

  it("does not accept non-interest-bearing liabilities", () => {
    const input = {
      year: 1,
      longTermDebt: m("100"),
      currentDebt: m("50"),
      totalEquity: m("100"),
      payables: m("999"),
      otherCurrentLiabilities: m("999"),
    };
    const result = unwrap(calculateDebtEquityRatio(input));
    expect(result.interestBearingDebt).toBe("150");
    expect(definedValue(result.debtEquityRatio)).toBe("1.5");
  });
});

describe("current ratio", () => {
  it("calculates the normal ratio", () => {
    const result = unwrap(
      calculateCurrentRatio({
        year: 1,
        totalCurrentAssets: m("400"),
        totalCurrentLiabilities: m("200"),
      }),
    );
    expect(definedValue(result.currentRatio)).toBe("2");
  });

  it("returns undefined for zero current liabilities", () => {
    const result = unwrap(
      calculateCurrentRatio({
        year: 1,
        totalCurrentAssets: m("400"),
        totalCurrentLiabilities: m("0"),
      }),
    );
    expectUndefined(result.currentRatio, "UNDEFINED_ZERO_DENOMINATOR");
  });

  it("returns defined zero for zero current assets", () => {
    const result = unwrap(
      calculateCurrentRatio({
        year: 1,
        totalCurrentAssets: m("0"),
        totalCurrentLiabilities: m("20"),
      }),
    );
    expect(definedValue(result.currentRatio)).toBe("0");
  });

  it("preserves a long decimal ratio", () => {
    const result = unwrap(
      calculateCurrentRatio({
        year: 1,
        totalCurrentAssets: m("1"),
        totalCurrentLiabilities: m("3"),
      }),
    );
    expect(definedValue(result.currentRatio)).toBe(
      "0.3333333333333333333333333333333333333333",
    );
  });
});

describe("break-even metrics", () => {
  it("calculates contribution, CMR, break-even sales, and percentage", () => {
    const result = unwrap(
      calculateBreakEvenMetrics({
        year: 1,
        revenue: m("1000"),
        variableCosts: m("400"),
        fixedCosts: m("300"),
      }),
    );
    expect(result.contribution).toBe("600");
    expect(definedValue(result.contributionMarginRatio)).toBe("0.6");
    expect(definedValue(result.breakEvenSales)).toBe("500");
    expect(definedValue(result.breakEvenPercentage)).toBe("50");
    expect(
      toDecimal(definedValue(result.breakEvenSales))
        .dividedBy(toDecimal(result.revenue))
        .times("100")
        .toFixed(),
    ).toBe(definedValue(result.breakEvenPercentage));
  });

  it("returns zero break-even sales when fixed costs are zero", () => {
    const result = unwrap(
      calculateBreakEvenMetrics({
        year: 1,
        revenue: m("100"),
        variableCosts: m("20"),
        fixedCosts: m("0"),
      }),
    );
    expect(definedValue(result.breakEvenSales)).toBe("0");
    expect(definedValue(result.breakEvenPercentage)).toBe("0");
  });

  it("returns explicit undefined results for zero revenue", () => {
    const result = unwrap(
      calculateBreakEvenMetrics({
        year: 1,
        revenue: m("0"),
        variableCosts: m("0"),
        fixedCosts: m("10"),
      }),
    );
    expectUndefined(
      result.contributionMarginRatio,
      "UNDEFINED_ZERO_DENOMINATOR",
    );
    expectUndefined(result.breakEvenSales, "UNDEFINED_ZERO_DENOMINATOR");
    expectUndefined(result.breakEvenPercentage, "UNDEFINED_ZERO_DENOMINATOR");
  });

  it("keeps zero CMR defined but break-even undefined for zero contribution", () => {
    const result = unwrap(
      calculateBreakEvenMetrics({
        year: 1,
        revenue: m("100"),
        variableCosts: m("100"),
        fixedCosts: m("10"),
      }),
    );
    expect(definedValue(result.contributionMarginRatio)).toBe("0");
    expectUndefined(
      result.breakEvenSales,
      "UNDEFINED_NON_POSITIVE_CONTRIBUTION",
    );
  });

  it("allows a negative contribution but does not invent negative break-even sales", () => {
    const result = unwrap(
      calculateBreakEvenMetrics({
        year: 1,
        revenue: m("100"),
        variableCosts: m("120"),
        fixedCosts: m("10"),
      }),
    );
    expect(result.contribution).toBe("-20");
    expect(definedValue(result.contributionMarginRatio)).toBe("-0.2");
    expectUndefined(
      result.breakEvenSales,
      "UNDEFINED_NON_POSITIVE_CONTRIBUTION",
    );
    expectUndefined(
      result.breakEvenPercentage,
      "UNDEFINED_NON_POSITIVE_CONTRIBUTION",
    );
  });

  it("preserves Decimal.js precision for repeating contribution margins", () => {
    const result = unwrap(
      calculateBreakEvenMetrics({
        year: 1,
        revenue: m("3"),
        variableCosts: m("2"),
        fixedCosts: m("1"),
      }),
    );
    expect(definedValue(result.contributionMarginRatio)).toBe(
      "0.3333333333333333333333333333333333333333",
    );
    expect(definedValue(result.breakEvenSales)).toBe("3");
    expect(definedValue(result.breakEvenPercentage)).toBe("100");
  });
});

describe("ROI", () => {
  it("calculates positive yearly ROI against project cost", () => {
    const result = unwrap(
      calculateRoi({
        year: 1,
        profitAfterTax: m("120"),
        totalProjectCost: m("1000"),
      }),
    );
    expect(definedValue(result.roi)).toBe("12");
  });

  it("allows negative ROI", () => {
    const result = unwrap(
      calculateRoi({
        year: 1,
        profitAfterTax: m("-50"),
        totalProjectCost: m("1000"),
      }),
    );
    expect(definedValue(result.roi)).toBe("-5");
  });

  it("returns defined zero for zero PAT", () => {
    const result = unwrap(
      calculateRoi({
        year: 1,
        profitAfterTax: m("0"),
        totalProjectCost: m("1000"),
      }),
    );
    expect(definedValue(result.roi)).toBe("0");
  });

  it("returns undefined for zero project cost", () => {
    const result = unwrap(
      calculateRoi({
        year: 1,
        profitAfterTax: m("10"),
        totalProjectCost: m("0"),
      }),
    );
    expectUndefined(result.roi, "UNDEFINED_ZERO_DENOMINATOR");
  });

  it("uses the same project-cost base across schedule years", () => {
    const schedule = unwrap(
      calculateBankabilityMetricsSchedule({
        projectId: "project-metrics",
        years: [
          metricYear(1, { profitAfterTax: m("100") }),
          metricYear(2, { profitAfterTax: m("200") }),
        ],
      }),
    );
    expect(schedule.years.map((year) => definedValue(year.roi))).toEqual([
      "10",
      "20",
    ]);
    expect(schedule.years.map((year) => year.totalProjectCost)).toEqual([
      "1000",
      "1000",
    ]);
  });
});

describe("ROCE", () => {
  it("uses total assets less current liabilities as capital employed", () => {
    const result = unwrap(
      calculateRoce({
        year: 1,
        ebit: m("200"),
        totalAssets: m("1200"),
        totalCurrentLiabilities: m("200"),
      }),
    );
    expect(result.capitalEmployed).toBe("1000");
    expect(definedValue(result.roce)).toBe("20");
  });

  it("allows negative EBIT and ROCE", () => {
    const result = unwrap(
      calculateRoce({
        year: 1,
        ebit: m("-50"),
        totalAssets: m("1000"),
        totalCurrentLiabilities: m("500"),
      }),
    );
    expect(definedValue(result.roce)).toBe("-10");
  });

  it("returns undefined for zero capital employed", () => {
    const result = unwrap(
      calculateRoce({
        year: 1,
        ebit: m("10"),
        totalAssets: m("500"),
        totalCurrentLiabilities: m("500"),
      }),
    );
    expectUndefined(result.roce, "UNDEFINED_ZERO_DENOMINATOR");
  });

  it("returns a distinct status for negative capital employed", () => {
    const result = unwrap(
      calculateRoce({
        year: 1,
        ebit: m("10"),
        totalAssets: m("400"),
        totalCurrentLiabilities: m("500"),
      }),
    );
    expect(result.capitalEmployed).toBe("-100");
    expectUndefined(result.roce, "UNDEFINED_NEGATIVE_CAPITAL_EMPLOYED");
  });

  it("reconciles repeating Decimal.js ROCE exactly at configured precision", () => {
    const result = unwrap(
      calculateRoce({
        year: 1,
        ebit: m("1"),
        totalAssets: m("3"),
        totalCurrentLiabilities: m("0"),
      }),
    );
    expect(definedValue(result.roce)).toBe(
      "33.33333333333333333333333333333333333333",
    );
  });
});

describe("profitability margins", () => {
  it("calculates EBITDA, EBIT, PBT, and PAT margins", () => {
    const result = unwrap(
      calculateProfitabilityMargins({
        year: 1,
        revenue: m("1000"),
        ebitda: m("300"),
        ebit: m("200"),
        profitBeforeTax: m("150"),
        profitAfterTax: m("120"),
      }),
    );
    expect(definedValue(result.ebitdaMargin)).toBe("30");
    expect(definedValue(result.ebitMargin)).toBe("20");
    expect(definedValue(result.pbtMargin)).toBe("15");
    expect(definedValue(result.patMargin)).toBe("12");
  });

  it("allows negative margins", () => {
    const result = unwrap(
      calculateProfitabilityMargins({
        year: 1,
        revenue: m("100"),
        ebitda: m("-10"),
        ebit: m("-20"),
        profitBeforeTax: m("-25"),
        profitAfterTax: m("-30"),
      }),
    );
    expect([
      definedValue(result.ebitdaMargin),
      definedValue(result.ebitMargin),
      definedValue(result.pbtMargin),
      definedValue(result.patMargin),
    ]).toEqual(["-10", "-20", "-25", "-30"]);
  });

  it("returns all margins undefined when revenue is zero", () => {
    const result = unwrap(
      calculateProfitabilityMargins({
        year: 1,
        revenue: m("0"),
        ebitda: m("0"),
        ebit: m("0"),
        profitBeforeTax: m("0"),
        profitAfterTax: m("0"),
      }),
    );
    for (const metric of [
      result.ebitdaMargin,
      result.ebitMargin,
      result.pbtMargin,
      result.patMargin,
    ]) {
      expectUndefined(metric, "UNDEFINED_ZERO_DENOMINATOR");
    }
  });

  it("returns defined zero margins for zero profits and positive revenue", () => {
    const result = unwrap(
      calculateProfitabilityMargins({
        year: 1,
        revenue: m("100"),
        ebitda: m("0"),
        ebit: m("0"),
        profitBeforeTax: m("0"),
        profitAfterTax: m("0"),
      }),
    );
    expect([
      definedValue(result.ebitdaMargin),
      definedValue(result.ebitMargin),
      definedValue(result.pbtMargin),
      definedValue(result.patMargin),
    ]).toEqual(["0", "0", "0", "0"]);
  });

  it("does not round long percentage results", () => {
    const result = unwrap(
      calculateProfitabilityMargins({
        year: 1,
        revenue: m("3"),
        ebitda: m("1"),
        ebit: m("1"),
        profitBeforeTax: m("1"),
        profitAfterTax: m("1"),
      }),
    );
    expect(definedValue(result.patMargin)).toBe(
      "33.33333333333333333333333333333333333333",
    );
  });
});

describe("bankability metrics schedules and validation", () => {
  it("calculates every yearly metric and the weighted aggregate", () => {
    const result = unwrap(
      calculateBankabilityMetricsSchedule({
        projectId: "project-metrics",
        years: [metricYear()],
      }),
    );
    const year = result.years[0]!;
    expect(year).toMatchObject({
      year: 1,
      revenue: "1000",
      cashAvailableForDebtService: "270",
      debtService: "150",
      interestBearingDebt: "600",
      contribution: "600",
      capitalEmployed: "1000",
    });
    expect(definedValue(year.dscr)).toBe("1.8");
    expect(definedValue(year.interestCoverageRatio)).toBe("4");
    expect(definedValue(year.currentRatio)).toBe("2");
    expect(definedValue(year.breakEvenSales)).toBe("500");
    expect(definedValue(year.roi)).toBe("12");
    expect(definedValue(year.roce)).toBe("20");
    expect(definedValue(result.averageDscr.averageDscr)).toBe("1.8");
  });

  it("keeps mathematically undefined metrics without failing the schedule", () => {
    const zero = m("0");
    const result = unwrap(
      calculateBankabilityMetricsSchedule({
        projectId: "project-metrics",
        years: [
          metricYear(1, {
            revenue: zero,
            variableCosts: zero,
            fixedCosts: zero,
            ebitda: zero,
            ebit: zero,
            profitBeforeTax: zero,
            profitAfterTax: zero,
            depreciation: zero,
            interestExpense: zero,
            principalRepayment: zero,
            longTermDebt: zero,
            currentDebt: zero,
            totalCurrentAssets: zero,
            totalCurrentLiabilities: zero,
            totalAssets: zero,
            totalEquity: zero,
            totalProjectCost: zero,
          }),
        ],
      }),
    );
    const json = JSON.stringify(result);
    expect(json).not.toMatch(/NaN|Infinity/);
    expectUndefined(result.years[0]!.dscr, "UNDEFINED_ZERO_DENOMINATOR");
    expectUndefined(result.years[0]!.roi, "UNDEFINED_ZERO_DENOMINATOR");
    expectUndefined(result.years[0]!.roce, "UNDEFINED_ZERO_DENOMINATOR");
  });

  it("does not add lender approval judgments or thresholds", () => {
    const result = unwrap(
      calculateBankabilityMetricsSchedule({
        projectId: "project-metrics",
        years: [metricYear()],
      }),
    );
    expect(result).not.toHaveProperty("isBankable");
    expect(result).not.toHaveProperty("approvalStatus");
    expect(result.years[0]).not.toHaveProperty("threshold");
    expect(JSON.stringify(result)).not.toMatch(
      /GOOD|BAD|BANKABLE|NOT_BANKABLE/,
    );
  });

  it("rejects an empty schedule", () => {
    expectError(
      calculateBankabilityMetricsSchedule({
        projectId: "project-metrics",
        years: [],
      }),
      "EMPTY_METRICS_SCHEDULE",
    );
  });

  it("rejects invalid, duplicate, and non-sequential years", () => {
    expectError(
      calculateBankabilityMetricsSchedule({
        projectId: "project-metrics",
        years: [metricYear(0)],
      }),
      "INVALID_METRIC_YEAR",
    );
    expectError(
      calculateBankabilityMetricsSchedule({
        projectId: "project-metrics",
        years: [metricYear(1), metricYear(1)],
      }),
      "DUPLICATE_METRIC_YEAR",
    );
    expectError(
      calculateBankabilityMetricsSchedule({
        projectId: "project-metrics",
        years: [metricYear(1), metricYear(3)],
      }),
      "INVALID_METRIC_YEAR_SEQUENCE",
    );
  });

  it.each([
    ["revenue", "NEGATIVE_METRIC_REVENUE"],
    ["variableCosts", "NEGATIVE_VARIABLE_COSTS"],
    ["fixedCosts", "NEGATIVE_FIXED_COSTS"],
    ["depreciation", "NEGATIVE_DSCR_DEPRECIATION"],
    ["interestExpense", "NEGATIVE_DSCR_INTEREST_EXPENSE"],
    ["principalRepayment", "NEGATIVE_DSCR_PRINCIPAL_REPAYMENT"],
    ["longTermDebt", "NEGATIVE_LONG_TERM_DEBT"],
    ["currentDebt", "NEGATIVE_CURRENT_DEBT"],
    ["totalCurrentAssets", "NEGATIVE_TOTAL_CURRENT_ASSETS"],
    ["totalCurrentLiabilities", "NEGATIVE_TOTAL_CURRENT_LIABILITIES"],
    ["totalAssets", "NEGATIVE_TOTAL_ASSETS"],
    ["totalProjectCost", "NEGATIVE_TOTAL_PROJECT_COST"],
  ] as const)("rejects negative %s", (field, code) => {
    expectError(
      calculateBankabilityMetricsSchedule({
        projectId: "project-metrics",
        years: [metricYear(1, { [field]: m("-1") })],
      }),
      code,
    );
  });

  it("allows negative EBITDA, EBIT, PBT, PAT, and equity", () => {
    const result = unwrap(
      calculateBankabilityMetricsSchedule({
        projectId: "project-metrics",
        years: [
          metricYear(1, {
            ebitda: m("-10"),
            ebit: m("-20"),
            profitBeforeTax: m("-30"),
            profitAfterTax: m("-40"),
            totalEquity: m("-50"),
          }),
        ],
      }),
    );
    expect(definedValue(result.years[0]!.patMargin)).toBe("-4");
    expectUndefined(
      result.years[0]!.debtEquityRatio,
      "UNDEFINED_NEGATIVE_EQUITY",
    );
  });

  it("fails cleanly for a missing required authoritative value", () => {
    const malformed = {
      ...metricYear(),
      depreciation: undefined,
    } as unknown as BankabilityMetricsYearInput;
    expectError(
      calculateBankabilityMetricsSchedule({
        projectId: "project-metrics",
        years: [malformed],
      }),
      "MISSING_METRIC_INPUT",
    );
  });
});

describe("authoritative adapters", () => {
  it("copies every required P&L output without recalculation", () => {
    const source = calculatedProfitAndLoss();
    const adapted = unwrap(adaptProfitAndLossToMetrics(source));
    expect(adapted.years[0]).toEqual({
      year: 1,
      revenue: source.years[0]!.revenue,
      ebitda: source.years[0]!.ebitda,
      ebit: source.years[0]!.ebit,
      profitBeforeTax: source.years[0]!.profitBeforeTax,
      profitAfterTax: source.years[0]!.profitAfterTax,
      depreciation: source.years[0]!.depreciation,
      interestExpense: source.years[0]!.interestExpense,
    });
  });

  it("maps loan principal repayment only and never selects loan interest", () => {
    const loan = calculatedLoan();
    expect(loan.annualSummaries[0]!.interestCharged).toBe("50");
    expect(loan.annualSummaries[0]!.interestPaid).toBe("50");
    const adapted = unwrap(
      adaptLoanScheduleToMetricsDebtService("project-metrics", loan),
    );
    expect(adapted.years[0]).toEqual({
      year: 1,
      principalRepayment: "500",
    });
    expect(adapted.years[0]).not.toHaveProperty("interestExpense");
    expect(adapted.years[0]).not.toHaveProperty("interestCharged");
    expect(adapted.years[0]).not.toHaveProperty("interestPaid");
    expect(adapted.years[0]).not.toHaveProperty("totalDebtService");
  });

  it("copies authoritative balance-sheet totals and classified debt", () => {
    const source = calculatedBalanceSheet();
    const adapted = unwrap(adaptBalanceSheetToMetrics(source));
    expect(adapted.years[0]).toEqual({
      year: 1,
      totalCurrentAssets: source.years[0]!.totalCurrentAssets,
      totalCurrentLiabilities: source.years[0]!.totalCurrentLiabilities,
      totalAssets: source.years[0]!.totalAssets,
      totalEquity: source.years[0]!.totalEquity,
      longTermDebt: source.years[0]!.longTermLoanOutstanding,
      currentDebt: source.years[0]!.currentDebt,
    });
    expect(adapted.years[0]).not.toHaveProperty("payables");
    expect(adapted.years[0]).not.toHaveProperty("otherCurrentLiabilities");
  });

  it("rejects a malformed authoritative current-liability reconciliation", () => {
    const source = calculatedBalanceSheet();
    const malformed = {
      ...source,
      years: [
        { ...source.years[0]!, totalCurrentLiabilities: m("999") },
        source.years[1]!,
      ],
    };
    expectError(
      adaptBalanceSheetToMetrics(malformed),
      "INCONSISTENT_BALANCE_SHEET_CURRENT_LIABILITIES",
    );
  });

  it("copies authoritative total project cost", () => {
    const source = unwrap(calculateProjectCost(projectCost()));
    expect(adaptProjectCostToMetrics(source)).toEqual({
      ok: true,
      value: { projectId: "project-metrics", totalProjectCost: "1000" },
    });
  });

  it("maps projection costs only through explicit source-backed classifications", () => {
    const result = unwrap(
      adaptProjectionToBreakEvenInputs(
        calculatedProjection(),
        costClassifications(),
      ),
    );
    expect(result.years).toEqual([
      { year: 1, revenue: "1000", variableCosts: "400", fixedCosts: "350" },
      { year: 2, revenue: "1000", variableCosts: "400", fixedCosts: "350" },
    ]);
  });

  it("requires an explicit classification even for a custom expense", () => {
    const incomplete = costClassifications({
      expenses: costClassifications().expenses.filter(
        (item) => item.expenseId !== "expense-custom",
      ),
    });
    expectError(
      adaptProjectionToBreakEvenInputs(calculatedProjection(), incomplete),
      "MISSING_EXPENSE_COST_CLASSIFICATION",
    );
  });

  it("rejects duplicate, extra, and unsourced expense classifications", () => {
    const valid = costClassifications();
    expectError(
      adaptProjectionToBreakEvenInputs(calculatedProjection(), {
        ...valid,
        expenses: [...valid.expenses, valid.expenses[0]!],
      }),
      "DUPLICATE_EXPENSE_COST_CLASSIFICATION",
    );
    expectError(
      adaptProjectionToBreakEvenInputs(calculatedProjection(), {
        ...valid,
        expenses: [
          ...valid.expenses,
          {
            expenseId: "unknown",
            classification: {
              value: "FIXED",
              source: sampleUserSource,
            },
          },
        ],
      }),
      "EXTRA_EXPENSE_COST_CLASSIFICATION",
    );
    expectError(
      adaptProjectionToBreakEvenInputs(calculatedProjection(), {
        ...valid,
        expenses: [
          {
            ...valid.expenses[0]!,
            classification: {
              value: "VARIABLE",
            } as Assumption<OperatingCostClassification>,
          },
          ...valid.expenses.slice(1),
        ],
      }),
      "MISSING_EXPENSE_COST_CLASSIFICATION_SOURCE",
    );
  });
});

describe("strict metrics composition and integration", () => {
  it("composes real P&L, loan, balance-sheet, project-cost, and projection outputs", () => {
    const schedules = authoritativeSchedules();
    const composed = unwrap(composeBankabilityMetricsYearInputs(schedules));
    expect(composed[0]).toEqual({
      year: 1,
      revenue: m("1000"),
      variableCosts: m("400"),
      fixedCosts: m("350"),
      ebitda: m("250"),
      ebit: m("150"),
      profitBeforeTax: m("100"),
      profitAfterTax: m("100"),
      depreciation: m("100"),
      interestExpense: m("50"),
      principalRepayment: m("500"),
      longTermDebt: m("500"),
      currentDebt: m("0"),
      totalCurrentAssets: m("400"),
      totalCurrentLiabilities: m("200"),
      totalAssets: m("1300"),
      totalEquity: m("400"),
      totalProjectCost: m("1000"),
    });

    const result = unwrap(
      calculateBankabilityMetricsFromAuthoritativeSchedules(schedules),
    );
    expect(result.years).toHaveLength(2);
    expect(definedValue(result.years[0]!.dscr)).toBe(
      "0.4545454545454545454545454545454545454545",
    );
    expect(definedValue(result.years[1]!.dscr)).toBe(
      "0.4761904761904761904761904761904761904762",
    );
    expect(definedValue(result.averageDscr.averageDscr)).toBe(
      "0.4651162790697674418604651162790697674419",
    );
  });

  it("preserves every authoritative source value in yearly output", () => {
    const schedules = authoritativeSchedules();
    const composed = unwrap(composeBankabilityMetricsYearInputs(schedules));
    const result = unwrap(
      calculateBankabilityMetricsFromAuthoritativeSchedules(schedules),
    );
    for (const [index, input] of composed.entries()) {
      const output = result.years[index]!;
      for (const [key, value] of Object.entries(input)) {
        expect(output[key as keyof typeof output]).toBe(value);
      }
    }
  });

  it("uses authoritative P&L interest rather than charged loan interest", () => {
    const schedules = authoritativeSchedules();
    const changed = {
      ...schedules,
      profitAndLoss: {
        ...schedules.profitAndLoss,
        years: schedules.profitAndLoss.years.map((year) => ({
          ...year,
          interestExpense: m("7"),
        })),
      },
    };
    const composed = unwrap(composeBankabilityMetricsYearInputs(changed));
    expect(composed.map((year) => year.interestExpense)).toEqual(["7", "7"]);
    expect(calculatedLoan().annualSummaries[0]!.interestCharged).toBe("50");
    expect(composed[0]!.interestExpense).not.toBe(
      calculatedLoan().annualSummaries[0]!.interestCharged,
    );
  });

  it("rejects project-id mismatches", () => {
    const schedules = authoritativeSchedules();
    expectError(
      composeBankabilityMetricsYearInputs({
        ...schedules,
        projectCost: { ...schedules.projectCost, projectId: "other-project" },
      }),
      "METRICS_PROJECT_ID_MISMATCH",
    );
  });

  it("rejects missing source years instead of silently using zero", () => {
    const schedules = authoritativeSchedules();
    expectError(
      composeBankabilityMetricsYearInputs({
        ...schedules,
        debtService: {
          ...schedules.debtService,
          years: schedules.debtService.years.slice(0, 1),
        },
      }),
      "MISSING_DEBT_SERVICE_FOR_METRICS_YEAR",
    );
  });

  it("rejects extra source years", () => {
    const schedules = authoritativeSchedules();
    expectError(
      composeBankabilityMetricsYearInputs({
        ...schedules,
        debtService: {
          ...schedules.debtService,
          years: [
            ...schedules.debtService.years,
            { year: 3, principalRepayment: m("0") },
          ],
        },
      }),
      "METRICS_DEBT_SERVICE_SOURCE_YEAR_NOT_IN_PROJECTION",
    );
  });

  it("rejects duplicate source years", () => {
    const schedules = authoritativeSchedules();
    expectError(
      composeBankabilityMetricsYearInputs({
        ...schedules,
        breakEven: {
          ...schedules.breakEven,
          years: [schedules.breakEven.years[0]!, schedules.breakEven.years[0]!],
        },
      }),
      "DUPLICATE_METRICS_BREAK_EVEN_SOURCE_YEAR",
    );
  });

  it("rejects non-sequential source years", () => {
    const schedules = authoritativeSchedules();
    expectError(
      composeBankabilityMetricsYearInputs({
        ...schedules,
        balanceSheet: {
          ...schedules.balanceSheet,
          years: [...schedules.balanceSheet.years].reverse(),
        },
      }),
      "INVALID_METRICS_SOURCE_YEAR_SEQUENCE",
    );
  });

  it("rejects break-even revenue on a different basis from P&L", () => {
    const schedules = authoritativeSchedules();
    expectError(
      composeBankabilityMetricsYearInputs({
        ...schedules,
        breakEven: {
          ...schedules.breakEven,
          years: [
            { ...schedules.breakEven.years[0]!, revenue: m("999") },
            schedules.breakEven.years[1]!,
          ],
        },
      }),
      "BREAK_EVEN_REVENUE_DOES_NOT_MATCH_PROFIT_AND_LOSS",
    );
  });

  it("never returns NaN or Infinity across defined and undefined metrics", () => {
    const result = unwrap(
      calculateBankabilityMetricsFromAuthoritativeSchedules(
        authoritativeSchedules(),
      ),
    );
    expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity/);
  });
});
