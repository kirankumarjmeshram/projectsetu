import { describe, expect, it } from "vitest";

import type { DepreciationSchedule } from "../depreciation/depreciation";
import type { LoanRepaymentSchedule } from "../loan/loan";
import type {
  ProfitAndLossSchedule,
  ProfitAndLossYear,
} from "../profit-and-loss/profit-and-loss";
import type { CalculationResult } from "../shared/calculation";
import {
  decimalValue,
  monetaryAmount,
  percentage,
  toDecimal,
  toMonetaryAmount,
} from "../shared/decimal";
import { sampleUserSource } from "../testing/domain-fixtures";
import type { WorkingCapitalSummary } from "../working-capital/calculations";
import {
  adaptDepreciationAdditionsAsCashCapitalExpenditure,
  adaptLoanAnnualPaymentsToCashFlow,
  adaptWorkingCapitalRequirementsToChanges,
  calculateCashFlowFromAuthoritativeSchedules,
  composeCashFlowYearInputs,
} from "./adapters";
import {
  calculateCashFlowSchedule,
  calculateFinancingCashFlow,
  calculateInvestingCashFlow,
  calculateOperatingCashFlow,
} from "./calculations";
import type {
  CashFlowCapitalExpenditureYear,
  CashFlowCapitalExpenditureSchedule,
  CashFlowFinancingInflowSchedule,
  CashFlowLoanPaymentSchedule,
  CashFlowLoanPaymentYear,
  CashFlowProjectionInput,
  CashFlowSchedule,
  CashFlowWorkingCapitalChangeSchedule,
  CashFlowYearInput,
} from "./cash-flow";

function unwrap<TValue>(result: CalculationResult<TValue>): TValue {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(result.errors.map((error) => error.code).join(", "));
  }

  return result.value;
}

function yearInput(
  year: number,
  overrides: Partial<CashFlowYearInput> = {},
): CashFlowYearInput {
  return {
    year,
    profitAfterTax: monetaryAmount("500"),
    depreciation: monetaryAmount("100"),
    changeInNetWorkingCapital: monetaryAmount("50"),
    capitalExpenditure: monetaryAmount("200"),
    promoterContribution: monetaryAmount("100"),
    loanDisbursement: monetaryAmount("300"),
    principalRepayment: monetaryAmount("50"),
    cashInterestPaid: monetaryAmount("20"),
    ...overrides,
  };
}

function projectionInput(
  overrides: Partial<CashFlowProjectionInput> = {},
): CashFlowProjectionInput {
  return {
    projectId: "project-synthetic-cash-flow",
    initialOpeningCash: {
      value: monetaryAmount("10"),
      source: sampleUserSource,
    },
    years: [yearInput(1)],
    ...overrides,
  };
}

function schedule(
  overrides: Partial<CashFlowProjectionInput> = {},
): CashFlowSchedule {
  return unwrap(calculateCashFlowSchedule(projectionInput(overrides)));
}

function sumAmounts(values: readonly string[]): string {
  let total = toDecimal(monetaryAmount("0"));

  for (const value of values) {
    total = total.plus(toDecimal(monetaryAmount(value)));
  }

  return toMonetaryAmount(total);
}

function expectCashFlowReconciliation(result: CashFlowSchedule): void {
  for (const [index, year] of result.years.entries()) {
    expect(
      toMonetaryAmount(
        toDecimal(year.profitAfterTax)
          .plus(toDecimal(year.depreciationAddBack))
          .minus(toDecimal(year.changeInNetWorkingCapital)),
      ),
    ).toBe(year.operatingCashFlow);
    expect(toMonetaryAmount(toDecimal(year.capitalExpenditure).negated())).toBe(
      year.investingCashFlow,
    );
    expect(
      toMonetaryAmount(
        toDecimal(year.promoterContribution)
          .plus(toDecimal(year.loanDisbursement))
          .minus(toDecimal(year.principalRepayment))
          .minus(toDecimal(year.cashInterestPaid)),
      ),
    ).toBe(year.financingCashFlow);
    expect(
      sumAmounts([
        year.operatingCashFlow,
        year.investingCashFlow,
        year.financingCashFlow,
      ]),
    ).toBe(year.netCashMovement);
    expect(
      toMonetaryAmount(
        toDecimal(year.openingCash).plus(toDecimal(year.netCashMovement)),
      ),
    ).toBe(year.closingCash);
    expect(
      sumAmounts(
        result.years
          .slice(0, index + 1)
          .map((cashFlowYear) => cashFlowYear.operatingCashFlow),
      ),
    ).toBe(year.cumulativeOperatingCashFlow);
    expect(
      sumAmounts(
        result.years
          .slice(0, index + 1)
          .map((cashFlowYear) => cashFlowYear.investingCashFlow),
      ),
    ).toBe(year.cumulativeInvestingCashFlow);
    expect(
      sumAmounts(
        result.years
          .slice(0, index + 1)
          .map((cashFlowYear) => cashFlowYear.financingCashFlow),
      ),
    ).toBe(year.cumulativeFinancingCashFlow);
    expect(
      sumAmounts(
        result.years
          .slice(0, index + 1)
          .map((cashFlowYear) => cashFlowYear.netCashMovement),
      ),
    ).toBe(year.cumulativeNetCashMovement);
    expect(
      toMonetaryAmount(
        toDecimal(result.initialOpeningCash.value).plus(
          toDecimal(year.cumulativeNetCashMovement),
        ),
      ),
    ).toBe(year.closingCash);

    if (index > 0) {
      expect(year.openingCash).toBe(result.years[index - 1]?.closingCash);
    }
  }

  const finalYear = result.years.at(-1)!;
  expect(result.cumulativeTotals).toEqual({
    cumulativeOperatingCashFlow: finalYear.cumulativeOperatingCashFlow,
    cumulativeInvestingCashFlow: finalYear.cumulativeInvestingCashFlow,
    cumulativeFinancingCashFlow: finalYear.cumulativeFinancingCashFlow,
    cumulativeNetCashMovement: finalYear.cumulativeNetCashMovement,
    endingCash: finalYear.closingCash,
  });
}

