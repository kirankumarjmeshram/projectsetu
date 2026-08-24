import { describe, expect, it } from "vitest";

import type {
  CashFlowFinancingInflowSchedule,
  CashFlowSchedule,
  CashFlowYear,
} from "../cash-flow/cash-flow";
import type { DepreciationSchedule } from "../depreciation/depreciation";
import type { LoanRepaymentSchedule } from "../loan/loan";
import type {
  ProfitAndLossSchedule,
  ProfitAndLossYear,
} from "../profit-and-loss/profit-and-loss";
import type { Assumption } from "../shared/assumptions";
import type { CalculationResult } from "../shared/calculation";
import {
  decimalValue,
  monetaryAmount,
  toDecimal,
  toMonetaryAmount,
} from "../shared/decimal";
import { sampleUserSource } from "../testing/domain-fixtures";
import {
  adaptCashFlowScheduleToBalanceSheetCash,
  adaptDepreciationScheduleToBalanceSheetFixedAssets,
  adaptFinancingInflowsToPromoterCapital,
  adaptLoanScheduleToBalanceSheetOutstanding,
  adaptProfitAndLossToRetainedEarnings,
  calculateBalanceSheetFromAuthoritativeSchedules,
  composeBalanceSheetYearInputs,
} from "./adapters";
import type { BalanceSheetAuthoritativeSchedules } from "./adapters";
import {
  calculateBalanceDifference,
  calculateBalanceSheetSchedule,
  calculateClosingRetainedEarnings,
  calculateNetFixedAssets,
  calculateRetainedEarningsSchedule,
  calculateTotalCurrentAssets,
  calculateTotalCurrentLiabilities,
  calculateTotalEquity,
  calculateTotalLiabilities,
} from "./calculations";
import type {
  BalanceSheetAccountingBalanceSchedule,
  BalanceSheetCashSchedule,
  BalanceSheetCompositionPolicy,
  BalanceSheetDebtClassificationSchedule,
  BalanceSheetFixedAssetSchedule,
  BalanceSheetLoanOutstandingSchedule,
  BalanceSheetLoanOutstandingYear,
  BalanceSheetProjectionInput,
  BalanceSheetPromoterCapitalSchedule,
  BalanceSheetSchedule,
  BalanceSheetYearInput,
} from "./balance-sheet";

function unwrap<TValue>(result: CalculationResult<TValue>): TValue {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.errors.map((error) => error.code).join(", "));
  }
  return result.value;
}

function assumed(value: string): Assumption<ReturnType<typeof monetaryAmount>> {
  return { value: monetaryAmount(value), source: sampleUserSource };
}

function yearInput(
  year: number,
  overrides: Partial<BalanceSheetYearInput> = {},
): BalanceSheetYearInput {
  return {
    year,
    grossFixedAssets: monetaryAmount("1000"),
    accumulatedDepreciation: monetaryAmount("200"),
    inventory: monetaryAmount("100"),
    receivables: monetaryAmount("100"),
    otherCurrentAssets: monetaryAmount("50"),
    cashAndBank: monetaryAmount("150"),
    longTermLoanOutstanding: monetaryAmount("500"),
    currentDebt: monetaryAmount("100"),
    payables: monetaryAmount("100"),
    otherCurrentLiabilities: monetaryAmount("50"),
    promoterCapital: monetaryAmount("300"),
    profitAfterTax: monetaryAmount("50"),
    retainedEarningsAdjustments: monetaryAmount("0"),
    otherEquity: monetaryAmount("0"),
    ...overrides,
  };
}

function projectionInput(
  overrides: Partial<BalanceSheetProjectionInput> = {},
): BalanceSheetProjectionInput {
  return {
    projectId: "project-balance-sheet",
    openingRetainedEarnings: assumed("100"),
    years: [yearInput(1)],
    ...overrides,
  };
}

function calculate(
  overrides: Partial<BalanceSheetProjectionInput> = {},
): BalanceSheetSchedule {
  return unwrap(calculateBalanceSheetSchedule(projectionInput(overrides)));
}

function add(values: readonly string[]): string {
  let total = toDecimal(monetaryAmount("0"));
  for (const value of values)
    total = total.plus(toDecimal(monetaryAmount(value)));
  return toMonetaryAmount(total);
}

function expectReconciliation(schedule: BalanceSheetSchedule): void {
  for (const [index, year] of schedule.years.entries()) {
    expect(
      toMonetaryAmount(
        toDecimal(year.grossFixedAssets).minus(
          toDecimal(year.accumulatedDepreciation),
        ),
      ),
    ).toBe(year.netFixedAssets);
    expect(
      add([year.currentDebt, year.payables, year.otherCurrentLiabilities]),
    ).toBe(year.totalCurrentLiabilities);
    expect(
      add([
        year.inventory,
        year.receivables,
        year.otherCurrentAssets,
        year.cashAndBank,
      ]),
    ).toBe(year.totalCurrentAssets);
    expect(add([year.netFixedAssets, year.totalCurrentAssets])).toBe(
      year.totalAssets,
    );
    expect(
      add([
        year.longTermLoanOutstanding,
        year.currentDebt,
        year.payables,
        year.otherCurrentLiabilities,
      ]),
    ).toBe(year.totalLiabilities);
    expect(
      add([
        year.openingRetainedEarnings,
        year.profitAfterTax,
        year.retainedEarningsAdjustments,
      ]),
    ).toBe(year.closingRetainedEarnings);
    expect(
      add([
        year.promoterCapital,
        year.closingRetainedEarnings,
        year.otherEquity,
      ]),
    ).toBe(year.totalEquity);
    expect(
      toMonetaryAmount(
        toDecimal(year.totalAssets)
          .minus(toDecimal(year.totalLiabilities))
          .minus(toDecimal(year.totalEquity)),
      ),
    ).toBe(year.balanceDifference);
    expect(year.isBalanced).toBe(toDecimal(year.balanceDifference).isZero());

    if (index > 0) {
      expect(year.openingRetainedEarnings).toBe(
        schedule.years[index - 1]?.closingRetainedEarnings,
      );
    }
  }
}