function profitAndLossYear(
  year: number,
  profitAfterTax = "500",
  depreciation = "100",
): ProfitAndLossYear {
  return {
    year,
    revenue: monetaryAmount("1000"),
    operatingExpenses: monetaryAmount("300"),
    ebitda: monetaryAmount("700"),
    depreciation: monetaryAmount(depreciation),
    ebit: monetaryAmount("600"),
    interestExpense: monetaryAmount("50"),
    profitBeforeTax: monetaryAmount("550"),
    taxMode: "NO_TAX",
    taxExpense: monetaryAmount("0"),
    profitAfterTax: monetaryAmount(profitAfterTax),
  };
}

function profitAndLossSchedule(
  years: readonly ProfitAndLossYear[],
  projectId = "project-synthetic-cash-flow",
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

function workingCapitalChanges(
  rows: readonly { readonly year: number; readonly change: string }[],
  projectId = "project-synthetic-cash-flow",
): CashFlowWorkingCapitalChangeSchedule {
  return {
    projectId,
    years: rows.map((row) => ({
      year: row.year,
      changeInNetWorkingCapital: monetaryAmount(row.change),
    })),
  };
}

function capitalExpenditure(
  rows: readonly { readonly year: number; readonly amount: string }[],
  projectId = "project-synthetic-cash-flow",
): CashFlowCapitalExpenditureSchedule {
  return {
    projectId,
    years: rows.map((row) => ({
      year: row.year,
      capitalExpenditure: monetaryAmount(row.amount),
    })),
  };
}

function financingInflows(
  rows: readonly {
    readonly year: number;
    readonly promoterContribution: string;
    readonly loanDisbursement: string;
  }[],
  projectId = "project-synthetic-cash-flow",
): CashFlowFinancingInflowSchedule {
  return {
    projectId,
    years: rows.map((row) => ({
      year: row.year,
      promoterContribution: monetaryAmount(row.promoterContribution),
      loanDisbursement: monetaryAmount(row.loanDisbursement),
    })),
  };
}

function loanCashPayments(
  rows: readonly {
    readonly year: number;
    readonly principalRepayment: string;
    readonly cashInterestPaid: string;
  }[],
  projectId = "project-synthetic-cash-flow",
): CashFlowLoanPaymentSchedule {
  return {
    projectId,
    years: rows.map((row) => ({
      year: row.year,
      principalRepayment: monetaryAmount(row.principalRepayment),
      cashInterestPaid: monetaryAmount(row.cashInterestPaid),
    })),
  };
}

function authoritativeSchedules(
  overrides: Partial<Parameters<typeof composeCashFlowYearInputs>[0]> = {},
): Parameters<typeof composeCashFlowYearInputs>[0] {
  return {
    profitAndLoss: profitAndLossSchedule([profitAndLossYear(1)]),
    workingCapitalChanges: workingCapitalChanges([{ year: 1, change: "50" }]),
    capitalExpenditure: capitalExpenditure([{ year: 1, amount: "200" }]),
    financingInflows: financingInflows([
      {
        year: 1,
        promoterContribution: "100",
        loanDisbursement: "300",
      },
    ]),
    loanCashPayments: loanCashPayments([
      { year: 1, principalRepayment: "50", cashInterestPaid: "20" },
    ]),
    ...overrides,
  };
}

describe("cash-flow formulas", () => {
  it("calculates operating cash flow using the signed NWC convention", () => {
    expect(
      unwrap(
        calculateOperatingCashFlow(
          monetaryAmount("500"),
          monetaryAmount("100"),
          monetaryAmount("50"),
        ),
      ),
    ).toBe("550");
  });

  it("turns a working-capital decrease into a cash inflow", () => {
    expect(
      unwrap(
        calculateOperatingCashFlow(
          monetaryAmount("500"),
          monetaryAmount("100"),
          monetaryAmount("-40"),
        ),
      ),
    ).toBe("640");
  });

  it("calculates investing cash flow as negative capex", () => {
    expect(unwrap(calculateInvestingCashFlow(monetaryAmount("250")))).toBe(
      "-250",
    );
  });

  it("calculates financing cash flow from explicit inflows and cash payments", () => {
    expect(
      unwrap(
        calculateFinancingCashFlow(
          monetaryAmount("100"),
          monetaryAmount("300"),
          monetaryAmount("50"),
          monetaryAmount("20"),
        ),
      ),
    ).toBe("330");
  });
});

describe("cash-flow schedules", () => {
  it("calculates a one-year positive cash flow", () => {
    const result = schedule();

    expect(result.years).toEqual([
      {
        year: 1,
        openingCash: "10",
        profitAfterTax: "500",
        depreciationAddBack: "100",
        changeInNetWorkingCapital: "50",
        operatingCashFlow: "550",
        capitalExpenditure: "200",
        investingCashFlow: "-200",
        promoterContribution: "100",
        loanDisbursement: "300",
        principalRepayment: "50",
        cashInterestPaid: "20",
        financingCashFlow: "330",
        netCashMovement: "680",
        closingCash: "690",
        cumulativeOperatingCashFlow: "550",
        cumulativeInvestingCashFlow: "-200",
        cumulativeFinancingCashFlow: "330",
        cumulativeNetCashMovement: "680",
      },
    ]);
    expectCashFlowReconciliation(result);
  });

  it("maintains exact multi-year cash continuity and cumulative totals", () => {
    const result = schedule({
      years: [
        yearInput(1),
        yearInput(2, {
          profitAfterTax: monetaryAmount("600"),
          depreciation: monetaryAmount("90"),
          changeInNetWorkingCapital: monetaryAmount("-40"),
          capitalExpenditure: monetaryAmount("100"),
          promoterContribution: monetaryAmount("0"),
          loanDisbursement: monetaryAmount("0"),
          principalRepayment: monetaryAmount("100"),
          cashInterestPaid: monetaryAmount("15"),
        }),
        yearInput(3, {
          profitAfterTax: monetaryAmount("-100"),
          depreciation: monetaryAmount("80"),
          changeInNetWorkingCapital: monetaryAmount("0"),
          capitalExpenditure: monetaryAmount("0"),
          promoterContribution: monetaryAmount("0"),
          loanDisbursement: monetaryAmount("0"),
          principalRepayment: monetaryAmount("100"),
          cashInterestPaid: monetaryAmount("10"),
        }),
      ],
    });

    expect(result.years.map((year) => year.openingCash)).toEqual([
      "10",
      "690",
      "1205",
    ]);
    expect(result.years.map((year) => year.closingCash)).toEqual([
      "690",
      "1205",
      "1075",
    ]);
    expect(result.cumulativeTotals).toMatchObject({
      cumulativeNetCashMovement: "1065",
      endingCash: "1075",
    });
    expectCashFlowReconciliation(result);
  });

  it("supports negative PAT without rejecting the loss", () => {
    const result = schedule({
      years: [
        yearInput(1, {
          profitAfterTax: monetaryAmount("-200"),
          depreciation: monetaryAmount("50"),
          changeInNetWorkingCapital: monetaryAmount("0"),
          capitalExpenditure: monetaryAmount("0"),
          promoterContribution: monetaryAmount("0"),
          loanDisbursement: monetaryAmount("0"),
          principalRepayment: monetaryAmount("0"),
          cashInterestPaid: monetaryAmount("0"),
        }),
      ],
    });

    expect(result.years[0]).toMatchObject({
      operatingCashFlow: "-150",
      netCashMovement: "-150",
      closingCash: "-140",
    });
  });

  it("adds depreciation back exactly once", () => {
    const result = schedule({
      years: [
        yearInput(1, {
          profitAfterTax: monetaryAmount("100"),
          depreciation: monetaryAmount("30"),
          changeInNetWorkingCapital: monetaryAmount("0"),
          capitalExpenditure: monetaryAmount("0"),
          promoterContribution: monetaryAmount("0"),
          loanDisbursement: monetaryAmount("0"),
          principalRepayment: monetaryAmount("0"),
          cashInterestPaid: monetaryAmount("0"),
        }),
      ],
    });

    expect(result.years[0]).toMatchObject({
      depreciationAddBack: "30",
      operatingCashFlow: "130",
      netCashMovement: "130",
    });
  });

  it("accepts zero depreciation and zero working-capital change", () => {
    const result = schedule({
      years: [
        yearInput(1, {
          depreciation: monetaryAmount("0"),
          changeInNetWorkingCapital: monetaryAmount("0"),
        }),
      ],
    });

    expect(result.years[0]?.operatingCashFlow).toBe("500");
  });

  it("treats a year-one initial working-capital requirement as an outflow", () => {
    const result = schedule({
      years: [
        yearInput(1, {
          profitAfterTax: monetaryAmount("0"),
          depreciation: monetaryAmount("0"),
          changeInNetWorkingCapital: monetaryAmount("100000"),
          capitalExpenditure: monetaryAmount("0"),
          promoterContribution: monetaryAmount("0"),
          loanDisbursement: monetaryAmount("0"),
          principalRepayment: monetaryAmount("0"),
          cashInterestPaid: monetaryAmount("0"),
        }),
      ],
    });

    expect(result.years[0]).toMatchObject({
      operatingCashFlow: "-100000",
      closingCash: "-99990",
    });
  });

  it("shows initial and later capital expenditure only in investing cash flow", () => {
    const result = schedule({
      years: [
        yearInput(1, { capitalExpenditure: monetaryAmount("1000") }),
        yearInput(2, { capitalExpenditure: monetaryAmount("250") }),
      ],
    });

    expect(result.years.map((year) => year.investingCashFlow)).toEqual([
      "-1000",
      "-250",
    ]);
    expect(result.years.map((year) => year.depreciationAddBack)).toEqual([
      "100",
      "100",
    ]);
  });

  it("keeps promoter contribution and loan disbursement as financing inflows", () => {
    const result = schedule();

    expect(result.years[0]).toMatchObject({
      promoterContribution: "100",
      loanDisbursement: "300",
      financingCashFlow: "330",
    });
  });

  it("keeps principal repayment and cash interest as financing outflows", () => {
    const result = schedule({
      years: [
        yearInput(1, {
          promoterContribution: monetaryAmount("0"),
          loanDisbursement: monetaryAmount("0"),
          principalRepayment: monetaryAmount("75"),
          cashInterestPaid: monetaryAmount("25"),
        }),
      ],
    });

    expect(result.years[0]).toMatchObject({
      financingCashFlow: "-100",
      operatingCashFlow: "550",
    });
  });

  it("supports zero and positive opening cash without inferring either", () => {
    const zeroOpening = schedule({
      initialOpeningCash: {
        value: monetaryAmount("0"),
        source: sampleUserSource,
      },
    });
    const positiveOpening = schedule({
      initialOpeningCash: {
        value: monetaryAmount("500"),
        source: sampleUserSource,
      },
    });

    expect(zeroOpening.years[0]?.openingCash).toBe("0");
    expect(positiveOpening.years[0]).toMatchObject({
      openingCash: "500",
      closingCash: "1180",
    });
  });

  it("allows negative opening and closing cash", () => {
    const result = schedule({
      initialOpeningCash: {
        value: monetaryAmount("-25"),
        source: sampleUserSource,
      },
      years: [
        yearInput(1, {
          profitAfterTax: monetaryAmount("-100"),
          depreciation: monetaryAmount("0"),
          changeInNetWorkingCapital: monetaryAmount("0"),
          capitalExpenditure: monetaryAmount("0"),
          promoterContribution: monetaryAmount("0"),
          loanDisbursement: monetaryAmount("0"),
          principalRepayment: monetaryAmount("0"),
          cashInterestPaid: monetaryAmount("0"),
        }),
      ],
    });

    expect(result.years[0]).toMatchObject({
      openingCash: "-25",
      closingCash: "-125",
    });
  });

  it("supports canonical zero values everywhere", () => {
    const result = schedule({
      initialOpeningCash: {
        value: monetaryAmount("0"),
        source: sampleUserSource,
      },
      years: [
        yearInput(1, {
          profitAfterTax: monetaryAmount("0"),
          depreciation: monetaryAmount("0"),
          changeInNetWorkingCapital: monetaryAmount("0"),
          capitalExpenditure: monetaryAmount("0"),
          promoterContribution: monetaryAmount("0"),
          loanDisbursement: monetaryAmount("0"),
          principalRepayment: monetaryAmount("0"),
          cashInterestPaid: monetaryAmount("0"),
        }),
      ],
    });

    expect(result.years[0]).toEqual(
      expect.objectContaining({
        openingCash: "0",
        operatingCashFlow: "0",
        investingCashFlow: "0",
        financingCashFlow: "0",
        netCashMovement: "0",
        closingCash: "0",
      }),
    );
  });

  it("preserves Decimal.js precision without intermediate rounding", () => {
    const result = schedule({
      initialOpeningCash: {
        value: monetaryAmount("0.07"),
        source: sampleUserSource,
      },
      years: [
        yearInput(1, {
          profitAfterTax: monetaryAmount("0.1"),
          depreciation: monetaryAmount("0.2"),
          changeInNetWorkingCapital: monetaryAmount("0.03"),
          capitalExpenditure: monetaryAmount("0.04"),
          promoterContribution: monetaryAmount("0.05"),
          loanDisbursement: monetaryAmount("0.06"),
          principalRepayment: monetaryAmount("0.01"),
          cashInterestPaid: monetaryAmount("0.02"),
        }),
      ],
    });

    expect(result.years[0]).toMatchObject({
      operatingCashFlow: "0.27",
      investingCashFlow: "-0.04",
      financingCashFlow: "0.08",
      netCashMovement: "0.31",
      closingCash: "0.38",
    });
    expectCashFlowReconciliation(result);
  });
});

describe("cash-flow validation", () => {
  it("rejects duplicate years", () => {
    const result = calculateCashFlowSchedule(
      projectionInput({ years: [yearInput(1), yearInput(1)] }),
    );

    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "DUPLICATE_CASH_FLOW_YEAR" }),
      ]),
    });
  });

  it.each([0, -1, 1.5])("rejects invalid year %s", (year) => {
    const result = calculateCashFlowSchedule(
      projectionInput({ years: [yearInput(year)] }),
    );

    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "INVALID_CASH_FLOW_YEAR" }),
      ]),
    });
  });

  it("rejects non-sequential years", () => {
    const result = calculateCashFlowSchedule(
      projectionInput({ years: [yearInput(1), yearInput(3)] }),
    );

    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "INVALID_CASH_FLOW_YEAR_SEQUENCE" }),
      ]),
    });
  });

  it("rejects an empty schedule", () => {
    const result = calculateCashFlowSchedule(projectionInput({ years: [] }));

    expect(result).toEqual({
      ok: false,
      errors: [expect.objectContaining({ code: "EMPTY_CASH_FLOW_SCHEDULE" })],
    });
  });

  it("rejects a missing opening cash assumption", () => {
    const malformed = {
      ...projectionInput(),
      initialOpeningCash: undefined,
    } as unknown as CashFlowProjectionInput;
    const result = calculateCashFlowSchedule(malformed);

    expect(result).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({ code: "MISSING_INITIAL_OPENING_CASH" }),
      ],
    });
  });

  it.each([
    ["depreciation", "NEGATIVE_CASH_FLOW_DEPRECIATION"],
    ["capitalExpenditure", "NEGATIVE_CAPITAL_EXPENDITURE"],
    ["promoterContribution", "NEGATIVE_PROMOTER_CONTRIBUTION"],
    ["loanDisbursement", "NEGATIVE_LOAN_DISBURSEMENT"],
    ["principalRepayment", "NEGATIVE_PRINCIPAL_REPAYMENT"],
    ["cashInterestPaid", "NEGATIVE_CASH_INTEREST_PAID"],
  ] as const)("rejects negative %s", (field, code) => {
    const result = calculateCashFlowSchedule(
      projectionInput({
        years: [yearInput(1, { [field]: monetaryAmount("-0.01") })],
      }),
    );

    expect(result).toEqual({
      ok: false,
      errors: [expect.objectContaining({ code })],
    });
  });

  it("allows negative PAT and negative change in NWC", () => {
    const result = calculateCashFlowSchedule(
      projectionInput({
        years: [
          yearInput(1, {
            profitAfterTax: monetaryAmount("-1"),
            changeInNetWorkingCapital: monetaryAmount("-2"),
          }),
        ],
      }),
    );

    expect(result.ok).toBe(true);
  });
});