function profitAndLossYear(
  year: number,
  profitAfterTax = "50",
): ProfitAndLossYear {
  return {
    year,
    revenue: monetaryAmount("1000"),
    operatingExpenses: monetaryAmount("700"),
    ebitda: monetaryAmount("300"),
    depreciation: monetaryAmount("100"),
    ebit: monetaryAmount("200"),
    interestExpense: monetaryAmount("100"),
    profitBeforeTax: monetaryAmount("100"),
    taxMode: "NO_TAX",
    taxExpense: monetaryAmount("0"),
    profitAfterTax: monetaryAmount(profitAfterTax),
  };
}

function profitAndLossSchedule(
  years: readonly ProfitAndLossYear[],
  projectId = "project-balance-sheet",
): ProfitAndLossSchedule {
  return {
    projectId,
    taxConfiguration: { mode: "NO_TAX" },
    years,
    cumulativeTotals: {
      cumulativeRevenue: monetaryAmount("0"),
      cumulativeOperatingExpenses: monetaryAmount("0"),
      cumulativeEbitda: monetaryAmount("0"),
      cumulativeDepreciation: monetaryAmount("0"),
      cumulativeEbit: monetaryAmount("0"),
      cumulativeInterestExpense: monetaryAmount("0"),
      cumulativeProfitBeforeTax: monetaryAmount("0"),
      cumulativeTaxExpense: monetaryAmount("0"),
      cumulativeProfitAfterTax: monetaryAmount("0"),
    },
  };
}

function fixedAssetSchedule(
  rows: readonly {
    readonly year: number;
    readonly gross: string;
    readonly accumulated: string;
    readonly net?: string;
  }[],
  projectId = "project-balance-sheet",
): BalanceSheetFixedAssetSchedule {
  return {
    projectId,
    years: rows.map((row) => ({
      year: row.year,
      grossFixedAssets: monetaryAmount(row.gross),
      accumulatedDepreciation: monetaryAmount(row.accumulated),
      authoritativeNetFixedAssets: monetaryAmount(
        row.net ??
          toMonetaryAmount(
            toDecimal(monetaryAmount(row.gross)).minus(
              toDecimal(monetaryAmount(row.accumulated)),
            ),
          ),
      ),
    })),
  };
}

function cashSchedule(
  rows: readonly { readonly year: number; readonly cash: string }[],
  projectId = "project-balance-sheet",
): BalanceSheetCashSchedule {
  return {
    projectId,
    years: rows.map((row) => ({
      year: row.year,
      cashAndBank: monetaryAmount(row.cash),
    })),
  };
}

function loanOutstandingSchedule(
  rows: readonly { readonly year: number; readonly total: string }[],
  projectId = "project-balance-sheet",
): BalanceSheetLoanOutstandingSchedule {
  return {
    projectId,
    years: rows.map((row) => ({
      year: row.year,
      totalLoanOutstanding: monetaryAmount(row.total),
    })),
  };
}

function debtClassificationSchedule(
  rows: readonly {
    readonly year: number;
    readonly longTerm: string;
    readonly current: string;
  }[],
  projectId = "project-balance-sheet",
): BalanceSheetDebtClassificationSchedule {
  return {
    projectId,
    years: rows.map((row) => ({
      year: row.year,
      longTermLoanOutstanding: assumed(row.longTerm),
      currentDebt: assumed(row.current),
    })),
  };
}

function promoterCapitalSchedule(
  rows: readonly {
    readonly year: number;
    readonly opening: string;
    readonly contribution: string;
    readonly closing: string;
  }[],
  projectId = "project-balance-sheet",
): BalanceSheetPromoterCapitalSchedule {
  return {
    projectId,
    openingPromoterCapital: assumed(rows[0]?.opening ?? "0"),
    years: rows.map((row) => ({
      year: row.year,
      openingPromoterCapital: monetaryAmount(row.opening),
      promoterContribution: monetaryAmount(row.contribution),
      closingPromoterCapital: monetaryAmount(row.closing),
    })),
  };
}

function accountingBalanceSchedule(
  rows: readonly {
    readonly year: number;
    readonly inventory?: string;
    readonly receivables?: string;
    readonly otherCurrentAssets?: string;
    readonly payables?: string;
    readonly otherCurrentLiabilities?: string;
    readonly adjustments?: string;
    readonly otherEquity?: string;
  }[],
  projectId = "project-balance-sheet",
): BalanceSheetAccountingBalanceSchedule {
  return {
    projectId,
    years: rows.map((row) => ({
      year: row.year,
      inventory: assumed(row.inventory ?? "100"),
      receivables: assumed(row.receivables ?? "100"),
      otherCurrentAssets: assumed(row.otherCurrentAssets ?? "50"),
      payables: assumed(row.payables ?? "100"),
      otherCurrentLiabilities: assumed(row.otherCurrentLiabilities ?? "50"),
      retainedEarningsAdjustments: assumed(row.adjustments ?? "0"),
      otherEquity: assumed(row.otherEquity ?? "0"),
    })),
  };
}