describe("cash-flow upstream adapters", () => {
  it("derives Year 1 and later NWC changes from explicit prior balances", () => {
    const summaries: readonly WorkingCapitalSummary[] = [
      {
        projectId: "project-synthetic-cash-flow",
        projectionYear: 1,
        lines: [],
        totalCurrentAssets: monetaryAmount("0"),
        totalCurrentLiabilities: monetaryAmount("0"),
        workingCapitalGap: monetaryAmount("500000"),
      },
      {
        projectId: "project-synthetic-cash-flow",
        projectionYear: 2,
        lines: [],
        totalCurrentAssets: monetaryAmount("0"),
        totalCurrentLiabilities: monetaryAmount("0"),
        workingCapitalGap: monetaryAmount("500040"),
      },
      {
        projectId: "project-synthetic-cash-flow",
        projectionYear: 3,
        lines: [],
        totalCurrentAssets: monetaryAmount("0"),
        totalCurrentLiabilities: monetaryAmount("0"),
        workingCapitalGap: monetaryAmount("499990"),
      },
      {
        projectId: "project-synthetic-cash-flow",
        projectionYear: 4,
        lines: [],
        totalCurrentAssets: monetaryAmount("0"),
        totalCurrentLiabilities: monetaryAmount("0"),
        workingCapitalGap: monetaryAmount("499990"),
      },
    ];
    const openingNetWorkingCapital = {
      value: monetaryAmount("0"),
      source: sampleUserSource,
    };
    const result = unwrap(
      adaptWorkingCapitalRequirementsToChanges(
        "project-synthetic-cash-flow",
        openingNetWorkingCapital,
        summaries,
      ),
    );

    expect(result.openingNetWorkingCapital).toBe(openingNetWorkingCapital);
    expect(result.years).toEqual([
      { year: 1, changeInNetWorkingCapital: "500000" },
      { year: 2, changeInNetWorkingCapital: "40" },
      { year: 3, changeInNetWorkingCapital: "-50" },
      { year: 4, changeInNetWorkingCapital: "0" },
    ]);
    expect(
      unwrap(
        calculateOperatingCashFlow(
          monetaryAmount("0"),
          monetaryAmount("0"),
          result.years[0]!.changeInNetWorkingCapital,
        ),
      ),
    ).toBe("-500000");
  });

  it("uses an explicit non-zero opening NWC for the year-one change", () => {
    const summary: WorkingCapitalSummary = {
      projectId: "project-synthetic-cash-flow",
      projectionYear: 1,
      lines: [],
      totalCurrentAssets: monetaryAmount("0"),
      totalCurrentLiabilities: monetaryAmount("0"),
      workingCapitalGap: monetaryAmount("100"),
    };
    const result = unwrap(
      adaptWorkingCapitalRequirementsToChanges(
        "project-synthetic-cash-flow",
        { value: monetaryAmount("25"), source: sampleUserSource },
        [summary],
      ),
    );

    expect(result.years[0]?.changeInNetWorkingCapital).toBe("75");
  });

  it("reconciles Decimal.js NWC balance changes without rounding", () => {
    const summaries: readonly WorkingCapitalSummary[] = [
      {
        projectId: "project-synthetic-cash-flow",
        projectionYear: 1,
        lines: [],
        totalCurrentAssets: monetaryAmount("0"),
        totalCurrentLiabilities: monetaryAmount("0"),
        workingCapitalGap: monetaryAmount("100.100000000000000002"),
      },
      {
        projectId: "project-synthetic-cash-flow",
        projectionYear: 2,
        lines: [],
        totalCurrentAssets: monetaryAmount("0"),
        totalCurrentLiabilities: monetaryAmount("0"),
        workingCapitalGap: monetaryAmount("150.100000000000000002"),
      },
      {
        projectId: "project-synthetic-cash-flow",
        projectionYear: 3,
        lines: [],
        totalCurrentAssets: monetaryAmount("0"),
        totalCurrentLiabilities: monetaryAmount("0"),
        workingCapitalGap: monetaryAmount("125.050000000000000001"),
      },
    ];
    const result = unwrap(
      adaptWorkingCapitalRequirementsToChanges(
        "project-synthetic-cash-flow",
        {
          value: monetaryAmount("100.000000000000000001"),
          source: sampleUserSource,
        },
        summaries,
      ),
    );

    expect(result.years).toEqual([
      { year: 1, changeInNetWorkingCapital: "0.100000000000000001" },
      { year: 2, changeInNetWorkingCapital: "50" },
      { year: 3, changeInNetWorkingCapital: "-25.050000000000000001" },
    ]);
  });

  it("rejects a missing source-backed opening NWC", () => {
    const malformedOpening = undefined as unknown as {
      readonly value: ReturnType<typeof monetaryAmount>;
      readonly source: typeof sampleUserSource;
    };
    const result = adaptWorkingCapitalRequirementsToChanges(
      "project-synthetic-cash-flow",
      malformedOpening,
      [
        {
          projectId: "project-synthetic-cash-flow",
          projectionYear: 1,
          lines: [],
          totalCurrentAssets: monetaryAmount("0"),
          totalCurrentLiabilities: monetaryAmount("0"),
          workingCapitalGap: monetaryAmount("100"),
        },
      ],
    );

    expect(result).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({
          code: "MISSING_OPENING_NET_WORKING_CAPITAL",
        }),
      ],
    });
  });

  it("maps only depreciation additions to opted-in cash capex", () => {
    const depreciation: DepreciationSchedule = {
      projectId: "project-synthetic-cash-flow",
      projectionPeriodYears: 2,
      assetSchedules: [],
      yearlySummaries: [
        {
          year: 1,
          openingGrossFixedAssets: monetaryAmount("1000"),
          additions: monetaryAmount("0"),
          depreciation: monetaryAmount("100"),
          accumulatedDepreciation: monetaryAmount("100"),
          closingGrossFixedAssets: monetaryAmount("1000"),
          closingNetCarryingValue: monetaryAmount("900"),
        },
        {
          year: 2,
          openingGrossFixedAssets: monetaryAmount("1000"),
          additions: monetaryAmount("250"),
          depreciation: monetaryAmount("125"),
          accumulatedDepreciation: monetaryAmount("225"),
          closingGrossFixedAssets: monetaryAmount("1250"),
          closingNetCarryingValue: monetaryAmount("1025"),
        },
      ],
    };
    const result = unwrap(
      adaptDepreciationAdditionsAsCashCapitalExpenditure(depreciation),
    );

    expect(result.years).toEqual([
      { year: 1, capitalExpenditure: "0" },
      { year: 2, capitalExpenditure: "250" },
    ]);
    expect(
      sumAmounts(result.years.map((year) => year.capitalExpenditure)),
    ).toBe("250");
    for (const year of result.years) {
      expect(year).not.toHaveProperty("depreciation");
      expect(year).not.toHaveProperty("accumulatedDepreciation");
      expect(year).not.toHaveProperty("closingNetCarryingValue");
    }
  });

  it("forbids depreciation and carrying values at the capex boundary", () => {
    const depreciationLikeRow = {
      year: 1,
      capitalExpenditure: monetaryAmount("250"),
      depreciation: monetaryAmount("100"),
      accumulatedDepreciation: monetaryAmount("100"),
      closingNetCarryingValue: monetaryAmount("900"),
    };

    // @ts-expect-error Depreciation and book values are forbidden as cash capex.
    const rejected: CashFlowCapitalExpenditureYear = depreciationLikeRow;
    expect(rejected.capitalExpenditure).toBe("250");
  });

  it("maps only principal repaid and interest paid from loan annual summaries", () => {
    const loanSchedule: LoanRepaymentSchedule = {
      loanId: "loan-synthetic",
      repaymentMethod: "EQUAL_PRINCIPAL",
      repaymentFrequency: "YEARLY",
      periodicInterestRate: decimalValue("0.1"),
      periods: [],
      summary: {
        originalPrincipal: monetaryAmount("1000"),
        totalPrincipalRepaid: monetaryAmount("100"),
        totalInterestCharged: monetaryAmount("80"),
        totalInterestPaid: monetaryAmount("20"),
        totalRepayments: monetaryAmount("120"),
        totalCapitalizedInterest: monetaryAmount("50"),
        endingPrincipal: monetaryAmount("950"),
        endingAccruedInterest: monetaryAmount("60"),
        numberOfSchedulePeriods: 1,
        numberOfAmortizationPeriods: 1,
      },
      annualSummaries: [
        {
          projectionYear: 1,
          openingPrincipal: monetaryAmount("1000"),
          principalRepaid: monetaryAmount("100"),
          interestCharged: monetaryAmount("80"),
          interestPaid: monetaryAmount("20"),
          totalDebtService: monetaryAmount("120"),
          closingPrincipal: monetaryAmount("950"),
          openingAccruedInterest: monetaryAmount("0"),
          closingAccruedInterest: monetaryAmount("60"),
        },
      ],
    };
    const result = unwrap(
      adaptLoanAnnualPaymentsToCashFlow(
        "project-synthetic-cash-flow",
        loanSchedule,
      ),
    );

    expect(result.years).toEqual([
      {
        year: 1,
        principalRepayment: "100",
        cashInterestPaid: "20",
      },
    ]);
    expect(result.years[0]?.cashInterestPaid).not.toBe(
      loanSchedule.annualSummaries[0]?.interestCharged,
    );
    expect(result.years[0]?.principalRepayment).toBe("100");
    expect(result.years[0]).not.toHaveProperty("interestCharged");
    expect(result.years[0]).not.toHaveProperty("openingAccruedInterest");
    expect(result.years[0]).not.toHaveProperty("closingAccruedInterest");
    expect(result.years[0]).not.toHaveProperty("capitalizedInterest");
    expect(result.years[0]).not.toHaveProperty("closingPrincipal");
  });

  it("forbids non-cash loan fields at the normalized payment boundary", () => {
    const loanLikeRow = {
      year: 1,
      principalRepayment: monetaryAmount("100"),
      cashInterestPaid: monetaryAmount("20"),
      interestCharged: monetaryAmount("80"),
      accruedInterest: monetaryAmount("60"),
      capitalizedInterest: monetaryAmount("50"),
      totalDebtService: monetaryAmount("120"),
      closingPrincipal: monetaryAmount("950"),
    };

    // @ts-expect-error Non-cash loan fields are forbidden by the cash boundary.
    const rejected: CashFlowLoanPaymentYear = loanLikeRow;
    expect(rejected.cashInterestPaid).toBe("20");
  });
});