function authoritativeSchedules(
  overrides: Partial<BalanceSheetAuthoritativeSchedules> = {},
): BalanceSheetAuthoritativeSchedules {
  return {
    profitAndLoss: profitAndLossSchedule([profitAndLossYear(1)]),
    fixedAssets: fixedAssetSchedule([
      { year: 1, gross: "1000", accumulated: "200" },
    ]),
    cash: cashSchedule([{ year: 1, cash: "150" }]),
    loanOutstanding: loanOutstandingSchedule([{ year: 1, total: "600" }]),
    debtClassification: debtClassificationSchedule([
      { year: 1, longTerm: "500", current: "100" },
    ]),
    promoterCapital: promoterCapitalSchedule([
      { year: 1, opening: "250", contribution: "50", closing: "300" },
    ]),
    accountingBalances: accountingBalanceSchedule([{ year: 1 }]),
    ...overrides,
  };
}

const explicitZeroPolicy: BalanceSheetCompositionPolicy = {
  missingFixedAssets: "USE_EXPLICIT_ZERO",
  missingCash: "USE_EXPLICIT_ZERO",
  missingLoanOutstanding: "USE_EXPLICIT_ZERO",
  missingDebtClassification: "USE_EXPLICIT_ZERO",
  missingPromoterCapital: "USE_EXPLICIT_ZERO",
  missingAccountingBalances: "USE_EXPLICIT_ZERO",
};

function depreciationScheduleFixture(): DepreciationSchedule {
  return {
    projectId: "project-balance-sheet",
    projectionPeriodYears: 1,
    assetSchedules: [],
    yearlySummaries: [
      {
        year: 1,
        openingGrossFixedAssets: monetaryAmount("1000"),
        additions: monetaryAmount("0"),
        depreciation: monetaryAmount("100"),
        accumulatedDepreciation: monetaryAmount("200"),
        closingGrossFixedAssets: monetaryAmount("1000"),
        closingNetCarryingValue: monetaryAmount("800"),
      },
    ],
  };
}

function cashFlowYearFixture(closingCash = "150"): CashFlowYear {
  return {
    year: 1,
    openingCash: monetaryAmount("0"),
    profitAfterTax: monetaryAmount("50"),
    depreciationAddBack: monetaryAmount("100"),
    changeInNetWorkingCapital: monetaryAmount("0"),
    operatingCashFlow: monetaryAmount("150"),
    capitalExpenditure: monetaryAmount("0"),
    investingCashFlow: monetaryAmount("0"),
    promoterContribution: monetaryAmount("50"),
    loanDisbursement: monetaryAmount("600"),
    principalRepayment: monetaryAmount("0"),
    cashInterestPaid: monetaryAmount("0"),
    financingCashFlow: monetaryAmount("650"),
    netCashMovement: monetaryAmount(closingCash),
    closingCash: monetaryAmount(closingCash),
    cumulativeOperatingCashFlow: monetaryAmount("150"),
    cumulativeInvestingCashFlow: monetaryAmount("0"),
    cumulativeFinancingCashFlow: monetaryAmount("650"),
    cumulativeNetCashMovement: monetaryAmount(closingCash),
  };
}

function cashFlowScheduleFixture(closingCash = "150"): CashFlowSchedule {
  const year = cashFlowYearFixture(closingCash);
  return {
    projectId: "project-balance-sheet",
    initialOpeningCash: assumed("0"),
    years: [year],
    cumulativeTotals: {
      cumulativeOperatingCashFlow: year.cumulativeOperatingCashFlow,
      cumulativeInvestingCashFlow: year.cumulativeInvestingCashFlow,
      cumulativeFinancingCashFlow: year.cumulativeFinancingCashFlow,
      cumulativeNetCashMovement: year.cumulativeNetCashMovement,
      endingCash: year.closingCash,
    },
  };
}

function loanScheduleFixture(closingPrincipal = "600"): LoanRepaymentSchedule {
  return {
    loanId: "loan-balance-sheet",
    repaymentMethod: "EQUAL_PRINCIPAL",
    repaymentFrequency: "YEARLY",
    periodicInterestRate: decimalValue("0.1"),
    periods: [],
    summary: {
      originalPrincipal: monetaryAmount("600"),
      totalPrincipalRepaid: monetaryAmount("0"),
      totalInterestCharged: monetaryAmount("60"),
      totalInterestPaid: monetaryAmount("60"),
      totalRepayments: monetaryAmount("60"),
      totalCapitalizedInterest: monetaryAmount("0"),
      endingPrincipal: monetaryAmount(closingPrincipal),
      endingAccruedInterest: monetaryAmount("0"),
      numberOfSchedulePeriods: 1,
      numberOfAmortizationPeriods: 1,
    },
    annualSummaries: [
      {
        projectionYear: 1,
        openingPrincipal: monetaryAmount("600"),
        principalRepaid: monetaryAmount("0"),
        interestCharged: monetaryAmount("60"),
        interestPaid: monetaryAmount("60"),
        totalDebtService: monetaryAmount("60"),
        closingPrincipal: monetaryAmount(closingPrincipal),
        openingAccruedInterest: monetaryAmount("0"),
        closingAccruedInterest: monetaryAmount("0"),
      },
    ],
  };
}

describe("balance-sheet arithmetic", () => {
  it("derives net fixed assets without accepting a third balance", () => {
    expect(
      unwrap(
        calculateNetFixedAssets(monetaryAmount("1000"), monetaryAmount("225")),
      ),
    ).toBe("775");
  });

  it("calculates total current assets exactly", () => {
    expect(
      calculateTotalCurrentAssets(
        monetaryAmount("100"),
        monetaryAmount("200"),
        monetaryAmount("50"),
        monetaryAmount("25"),
      ),
    ).toBe("375");
  });

  it("calculates total liabilities exactly", () => {
    expect(
      calculateTotalLiabilities(
        monetaryAmount("500"),
        monetaryAmount("100"),
        monetaryAmount("75"),
        monetaryAmount("25"),
      ),
    ).toBe("700");
  });

  it("calculates retained earnings and signed total equity", () => {
    const retained = calculateClosingRetainedEarnings(
      monetaryAmount("100"),
      monetaryAmount("-40"),
      monetaryAmount("10"),
    );
    expect(retained).toBe("70");
    expect(
      calculateTotalEquity(
        monetaryAmount("50"),
        retained,
        monetaryAmount("-150"),
      ),
    ).toBe("-30");
  });

  it("calculates total current liabilities independently of long-term debt", () => {
    expect(
      calculateTotalCurrentLiabilities(
        monetaryAmount("100"),
        monetaryAmount("40"),
        monetaryAmount("10"),
      ),
    ).toBe("150");
  });

  it("calculates the signed balance difference exactly", () => {
    expect(
      calculateBalanceDifference(
        monetaryAmount("1000000"),
        monetaryAmount("600000"),
        monetaryAmount("350000"),
      ),
    ).toBe("50000");
  });
});

describe("balance-sheet schedules", () => {
  it("calculates a one-year balanced balance sheet", () => {
    const result = calculate();
    expect(result.years[0]).toMatchObject({
      netFixedAssets: "800",
      totalCurrentAssets: "400",
      totalAssets: "1200",
      totalCurrentLiabilities: "250",
      totalLiabilities: "750",
      closingRetainedEarnings: "150",
      totalEquity: "450",
      balanceDifference: "0",
      isBalanced: true,
    });
    expectReconciliation(result);
  });

  it("returns a valid intentionally unbalanced statement without a plug", () => {
    const result = calculate({
      years: [yearInput(1, { cashAndBank: monetaryAmount("200") })],
    });
    expect(result.years[0]).toMatchObject({
      cashAndBank: "200",
      totalAssets: "1250",
      totalLiabilities: "750",
      totalEquity: "450",
      balanceDifference: "50",
      isBalanced: false,
    });
    expect(result.years[0]).not.toHaveProperty("plugAccount");
    expect(result.years[0]).not.toHaveProperty("balancingEquity");
    expect(result.years[0]).not.toHaveProperty("overdraft");
    expectReconciliation(result);
  });

  it("calculates a balanced multi-year schedule with retained-earnings continuity", () => {
    const result = calculate({
      years: [
        yearInput(1),
        yearInput(2, {
          grossFixedAssets: monetaryAmount("1200"),
          accumulatedDepreciation: monetaryAmount("300"),
          inventory: monetaryAmount("120"),
          receivables: monetaryAmount("130"),
          otherCurrentAssets: monetaryAmount("50"),
          cashAndBank: monetaryAmount("200"),
          longTermLoanOutstanding: monetaryAmount("400"),
          currentDebt: monetaryAmount("100"),
          payables: monetaryAmount("120"),
          otherCurrentLiabilities: monetaryAmount("30"),
          promoterCapital: monetaryAmount("500"),
          profitAfterTax: monetaryAmount("50"),
          otherEquity: monetaryAmount("50"),
        }),
      ],
    });
    expect(result.years.map((year) => year.isBalanced)).toEqual([true, true]);
    expect(result.years[1]).toMatchObject({
      openingRetainedEarnings: "150",
      closingRetainedEarnings: "200",
      totalAssets: "1400",
      totalLiabilities: "650",
      totalEquity: "750",
    });
    expectReconciliation(result);
  });

  it("preserves an unbalanced year inside a valid multi-year schedule", () => {
    const result = calculate({ years: [yearInput(1), yearInput(2)] });
    expect(result.years[0]?.isBalanced).toBe(true);
    expect(result.years[1]).toMatchObject({
      openingRetainedEarnings: "150",
      closingRetainedEarnings: "200",
      balanceDifference: "-50",
      isBalanced: false,
    });
    expectReconciliation(result);
  });

  it("accepts zero fixed assets, cash, loans, and equity", () => {
    const zero = monetaryAmount("0");
    const result = calculate({
      openingRetainedEarnings: assumed("0"),
      years: [
        yearInput(1, {
          grossFixedAssets: zero,
          accumulatedDepreciation: zero,
          inventory: zero,
          receivables: zero,
          otherCurrentAssets: zero,
          cashAndBank: zero,
          longTermLoanOutstanding: zero,
          currentDebt: zero,
          payables: zero,
          otherCurrentLiabilities: zero,
          promoterCapital: zero,
          profitAfterTax: zero,
          retainedEarningsAdjustments: zero,
          otherEquity: zero,
        }),
      ],
    });
    expect(result.years[0]).toMatchObject({
      netFixedAssets: "0",
      totalAssets: "0",
      totalLiabilities: "0",
      totalEquity: "0",
      balanceDifference: "0",
      isBalanced: true,
    });
  });

  it("allows negative PAT, accumulated losses, and negative total equity", () => {
    const zero = monetaryAmount("0");
    const result = calculate({
      openingRetainedEarnings: assumed("-50"),
      years: [
        yearInput(1, {
          grossFixedAssets: zero,
          accumulatedDepreciation: zero,
          inventory: zero,
          receivables: zero,
          otherCurrentAssets: zero,
          cashAndBank: zero,
          longTermLoanOutstanding: zero,
          currentDebt: zero,
          payables: zero,
          otherCurrentLiabilities: zero,
          promoterCapital: zero,
          profitAfterTax: monetaryAmount("-25"),
          retainedEarningsAdjustments: zero,
          otherEquity: zero,
        }),
      ],
    });
    expect(result.years[0]).toMatchObject({
      closingRetainedEarnings: "-75",
      totalEquity: "-75",
      balanceDifference: "75",
      isBalanced: false,
    });
  });

  it("applies explicit retained-earnings adjustments", () => {
    const result = calculate({
      years: [
        yearInput(1, {
          profitAfterTax: monetaryAmount("40"),
          retainedEarningsAdjustments: monetaryAmount("-10"),
        }),
      ],
    });
    expect(result.years[0]).toMatchObject({
      openingRetainedEarnings: "100",
      profitAfterTax: "40",
      retainedEarningsAdjustments: "-10",
      closingRetainedEarnings: "130",
    });
  });

  it("preserves Decimal.js precision without intermediate rounding", () => {
    const result = calculate({
      openingRetainedEarnings: assumed("0.1"),
      years: [
        yearInput(1, {
          grossFixedAssets: monetaryAmount("0.3"),
          accumulatedDepreciation: monetaryAmount("0.1"),
          inventory: monetaryAmount("0.1"),
          receivables: monetaryAmount("0.2"),
          otherCurrentAssets: monetaryAmount("0.3"),
          cashAndBank: monetaryAmount("0.4"),
          longTermLoanOutstanding: monetaryAmount("0.4"),
          currentDebt: monetaryAmount("0.1"),
          payables: monetaryAmount("0.2"),
          otherCurrentLiabilities: monetaryAmount("0.1"),
          promoterCapital: monetaryAmount("0.1"),
          profitAfterTax: monetaryAmount("0.2"),
          retainedEarningsAdjustments: monetaryAmount("0"),
          otherEquity: monetaryAmount("0"),
        }),
      ],
    });
    expect(result.years[0]).toMatchObject({
      netFixedAssets: "0.2",
      totalCurrentAssets: "1",
      totalAssets: "1.2",
      totalLiabilities: "0.8",
      closingRetainedEarnings: "0.3",
      totalEquity: "0.4",
      balanceDifference: "0",
      isBalanced: true,
    });
  });

  it("does not expose cumulative totals for point-in-time balances", () => {
    const result = calculate();
    expect(result).not.toHaveProperty("cumulativeTotals");
    expect(result.years[0]).not.toHaveProperty("cumulativeAssets");
    expect(result.years[0]).not.toHaveProperty("cumulativeCash");
    expect(result.years[0]).not.toHaveProperty("cumulativeLoanOutstanding");
  });
});