describe("cash-flow authoritative composition", () => {
  it("copies only authoritative normalized values into cash-flow inputs", () => {
    const schedules = authoritativeSchedules();
    const composed = unwrap(composeCashFlowYearInputs(schedules));
    const result = unwrap(
      calculateCashFlowFromAuthoritativeSchedules(schedules, {
        value: monetaryAmount("10"),
        source: sampleUserSource,
      }),
    );

    expect(composed).toEqual([yearInput(1)]);
    expect(result.years[0]).toMatchObject({
      profitAfterTax: "500",
      depreciationAddBack: "100",
      changeInNetWorkingCapital: "50",
      capitalExpenditure: "200",
      promoterContribution: "100",
      loanDisbursement: "300",
      principalRepayment: "50",
      cashInterestPaid: "20",
    });
  });

  it("copies PAT and adds back only depreciation without subtracting tax again", () => {
    const taxedProfitAndLossYear: ProfitAndLossYear = {
      ...profitAndLossYear(1, "400", "100"),
      taxMode: "PERCENTAGE_OF_POSITIVE_PBT",
      taxRateApplied: percentage("18.1818181818181818"),
      taxExpense: monetaryAmount("100"),
    };
    const result = unwrap(
      calculateCashFlowFromAuthoritativeSchedules(
        authoritativeSchedules({
          profitAndLoss: profitAndLossSchedule([taxedProfitAndLossYear]),
        }),
        { value: monetaryAmount("0"), source: sampleUserSource },
      ),
    );

    expect(result.years[0]).toMatchObject({
      profitAfterTax: "400",
      depreciationAddBack: "100",
      changeInNetWorkingCapital: "50",
      operatingCashFlow: "450",
    });
    expect(result.years[0]).not.toHaveProperty("taxExpense");
    expect(result.years[0]).not.toHaveProperty("operatingExpenses");
  });

  it("rejects mismatched project identifiers", () => {
    const result = composeCashFlowYearInputs(
      authoritativeSchedules({
        workingCapitalChanges: workingCapitalChanges(
          [{ year: 1, change: "50" }],
          "different-project",
        ),
      }),
    );

    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "CASH_FLOW_PROJECT_ID_MISMATCH" }),
      ]),
    });
  });

  it("rejects missing normalized sources under the strict policy", () => {
    const result = composeCashFlowYearInputs(
      authoritativeSchedules({
        workingCapitalChanges: workingCapitalChanges([]),
        capitalExpenditure: capitalExpenditure([]),
        financingInflows: financingInflows([]),
        loanCashPayments: loanCashPayments([]),
      }),
    );

    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          code: "MISSING_WORKING_CAPITAL_CHANGE_FOR_CASH_FLOW_YEAR",
        }),
        expect.objectContaining({
          code: "MISSING_CAPITAL_EXPENDITURE_FOR_CASH_FLOW_YEAR",
        }),
        expect.objectContaining({
          code: "MISSING_FINANCING_INFLOWS_FOR_CASH_FLOW_YEAR",
        }),
        expect.objectContaining({
          code: "MISSING_LOAN_CASH_PAYMENTS_FOR_CASH_FLOW_YEAR",
        }),
      ]),
    });
  });

  it("uses zero for missing sources only under explicit policies", () => {
    const result = unwrap(
      composeCashFlowYearInputs(
        authoritativeSchedules({
          workingCapitalChanges: workingCapitalChanges([]),
          capitalExpenditure: capitalExpenditure([]),
          financingInflows: financingInflows([]),
          loanCashPayments: loanCashPayments([]),
        }),
        {
          missingWorkingCapitalChange: "USE_EXPLICIT_ZERO",
          missingCapitalExpenditure: "USE_EXPLICIT_ZERO",
          missingFinancingInflows: "USE_EXPLICIT_ZERO",
          missingLoanCashPayments: "USE_EXPLICIT_ZERO",
        },
      ),
    );

    expect(result).toEqual([
      yearInput(1, {
        changeInNetWorkingCapital: monetaryAmount("0"),
        capitalExpenditure: monetaryAmount("0"),
        promoterContribution: monetaryAmount("0"),
        loanDisbursement: monetaryAmount("0"),
        principalRepayment: monetaryAmount("0"),
        cashInterestPaid: monetaryAmount("0"),
      }),
    ]);
  });

  it("accepts supplied zeros under the strict policy", () => {
    const result = unwrap(
      composeCashFlowYearInputs(
        authoritativeSchedules({
          profitAndLoss: profitAndLossSchedule([
            profitAndLossYear(1, "0", "0"),
          ]),
          workingCapitalChanges: workingCapitalChanges([
            { year: 1, change: "0" },
          ]),
          capitalExpenditure: capitalExpenditure([{ year: 1, amount: "0" }]),
          financingInflows: financingInflows([
            {
              year: 1,
              promoterContribution: "0",
              loanDisbursement: "0",
            },
          ]),
          loanCashPayments: loanCashPayments([
            { year: 1, principalRepayment: "0", cashInterestPaid: "0" },
          ]),
        }),
      ),
    );

    expect(result).toEqual([
      yearInput(1, {
        profitAfterTax: monetaryAmount("0"),
        depreciation: monetaryAmount("0"),
        changeInNetWorkingCapital: monetaryAmount("0"),
        capitalExpenditure: monetaryAmount("0"),
        promoterContribution: monetaryAmount("0"),
        loanDisbursement: monetaryAmount("0"),
        principalRepayment: monetaryAmount("0"),
        cashInterestPaid: monetaryAmount("0"),
      }),
    ]);
  });

  it("rejects duplicate upstream years", () => {
    const result = composeCashFlowYearInputs(
      authoritativeSchedules({
        workingCapitalChanges: workingCapitalChanges([
          { year: 1, change: "50" },
          { year: 1, change: "60" },
        ]),
      }),
    );

    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          code: "DUPLICATE_WORKING_CAPITAL_CHANGE_SOURCE_YEAR",
        }),
      ]),
    });
  });

  it("rejects upstream years outside the P&L timeline", () => {
    const result = composeCashFlowYearInputs(
      authoritativeSchedules({
        capitalExpenditure: capitalExpenditure([
          { year: 1, amount: "200" },
          { year: 2, amount: "100" },
        ]),
      }),
    );

    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          code: "CAPITAL_EXPENDITURE_YEAR_NOT_IN_CASH_FLOW",
        }),
      ]),
    });
  });
});