describe("retained-earnings roll-forward", () => {
  it("rolls positive and negative PAT through exact yearly continuity", () => {
    const result = unwrap(
      calculateRetainedEarningsSchedule({
        projectId: "project-balance-sheet",
        openingRetainedEarnings: assumed("100000"),
        years: [
          {
            year: 1,
            profitAfterTax: monetaryAmount("50000"),
            retainedEarningsAdjustments: monetaryAmount("0"),
          },
          {
            year: 2,
            profitAfterTax: monetaryAmount("-20000"),
            retainedEarningsAdjustments: monetaryAmount("0"),
          },
          {
            year: 3,
            profitAfterTax: monetaryAmount("70000"),
            retainedEarningsAdjustments: monetaryAmount("0"),
          },
        ],
      }),
    );
    expect(result.years).toEqual([
      {
        year: 1,
        openingRetainedEarnings: "100000",
        profitAfterTax: "50000",
        retainedEarningsAdjustments: "0",
        closingRetainedEarnings: "150000",
      },
      {
        year: 2,
        openingRetainedEarnings: "150000",
        profitAfterTax: "-20000",
        retainedEarningsAdjustments: "0",
        closingRetainedEarnings: "130000",
      },
      {
        year: 3,
        openingRetainedEarnings: "130000",
        profitAfterTax: "70000",
        retainedEarningsAdjustments: "0",
        closingRetainedEarnings: "200000",
      },
    ]);
  });

  it("requires a source-backed opening retained-earnings balance", () => {
    const result = calculateRetainedEarningsSchedule({
      projectId: "project-balance-sheet",
      openingRetainedEarnings: undefined as never,
      years: [
        {
          year: 1,
          profitAfterTax: monetaryAmount("0"),
          retainedEarningsAdjustments: monetaryAmount("0"),
        },
      ],
    });
    expect(result).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({
          code: "MISSING_OPENING_RETAINED_EARNINGS",
        }),
      ],
    });
  });
});

describe("balance-sheet validation", () => {
  it.each([0, -1, 1.5])("rejects invalid year %s", (year) => {
    const result = calculateBalanceSheetSchedule(
      projectionInput({ years: [yearInput(year)] }),
    );
    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "INVALID_BALANCE_SHEET_YEAR" }),
      ]),
    });
  });

  it("rejects duplicate and non-sequential years", () => {
    const duplicate = calculateBalanceSheetSchedule(
      projectionInput({ years: [yearInput(1), yearInput(1)] }),
    );
    const nonSequential = calculateBalanceSheetSchedule(
      projectionInput({ years: [yearInput(1), yearInput(3)] }),
    );
    expect(duplicate).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "DUPLICATE_BALANCE_SHEET_YEAR" }),
      ]),
    });
    expect(nonSequential).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          code: "INVALID_BALANCE_SHEET_YEAR_SEQUENCE",
        }),
      ]),
    });
  });

  it("rejects an empty schedule", () => {
    const result = calculateBalanceSheetSchedule(
      projectionInput({ years: [] }),
    );
    expect(result).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({ code: "EMPTY_BALANCE_SHEET_SCHEDULE" }),
      ],
    });
  });

  it.each([
    ["grossFixedAssets", "NEGATIVE_GROSS_FIXED_ASSETS"],
    ["accumulatedDepreciation", "NEGATIVE_ACCUMULATED_DEPRECIATION"],
    ["inventory", "NEGATIVE_INVENTORY"],
    ["receivables", "NEGATIVE_RECEIVABLES"],
    ["otherCurrentAssets", "NEGATIVE_OTHER_CURRENT_ASSETS"],
    ["cashAndBank", "NEGATIVE_BALANCE_SHEET_CASH"],
    ["longTermLoanOutstanding", "NEGATIVE_LONG_TERM_LOAN"],
    ["currentDebt", "NEGATIVE_CURRENT_DEBT"],
    ["payables", "NEGATIVE_PAYABLES"],
    ["otherCurrentLiabilities", "NEGATIVE_OTHER_CURRENT_LIABILITIES"],
    ["promoterCapital", "NEGATIVE_PROMOTER_CAPITAL_BALANCE"],
  ] as const)("rejects negative %s", (field, code) => {
    const result = calculateBalanceSheetSchedule(
      projectionInput({
        years: [yearInput(1, { [field]: monetaryAmount("-0.01") })],
      }),
    );
    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([expect.objectContaining({ code })]),
    });
  });

  it("rejects accumulated depreciation over gross fixed assets", () => {
    const result = calculateBalanceSheetSchedule(
      projectionInput({
        years: [
          yearInput(1, {
            grossFixedAssets: monetaryAmount("100"),
            accumulatedDepreciation: monetaryAmount("101"),
          }),
        ],
      }),
    );
    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          code: "ACCUMULATED_DEPRECIATION_EXCEEDS_GROSS_ASSETS",
        }),
      ]),
    });
  });

  it("rejects a missing required normalized value", () => {
    const malformed = {
      ...yearInput(1),
      inventory: undefined,
    } as unknown as BalanceSheetYearInput;
    const result = calculateBalanceSheetSchedule(
      projectionInput({ years: [malformed] }),
    );
    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "MISSING_BALANCE_SHEET_VALUE" }),
      ]),
    });
  });
});

describe("balance-sheet upstream adapters", () => {
  it("maps only reconciled depreciation-engine closing balances", () => {
    const result = unwrap(
      adaptDepreciationScheduleToBalanceSheetFixedAssets(
        depreciationScheduleFixture(),
      ),
    );
    expect(result.years).toEqual([
      {
        year: 1,
        grossFixedAssets: "1000",
        accumulatedDepreciation: "200",
        authoritativeNetFixedAssets: "800",
      },
    ]);
    expect(result.years[0]).not.toHaveProperty("depreciation");
    expect(result.years[0]).not.toHaveProperty("additions");
  });

  it("rejects inconsistent depreciation-engine closing balances", () => {
    const schedule = depreciationScheduleFixture();
    const malformed: DepreciationSchedule = {
      ...schedule,
      yearlySummaries: [
        {
          ...schedule.yearlySummaries[0]!,
          closingNetCarryingValue: monetaryAmount("801"),
        },
      ],
    };
    const result =
      adaptDepreciationScheduleToBalanceSheetFixedAssets(malformed);
    expect(result).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({
          code: "INCONSISTENT_DEPRECIATION_SOURCE_BALANCES",
        }),
      ],
    });
  });

  it("rejects depreciation balances whose accumulated amount exceeds gross assets", () => {
    const schedule = depreciationScheduleFixture();
    const result = adaptDepreciationScheduleToBalanceSheetFixedAssets({
      ...schedule,
      yearlySummaries: [
        {
          ...schedule.yearlySummaries[0]!,
          closingGrossFixedAssets: monetaryAmount("100"),
          accumulatedDepreciation: monetaryAmount("200"),
          closingNetCarryingValue: monetaryAmount("-100"),
        },
      ],
    });
    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          code: "DEPRECIATION_SOURCE_ACCUMULATED_EXCEEDS_GROSS_ASSETS",
        }),
      ]),
    });
  });

  it("copies positive and zero cash-flow closing cash without recalculating it", () => {
    expect(
      unwrap(
        adaptCashFlowScheduleToBalanceSheetCash(cashFlowScheduleFixture("150")),
      ).years[0],
    ).toEqual({ year: 1, cashAndBank: "150" });
    expect(
      unwrap(
        adaptCashFlowScheduleToBalanceSheetCash(cashFlowScheduleFixture("0")),
      ).years[0],
    ).toEqual({ year: 1, cashAndBank: "0" });
  });

  it("rejects negative cash until financing classification is explicit", () => {
    const result = adaptCashFlowScheduleToBalanceSheetCash(
      cashFlowScheduleFixture("-25"),
    );
    expect(result).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({
          code: "NEGATIVE_CASH_REQUIRES_EXPLICIT_FINANCING_CLASSIFICATION",
        }),
      ],
    });
  });

  it("maps only authoritative loan closing principal", () => {
    const result = unwrap(
      adaptLoanScheduleToBalanceSheetOutstanding(
        "project-balance-sheet",
        loanScheduleFixture("600"),
      ),
    );
    expect(result.years).toEqual([{ year: 1, totalLoanOutstanding: "600" }]);
    expect(result.years[0]).not.toHaveProperty("principalRepaid");
    expect(result.years[0]).not.toHaveProperty("interestCharged");
    expect(result.years[0]).not.toHaveProperty("interestPaid");
  });

  it("allows an empty zero-loan schedule for explicit-zero composition", () => {
    const schedule = loanScheduleFixture("0");
    const result = unwrap(
      adaptLoanScheduleToBalanceSheetOutstanding("project-balance-sheet", {
        ...schedule,
        annualSummaries: [],
      }),
    );
    expect(result.years).toEqual([]);
  });

  it("forbids repayment and interest fields at the loan-balance boundary", () => {
    const loanLike = {
      year: 1,
      totalLoanOutstanding: monetaryAmount("600"),
      principalRepayment: monetaryAmount("100"),
      interestExpense: monetaryAmount("60"),
      interestPaid: monetaryAmount("60"),
    };
    // @ts-expect-error Flow and expense fields are forbidden at this boundary.
    const rejected: BalanceSheetLoanOutstandingYear = loanLike;
    expect(rejected.totalLoanOutstanding).toBe("600");
  });

  it("rolls promoter contributions into point-in-time promoter capital", () => {
    const inflows: CashFlowFinancingInflowSchedule = {
      projectId: "project-balance-sheet",
      years: [
        {
          year: 1,
          promoterContribution: monetaryAmount("500000"),
          loanDisbursement: monetaryAmount("900000"),
        },
        {
          year: 2,
          promoterContribution: monetaryAmount("100000"),
          loanDisbursement: monetaryAmount("0"),
        },
        {
          year: 3,
          promoterContribution: monetaryAmount("0"),
          loanDisbursement: monetaryAmount("0"),
        },
      ],
    };
    const result = unwrap(
      adaptFinancingInflowsToPromoterCapital(assumed("0"), inflows),
    );
    expect(result.years).toEqual([
      {
        year: 1,
        openingPromoterCapital: "0",
        promoterContribution: "500000",
        closingPromoterCapital: "500000",
      },
      {
        year: 2,
        openingPromoterCapital: "500000",
        promoterContribution: "100000",
        closingPromoterCapital: "600000",
      },
      {
        year: 3,
        openingPromoterCapital: "600000",
        promoterContribution: "0",
        closingPromoterCapital: "600000",
      },
    ]);
    expect(result.years[0]?.closingPromoterCapital).not.toBe("1400000");
  });

  it("supports non-zero opening promoter capital", () => {
    const result = unwrap(
      adaptFinancingInflowsToPromoterCapital(assumed("250"), {
        projectId: "project-balance-sheet",
        years: [
          {
            year: 1,
            promoterContribution: monetaryAmount("50"),
            loanDisbursement: monetaryAmount("600"),
          },
        ],
      }),
    );
    expect(result.years[0]).toMatchObject({
      openingPromoterCapital: "250",
      closingPromoterCapital: "300",
    });
  });

  it("maps authoritative P&L PAT into retained earnings without recalculation", () => {
    const result = unwrap(
      adaptProfitAndLossToRetainedEarnings(
        profitAndLossSchedule([
          profitAndLossYear(1, "50"),
          profitAndLossYear(2, "-20"),
        ]),
        assumed("100"),
        accountingBalanceSchedule([
          { year: 1, adjustments: "0" },
          { year: 2, adjustments: "0" },
        ]),
      ),
    );
    expect(result.years.map((year) => year.closingRetainedEarnings)).toEqual([
      "150",
      "130",
    ]);
  });
});

describe("balance-sheet authoritative composition", () => {
  it("combines authoritative engines and derives only balance-sheet identities", () => {
    const fixedAssets = unwrap(
      adaptDepreciationScheduleToBalanceSheetFixedAssets(
        depreciationScheduleFixture(),
      ),
    );
    const cash = unwrap(
      adaptCashFlowScheduleToBalanceSheetCash(cashFlowScheduleFixture()),
    );
    const loanOutstanding = unwrap(
      adaptLoanScheduleToBalanceSheetOutstanding(
        "project-balance-sheet",
        loanScheduleFixture(),
      ),
    );
    const promoterCapital = unwrap(
      adaptFinancingInflowsToPromoterCapital(assumed("250"), {
        projectId: "project-balance-sheet",
        years: [
          {
            year: 1,
            promoterContribution: monetaryAmount("50"),
            loanDisbursement: monetaryAmount("600"),
          },
        ],
      }),
    );
    const schedules: BalanceSheetAuthoritativeSchedules = {
      profitAndLoss: profitAndLossSchedule([profitAndLossYear(1, "50")]),
      fixedAssets,
      cash,
      loanOutstanding,
      debtClassification: debtClassificationSchedule([
        { year: 1, longTerm: "500", current: "100" },
      ]),
      promoterCapital,
      accountingBalances: accountingBalanceSchedule([{ year: 1 }]),
    };
    const result = unwrap(
      calculateBalanceSheetFromAuthoritativeSchedules(
        schedules,
        assumed("100"),
      ),
    );
    expect(result.years[0]).toMatchObject({
      grossFixedAssets: "1000",
      accumulatedDepreciation: "200",
      netFixedAssets: "800",
      cashAndBank: "150",
      longTermLoanOutstanding: "500",
      currentDebt: "100",
      promoterCapital: "300",
      profitAfterTax: "50",
      closingRetainedEarnings: "150",
      balanceDifference: "0",
      isBalanced: true,
    });
    expect(result.years[0]).not.toHaveProperty("revenue");
    expect(result.years[0]).not.toHaveProperty("operatingExpenses");
    expect(result.years[0]).not.toHaveProperty("depreciationExpense");
    expect(result.years[0]).not.toHaveProperty("principalRepayment");
    expect(result.years[0]).not.toHaveProperty("plugAccount");
    expectReconciliation(result);
  });

  it("copies normalized values into the core input exactly", () => {
    const result = unwrap(
      composeBalanceSheetYearInputs(authoritativeSchedules()),
    );
    expect(result).toEqual([yearInput(1)]);
  });

  it("rejects project-ID mismatch", () => {
    const result = composeBalanceSheetYearInputs(
      authoritativeSchedules({
        cash: cashSchedule([{ year: 1, cash: "150" }], "different-project"),
      }),
    );
    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "BALANCE_SHEET_PROJECT_ID_MISMATCH" }),
      ]),
    });
  });

  it("rejects missing sources under strict composition", () => {
    const result = composeBalanceSheetYearInputs(
      authoritativeSchedules({
        fixedAssets: fixedAssetSchedule([]),
        cash: cashSchedule([]),
        loanOutstanding: loanOutstandingSchedule([]),
        debtClassification: debtClassificationSchedule([]),
        promoterCapital: promoterCapitalSchedule([]),
        accountingBalances: accountingBalanceSchedule([]),
      }),
    );
    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          code: "MISSING_FIXED_ASSETS_FOR_BALANCE_SHEET_YEAR",
        }),
        expect.objectContaining({
          code: "MISSING_CASH_FOR_BALANCE_SHEET_YEAR",
        }),
        expect.objectContaining({
          code: "MISSING_LOAN_OUTSTANDING_FOR_BALANCE_SHEET_YEAR",
        }),
        expect.objectContaining({
          code: "MISSING_DEBT_CLASSIFICATION_FOR_BALANCE_SHEET_YEAR",
        }),
        expect.objectContaining({
          code: "MISSING_PROMOTER_CAPITAL_FOR_BALANCE_SHEET_YEAR",
        }),
        expect.objectContaining({
          code: "MISSING_ACCOUNTING_BALANCES_FOR_BALANCE_SHEET_YEAR",
        }),
      ]),
    });
  });

  it("uses zero for missing sources only under USE_EXPLICIT_ZERO", () => {
    const result = unwrap(
      composeBalanceSheetYearInputs(
        authoritativeSchedules({
          profitAndLoss: profitAndLossSchedule([profitAndLossYear(1, "0")]),
          fixedAssets: fixedAssetSchedule([]),
          cash: cashSchedule([]),
          loanOutstanding: loanOutstandingSchedule([]),
          debtClassification: debtClassificationSchedule([]),
          promoterCapital: promoterCapitalSchedule([]),
          accountingBalances: accountingBalanceSchedule([]),
        }),
        explicitZeroPolicy,
      ),
    );
    expect(result).toEqual([
      yearInput(1, {
        grossFixedAssets: monetaryAmount("0"),
        accumulatedDepreciation: monetaryAmount("0"),
        inventory: monetaryAmount("0"),
        receivables: monetaryAmount("0"),
        otherCurrentAssets: monetaryAmount("0"),
        cashAndBank: monetaryAmount("0"),
        longTermLoanOutstanding: monetaryAmount("0"),
        currentDebt: monetaryAmount("0"),
        payables: monetaryAmount("0"),
        otherCurrentLiabilities: monetaryAmount("0"),
        promoterCapital: monetaryAmount("0"),
        profitAfterTax: monetaryAmount("0"),
        retainedEarningsAdjustments: monetaryAmount("0"),
        otherEquity: monetaryAmount("0"),
      }),
    ]);
  });

  it("accepts explicitly supplied numeric zero under strict composition", () => {
    const zeroSchedules = authoritativeSchedules({
      profitAndLoss: profitAndLossSchedule([profitAndLossYear(1, "0")]),
      fixedAssets: fixedAssetSchedule([
        { year: 1, gross: "0", accumulated: "0" },
      ]),
      cash: cashSchedule([{ year: 1, cash: "0" }]),
      loanOutstanding: loanOutstandingSchedule([{ year: 1, total: "0" }]),
      debtClassification: debtClassificationSchedule([
        { year: 1, longTerm: "0", current: "0" },
      ]),
      promoterCapital: promoterCapitalSchedule([
        { year: 1, opening: "0", contribution: "0", closing: "0" },
      ]),
      accountingBalances: accountingBalanceSchedule([
        {
          year: 1,
          inventory: "0",
          receivables: "0",
          otherCurrentAssets: "0",
          payables: "0",
          otherCurrentLiabilities: "0",
          adjustments: "0",
          otherEquity: "0",
        },
      ]),
    });
    expect(unwrap(composeBalanceSheetYearInputs(zeroSchedules))[0]).toEqual(
      yearInput(1, {
        grossFixedAssets: monetaryAmount("0"),
        accumulatedDepreciation: monetaryAmount("0"),
        inventory: monetaryAmount("0"),
        receivables: monetaryAmount("0"),
        otherCurrentAssets: monetaryAmount("0"),
        cashAndBank: monetaryAmount("0"),
        longTermLoanOutstanding: monetaryAmount("0"),
        currentDebt: monetaryAmount("0"),
        payables: monetaryAmount("0"),
        otherCurrentLiabilities: monetaryAmount("0"),
        promoterCapital: monetaryAmount("0"),
        profitAfterTax: monetaryAmount("0"),
        retainedEarningsAdjustments: monetaryAmount("0"),
        otherEquity: monetaryAmount("0"),
      }),
    );
  });

  it("rejects debt classification that double-counts closing principal", () => {
    const result = composeBalanceSheetYearInputs(
      authoritativeSchedules({
        loanOutstanding: loanOutstandingSchedule([{ year: 1, total: "600" }]),
        debtClassification: debtClassificationSchedule([
          { year: 1, longTerm: "600", current: "100" },
        ]),
      }),
    );
    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          code: "DEBT_CLASSIFICATION_DOES_NOT_RECONCILE",
        }),
      ]),
    });
  });

  it("rejects a promoter-capital schedule that breaks its roll-forward", () => {
    const result = composeBalanceSheetYearInputs(
      authoritativeSchedules({
        promoterCapital: promoterCapitalSchedule([
          { year: 1, opening: "250", contribution: "50", closing: "350" },
        ]),
      }),
    );
    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          code: "PROMOTER_CAPITAL_ROLL_FORWARD_FAILURE",
        }),
      ]),
    });
  });

  it("rejects duplicate and extra upstream years", () => {
    const duplicate = composeBalanceSheetYearInputs(
      authoritativeSchedules({
        cash: cashSchedule([
          { year: 1, cash: "150" },
          { year: 1, cash: "150" },
        ]),
      }),
    );
    const extra = composeBalanceSheetYearInputs(
      authoritativeSchedules({
        cash: cashSchedule([
          { year: 1, cash: "150" },
          { year: 2, cash: "200" },
        ]),
      }),
    );
    expect(duplicate).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          code: "DUPLICATE_BALANCE_SHEET_CASH_SOURCE_YEAR",
        }),
      ]),
    });
    expect(extra).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          code: "BALANCE_SHEET_CASH_SOURCE_YEAR_NOT_IN_PROJECTION",
        }),
      ]),
    });
  });
});
