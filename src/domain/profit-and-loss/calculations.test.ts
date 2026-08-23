import { describe, expect, it } from "vitest";

import type { DepreciationSchedule } from "../depreciation/depreciation";
import type { RevenueAndOperatingExpenseProjection } from "../projection/projection";
import type { CalculationResult } from "../shared/calculation";
import {
  monetaryAmount,
  percentage,
  percentageToFactor,
  toDecimal,
  toMonetaryAmount,
} from "../shared/decimal";
import { sampleUserSource } from "../testing/domain-fixtures";
import {
  calculatePercentageOfPositiveProfitBeforeTax,
  calculateProfitAndLossFromAuthoritativeSchedules,
  calculateProjectedProfitAndLoss,
  composeProfitAndLossYearInputs,
} from "./calculations";
import type {
  PercentageOfPositiveProfitBeforeTaxConfiguration,
  ProfitAndLossInterestExpenseSchedule,
  ProfitAndLossInterestExpenseYear,
  ProfitAndLossProjectionInput,
  ProfitAndLossSchedule,
  ProfitAndLossTaxConfiguration,
  ProfitAndLossYear,
  ProfitAndLossYearInput,
} from "./profit-and-loss";

function unwrap<TValue>(result: CalculationResult<TValue>): TValue {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(result.errors.map((error) => error.code).join(", "));
  }

  return result.value;
}

function yearInput(
  year: number,
  overrides: Partial<ProfitAndLossYearInput> = {},
): ProfitAndLossYearInput {
  return {
    year,
    revenue: monetaryAmount("1000"),
    operatingExpenses: monetaryAmount("400"),
    depreciation: monetaryAmount("100"),
    interestExpense: monetaryAmount("50"),
    ...overrides,
  };
}

function percentageTax(
  rate = "25",
  overrides: Partial<PercentageOfPositiveProfitBeforeTaxConfiguration> = {},
): PercentageOfPositiveProfitBeforeTaxConfiguration {
  return {
    mode: "PERCENTAGE_OF_POSITIVE_PBT",
    taxRate: { value: percentage(rate), source: sampleUserSource },
    ...overrides,
  };
}

function projectionInput(
  overrides: Partial<ProfitAndLossProjectionInput> = {},
): ProfitAndLossProjectionInput {
  return {
    projectId: "project-synthetic-profit-and-loss",
    years: [yearInput(1)],
    taxConfiguration: percentageTax(),
    ...overrides,
  };
}

function schedule(
  overrides: Partial<ProfitAndLossProjectionInput> = {},
): ProfitAndLossSchedule {
  return unwrap(calculateProjectedProfitAndLoss(projectionInput(overrides)));
}

function sumAmounts(values: readonly string[]): string {
  let total = toDecimal(monetaryAmount("0"));

  for (const value of values) {
    total = total.plus(toDecimal(monetaryAmount(value)));
  }

  return toMonetaryAmount(total);
}

function expectYearReconciliation(year: ProfitAndLossYear): void {
  expect(
    toMonetaryAmount(
      toDecimal(year.revenue).minus(toDecimal(year.operatingExpenses)),
    ),
  ).toBe(year.ebitda);
  expect(
    toMonetaryAmount(
      toDecimal(year.ebitda).minus(toDecimal(year.depreciation)),
    ),
  ).toBe(year.ebit);
  expect(
    toMonetaryAmount(
      toDecimal(year.ebit).minus(toDecimal(year.interestExpense)),
    ),
  ).toBe(year.profitBeforeTax);
  expect(
    toMonetaryAmount(
      toDecimal(year.profitBeforeTax).minus(toDecimal(year.taxExpense)),
    ),
  ).toBe(year.profitAfterTax);

  if (year.taxMode === "PERCENTAGE_OF_POSITIVE_PBT" && year.taxRateApplied) {
    const expectedTax = toDecimal(year.profitBeforeTax).isPositive()
      ? toMonetaryAmount(
          toDecimal(year.profitBeforeTax).times(
            percentageToFactor(year.taxRateApplied),
          ),
        )
      : "0";

    expect(year.taxExpense).toBe(expectedTax);
  }
}

function expectCumulativeReconciliation(result: ProfitAndLossSchedule): void {
  const { cumulativeTotals } = result;

  expect(sumAmounts(result.years.map((year) => year.revenue))).toBe(
    cumulativeTotals.cumulativeRevenue,
  );
  expect(sumAmounts(result.years.map((year) => year.operatingExpenses))).toBe(
    cumulativeTotals.cumulativeOperatingExpenses,
  );
  expect(sumAmounts(result.years.map((year) => year.ebitda))).toBe(
    cumulativeTotals.cumulativeEbitda,
  );
  expect(sumAmounts(result.years.map((year) => year.depreciation))).toBe(
    cumulativeTotals.cumulativeDepreciation,
  );
  expect(sumAmounts(result.years.map((year) => year.ebit))).toBe(
    cumulativeTotals.cumulativeEbit,
  );
  expect(sumAmounts(result.years.map((year) => year.interestExpense))).toBe(
    cumulativeTotals.cumulativeInterestExpense,
  );
  expect(sumAmounts(result.years.map((year) => year.profitBeforeTax))).toBe(
    cumulativeTotals.cumulativeProfitBeforeTax,
  );
  expect(sumAmounts(result.years.map((year) => year.taxExpense))).toBe(
    cumulativeTotals.cumulativeTaxExpense,
  );
  expect(sumAmounts(result.years.map((year) => year.profitAfterTax))).toBe(
    cumulativeTotals.cumulativeProfitAfterTax,
  );
}

function authoritativeProjection(
  rows: readonly {
    readonly year: number;
    readonly revenue: string;
    readonly operatingExpenses: string;
  }[],
  projectId = "project-synthetic-profit-and-loss",
): RevenueAndOperatingExpenseProjection {
  return {
    projectId,
    projectionPeriodYears: rows.length,
    years: rows.map((row) => ({
      year: row.year,
      lines: [],
      revenueLines: [],
      rawMaterialAndVariableCosts: monetaryAmount("0"),
      wages: monetaryAmount("0"),
      salaries: monetaryAmount("0"),
      utilities: monetaryAmount("0"),
      repairsAndMaintenance: monetaryAmount("0"),
      administrativeAndOtherOperatingCosts: monetaryAmount("0"),
      totalRevenue: monetaryAmount(row.revenue),
      totalOperatingExpenses: monetaryAmount(row.operatingExpenses),
      operatingSurplusBeforeDepreciationInterestAndTax: toMonetaryAmount(
        toDecimal(monetaryAmount(row.revenue)).minus(
          toDecimal(monetaryAmount(row.operatingExpenses)),
        ),
      ),
    })),
  };
}

function authoritativeDepreciation(
  rows: readonly { readonly year: number; readonly depreciation: string }[],
  projectId = "project-synthetic-profit-and-loss",
): DepreciationSchedule {
  return {
    projectId,
    projectionPeriodYears: rows.length,
    assetSchedules: [],
    yearlySummaries: rows.map((row) => ({
      year: row.year,
      openingGrossFixedAssets: monetaryAmount("0"),
      additions: monetaryAmount("0"),
      depreciation: monetaryAmount(row.depreciation),
      accumulatedDepreciation: monetaryAmount("0"),
      closingGrossFixedAssets: monetaryAmount("0"),
      closingNetCarryingValue: monetaryAmount("0"),
    })),
  };
}

function authoritativeInterest(
  rows: readonly { readonly year: number; readonly interestExpense: string }[],
  projectId = "project-synthetic-profit-and-loss",
): ProfitAndLossInterestExpenseSchedule {
  return {
    projectId,
    years: rows.map((row) => ({
      year: row.year,
      interestExpense: monetaryAmount(row.interestExpense),
    })),
  };
}

describe("projected profit and loss", () => {
  it("calculates a one-year profitable project", () => {
    const result = schedule();

    expect(result.years).toEqual([
      {
        year: 1,
        revenue: "1000",
        operatingExpenses: "400",
        ebitda: "600",
        depreciation: "100",
        ebit: "500",
        interestExpense: "50",
        profitBeforeTax: "450",
        taxMode: "PERCENTAGE_OF_POSITIVE_PBT",
        taxRateApplied: "25",
        taxExpense: "112.5",
        profitAfterTax: "337.5",
      },
    ]);
    expectYearReconciliation(result.years[0]!);
    expectCumulativeReconciliation(result);
  });

  it("calculates and exactly totals a multi-year profitable project", () => {
    const result = schedule({
      years: [
        yearInput(1),
        yearInput(2, {
          revenue: monetaryAmount("1200"),
          operatingExpenses: monetaryAmount("450"),
          depreciation: monetaryAmount("110"),
          interestExpense: monetaryAmount("40"),
        }),
        yearInput(3, {
          revenue: monetaryAmount("1500"),
          operatingExpenses: monetaryAmount("500"),
          depreciation: monetaryAmount("120"),
          interestExpense: monetaryAmount("30"),
        }),
      ],
    });

    expect(result.years.map((year) => year.profitAfterTax)).toEqual([
      "337.5",
      "450",
      "637.5",
    ]);
    for (const year of result.years) {
      expectYearReconciliation(year);
    }
    expectCumulativeReconciliation(result);
  });

  it("supports NO_TAX without a tax assumption", () => {
    const result = schedule({ taxConfiguration: { mode: "NO_TAX" } });

    expect(result.years[0]).toMatchObject({
      profitBeforeTax: "450",
      taxMode: "NO_TAX",
      taxExpense: "0",
      profitAfterTax: "450",
    });
    expect(result.years[0]).not.toHaveProperty("taxRateApplied");
  });

  it("supports a zero-percent tax rate", () => {
    const result = schedule({ taxConfiguration: percentageTax("0") });

    expect(result.years[0]).toMatchObject({
      taxRateApplied: "0",
      taxExpense: "0",
      profitAfterTax: "450",
    });
  });

  it("supports a 100-percent tax rate", () => {
    const result = schedule({ taxConfiguration: percentageTax("100") });

    expect(result.years[0]).toMatchObject({
      taxExpense: "450",
      profitAfterTax: "0",
    });
  });

  it("applies percentage tax only to positive PBT", () => {
    const tax = unwrap(
      calculatePercentageOfPositiveProfitBeforeTax(
        monetaryAmount("123.45"),
        percentage("20"),
      ),
    );

    expect(tax).toBe("24.69");
  });

  it("produces zero tax when PBT is exactly zero", () => {
    const result = schedule({
      years: [
        yearInput(1, {
          revenue: monetaryAmount("500"),
          operatingExpenses: monetaryAmount("400"),
          depreciation: monetaryAmount("75"),
          interestExpense: monetaryAmount("25"),
        }),
      ],
    });

    expect(result.years[0]).toMatchObject({
      profitBeforeTax: "0",
      taxExpense: "0",
      profitAfterTax: "0",
    });
  });

  it("preserves negative PBT without creating a tax credit", () => {
    const result = schedule({
      years: [
        yearInput(1, {
          revenue: monetaryAmount("500"),
          operatingExpenses: monetaryAmount("400"),
          depreciation: monetaryAmount("100"),
          interestExpense: monetaryAmount("50"),
        }),
      ],
    });

    expect(result.years[0]).toMatchObject({
      profitBeforeTax: "-50",
      taxExpense: "0",
      profitAfterTax: "-50",
    });
    expectYearReconciliation(result.years[0]!);
  });

  it("supports negative EBITDA and downstream losses", () => {
    const result = schedule({
      years: [
        yearInput(1, {
          revenue: monetaryAmount("100"),
          operatingExpenses: monetaryAmount("150"),
          depreciation: monetaryAmount("10"),
          interestExpense: monetaryAmount("5"),
        }),
      ],
    });

    expect(result.years[0]).toMatchObject({
      ebitda: "-50",
      ebit: "-60",
      profitBeforeTax: "-65",
      taxExpense: "0",
      profitAfterTax: "-65",
    });
  });

  it("supports a positive EBITDA followed by negative EBIT", () => {
    const result = schedule({
      years: [
        yearInput(1, {
          revenue: monetaryAmount("500"),
          operatingExpenses: monetaryAmount("400"),
          depreciation: monetaryAmount("150"),
          interestExpense: monetaryAmount("0"),
        }),
      ],
    });

    expect(result.years[0]).toMatchObject({
      ebitda: "100",
      ebit: "-50",
      profitBeforeTax: "-50",
      profitAfterTax: "-50",
    });
  });

  it("supports zero revenue as a valid loss scenario", () => {
    const result = schedule({
      years: [
        yearInput(1, {
          revenue: monetaryAmount("0"),
          operatingExpenses: monetaryAmount("25"),
          depreciation: monetaryAmount("5"),
          interestExpense: monetaryAmount("2"),
        }),
      ],
    });

    expect(result.years[0]).toMatchObject({
      ebitda: "-25",
      profitBeforeTax: "-32",
      taxExpense: "0",
      profitAfterTax: "-32",
    });
  });

  it("supports zero operating expenses", () => {
    const result = schedule({
      years: [yearInput(1, { operatingExpenses: monetaryAmount("0") })],
    });

    expect(result.years[0]?.ebitda).toBe("1000");
  });

  it("supports zero depreciation without reducing EBIT", () => {
    const result = schedule({
      years: [yearInput(1, { depreciation: monetaryAmount("0") })],
    });

    expect(result.years[0]).toMatchObject({ ebitda: "600", ebit: "600" });
  });

  it("supports zero interest without reducing PBT", () => {
    const result = schedule({
      years: [yearInput(1, { interestExpense: monetaryAmount("0") })],
    });

    expect(result.years[0]).toMatchObject({
      ebit: "500",
      profitBeforeTax: "500",
    });
  });

  it("keeps depreciation below EBITDA and interest below EBIT", () => {
    const result = schedule({ taxConfiguration: { mode: "NO_TAX" } });

    expect(result.years[0]).toMatchObject({
      ebitda: "600",
      depreciation: "100",
      ebit: "500",
      interestExpense: "50",
      profitBeforeTax: "450",
    });
  });

  it("uses yearly tax overrides only in their configured years", () => {
    const result = schedule({
      years: [yearInput(1), yearInput(2), yearInput(3), yearInput(4)],
      taxConfiguration: percentageTax("20", {
        yearlyOverrides: [
          {
            year: 2,
            taxRate: { value: percentage("10"), source: sampleUserSource },
          },
          {
            year: 3,
            taxRate: { value: percentage("30"), source: sampleUserSource },
          },
        ],
      }),
    });

    expect(result.years.map((year) => year.taxRateApplied)).toEqual([
      "20",
      "10",
      "30",
      "20",
    ]);
    expect(result.years.map((year) => year.taxExpense)).toEqual([
      "90",
      "45",
      "135",
      "90",
    ]);
  });

  it("preserves Decimal.js precision without intermediate rounding", () => {
    const result = schedule({
      years: [
        yearInput(1, {
          revenue: monetaryAmount("1"),
          operatingExpenses: monetaryAmount("0"),
          depreciation: monetaryAmount("0"),
          interestExpense: monetaryAmount("0"),
        }),
      ],
      taxConfiguration: percentageTax(
        "33.33333333333333333333333333333333333333",
      ),
    });

    expect(result.years[0]).toMatchObject({
      taxExpense: "0.3333333333333333333333333333333333333333",
      profitAfterTax: "0.6666666666666666666666666666666666666667",
    });
    expectYearReconciliation(result.years[0]!);
  });
});

describe("profit-and-loss validation", () => {
  it("rejects duplicate projection years", () => {
    const result = calculateProjectedProfitAndLoss(
      projectionInput({ years: [yearInput(1), yearInput(1)] }),
    );

    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "DUPLICATE_PROFIT_AND_LOSS_YEAR" }),
      ]),
    });
  });

  it.each([0, -1, 1.5])("rejects invalid year %s", (year) => {
    const result = calculateProjectedProfitAndLoss(
      projectionInput({ years: [yearInput(year)] }),
    );

    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "INVALID_PROFIT_AND_LOSS_YEAR" }),
      ]),
    });
  });

  it("rejects non-sequential projection years", () => {
    const result = calculateProjectedProfitAndLoss(
      projectionInput({ years: [yearInput(1), yearInput(3)] }),
    );

    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          code: "INVALID_PROFIT_AND_LOSS_YEAR_SEQUENCE",
        }),
      ]),
    });
  });

  it("rejects an empty P&L schedule", () => {
    const result = calculateProjectedProfitAndLoss(
      projectionInput({ years: [] }),
    );

    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "EMPTY_PROFIT_AND_LOSS_SCHEDULE" }),
      ]),
    });
  });

  it.each([
    ["revenue", "NEGATIVE_PROFIT_AND_LOSS_REVENUE"],
    ["operatingExpenses", "NEGATIVE_PROFIT_AND_LOSS_OPERATING_EXPENSES"],
    ["depreciation", "NEGATIVE_PROFIT_AND_LOSS_DEPRECIATION"],
    ["interestExpense", "NEGATIVE_PROFIT_AND_LOSS_INTEREST_EXPENSE"],
  ] as const)("rejects negative %s input", (field, code) => {
    const result = calculateProjectedProfitAndLoss(
      projectionInput({
        years: [yearInput(1, { [field]: monetaryAmount("-0.01") })],
      }),
    );

    expect(result).toEqual({
      ok: false,
      errors: [expect.objectContaining({ code })],
    });
  });

  it.each(["-0.1", "100.1"])("rejects invalid base tax rate %s", (rate) => {
    const result = calculateProjectedProfitAndLoss(
      projectionInput({ taxConfiguration: percentageTax(rate) }),
    );

    expect(result).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({
          code: "INVALID_PROFIT_AND_LOSS_TAX_RATE",
        }),
      ],
    });
  });

  it("rejects invalid yearly tax override rates", () => {
    const result = calculateProjectedProfitAndLoss(
      projectionInput({
        taxConfiguration: percentageTax("20", {
          yearlyOverrides: [
            {
              year: 1,
              taxRate: {
                value: percentage("100.1"),
                source: sampleUserSource,
              },
            },
          ],
        }),
      }),
    );

    expect(result).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({
          code: "INVALID_PROFIT_AND_LOSS_TAX_RATE",
        }),
      ],
    });
  });

  it("rejects duplicate yearly tax override years", () => {
    const taxRate = { value: percentage("20"), source: sampleUserSource };
    const result = calculateProjectedProfitAndLoss(
      projectionInput({
        taxConfiguration: percentageTax("20", {
          yearlyOverrides: [
            { year: 1, taxRate },
            { year: 1, taxRate },
          ],
        }),
      }),
    );

    expect(result).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({
          code: "DUPLICATE_PROFIT_AND_LOSS_TAX_OVERRIDE_YEAR",
        }),
      ],
    });
  });

  it("rejects a tax override outside the P&L years", () => {
    const result = calculateProjectedProfitAndLoss(
      projectionInput({
        taxConfiguration: percentageTax("20", {
          yearlyOverrides: [
            {
              year: 2,
              taxRate: { value: percentage("10"), source: sampleUserSource },
            },
          ],
        }),
      }),
    );

    expect(result).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({
          code: "TAX_OVERRIDE_OUTSIDE_PROFIT_AND_LOSS_YEARS",
        }),
      ],
    });
  });

  it("rejects missing required tax configuration", () => {
    const malformed = {
      ...projectionInput(),
      taxConfiguration: undefined,
    } as unknown as ProfitAndLossProjectionInput;
    const result = calculateProjectedProfitAndLoss(malformed);

    expect(result).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({
          code: "MISSING_PROFIT_AND_LOSS_TAX_CONFIGURATION",
        }),
      ],
    });
  });

  it("rejects a missing rate for percentage tax", () => {
    const malformed = {
      mode: "PERCENTAGE_OF_POSITIVE_PBT",
      taxRate: undefined,
    } as unknown as ProfitAndLossTaxConfiguration;
    const result = calculateProjectedProfitAndLoss(
      projectionInput({ taxConfiguration: malformed }),
    );

    expect(result).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({
          code: "MISSING_PROFIT_AND_LOSS_TAX_RATE",
        }),
      ],
    });
  });

  it("rejects tax fields incompatible with NO_TAX", () => {
    const malformed = {
      mode: "NO_TAX",
      taxRate: { value: percentage("20"), source: sampleUserSource },
    } as unknown as ProfitAndLossTaxConfiguration;
    const result = calculateProjectedProfitAndLoss(
      projectionInput({ taxConfiguration: malformed }),
    );

    expect(result).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({
          code: "INCOMPATIBLE_PROFIT_AND_LOSS_TAX_CONFIGURATION",
        }),
      ],
    });
  });

  it("rejects an unsupported runtime tax mode", () => {
    const malformed = {
      mode: "STATUTORY_CORPORATE_TAX",
    } as unknown as ProfitAndLossTaxConfiguration;
    const result = calculateProjectedProfitAndLoss(
      projectionInput({ taxConfiguration: malformed }),
    );

    expect(result).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({
          code: "UNSUPPORTED_PROFIT_AND_LOSS_TAX_MODE",
        }),
      ],
    });
  });
});

describe("authoritative schedule composition", () => {
  it("aligns matching projection, depreciation, and interest years", () => {
    const projection = authoritativeProjection([
      { year: 1, revenue: "1000", operatingExpenses: "400" },
      { year: 2, revenue: "1200", operatingExpenses: "450" },
    ]);
    const depreciation = authoritativeDepreciation([
      { year: 1, depreciation: "100" },
      { year: 2, depreciation: "110" },
    ]);
    const interest = authoritativeInterest([
      { year: 1, interestExpense: "50" },
      { year: 2, interestExpense: "40" },
    ]);

    const composed = unwrap(
      composeProfitAndLossYearInputs(projection, depreciation, interest),
    );
    const result = unwrap(
      calculateProfitAndLossFromAuthoritativeSchedules(
        projection,
        depreciation,
        interest,
        percentageTax("25"),
      ),
    );

    expect(composed).toEqual([
      {
        year: 1,
        revenue: "1000",
        operatingExpenses: "400",
        depreciation: "100",
        interestExpense: "50",
      },
      {
        year: 2,
        revenue: "1200",
        operatingExpenses: "450",
        depreciation: "110",
        interestExpense: "40",
      },
    ]);
    expect(result.years.map((year) => year.profitBeforeTax)).toEqual([
      "450",
      "600",
    ]);
  });

  it("copies only normalized P&L flows and excludes loan payments and balances", () => {
    const baseProjection = authoritativeProjection([
      { year: 1, revenue: "1000", operatingExpenses: "400" },
    ]);
    const projection = {
      ...baseProjection,
      years: [
        {
          ...baseProjection.years[0]!,
          operatingSurplusBeforeDepreciationInterestAndTax:
            monetaryAmount("999999"),
        },
      ],
    };
    const baseDepreciation = authoritativeDepreciation([
      { year: 1, depreciation: "100" },
    ]);
    const depreciation = {
      ...baseDepreciation,
      yearlySummaries: [
        {
          ...baseDepreciation.yearlySummaries[0]!,
          additions: monetaryAmount("777777"),
          accumulatedDepreciation: monetaryAmount("888888"),
        },
      ],
    };
    const loanLikeInterestRow = {
      year: 1,
      interestExpense: monetaryAmount("50"),
      principalRepayment: monetaryAmount("900"),
      totalDebtService: monetaryAmount("950"),
      loanDisbursement: monetaryAmount("1000"),
      closingPrincipal: monetaryAmount("100"),
      interestCharged: monetaryAmount("75"),
      interestPaid: monetaryAmount("25"),
      capitalizedInterest: monetaryAmount("10"),
      accruedInterest: monetaryAmount("40"),
    };

    // @ts-expect-error Loan cash-flow/balance fields are forbidden by contract.
    const rejectedLoanRow: ProfitAndLossInterestExpenseYear =
      loanLikeInterestRow;
    const interest = {
      projectId: "project-synthetic-profit-and-loss",
      years: [loanLikeInterestRow],
    } as unknown as ProfitAndLossInterestExpenseSchedule;
    const composed = unwrap(
      composeProfitAndLossYearInputs(projection, depreciation, interest),
    );
    const result = unwrap(
      calculateProfitAndLossFromAuthoritativeSchedules(
        projection,
        depreciation,
        interest,
        { mode: "NO_TAX" },
      ),
    );

    expect(rejectedLoanRow.interestExpense).toBe("50");
    expect(composed).toEqual([
      {
        year: 1,
        revenue: "1000",
        operatingExpenses: "400",
        depreciation: "100",
        interestExpense: "50",
      },
    ]);
    expect(result.years[0]).toMatchObject({
      ebitda: "600",
      ebit: "500",
      profitBeforeTax: "450",
    });
  });

  it("rejects mismatched project identifiers", () => {
    const result = composeProfitAndLossYearInputs(
      authoritativeProjection([
        { year: 1, revenue: "1000", operatingExpenses: "400" },
      ]),
      authoritativeDepreciation(
        [{ year: 1, depreciation: "100" }],
        "different-project",
      ),
      authoritativeInterest([{ year: 1, interestExpense: "50" }]),
    );

    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          code: "PROFIT_AND_LOSS_PROJECT_ID_MISMATCH",
        }),
      ]),
    });
  });

  it("rejects missing depreciation and interest by default", () => {
    const result = composeProfitAndLossYearInputs(
      authoritativeProjection([
        { year: 1, revenue: "1000", operatingExpenses: "400" },
        { year: 2, revenue: "1200", operatingExpenses: "450" },
      ]),
      authoritativeDepreciation([{ year: 1, depreciation: "100" }]),
      authoritativeInterest([{ year: 1, interestExpense: "50" }]),
    );

    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          code: "MISSING_DEPRECIATION_FOR_PROFIT_AND_LOSS_YEAR",
        }),
        expect.objectContaining({
          code: "MISSING_INTEREST_FOR_PROFIT_AND_LOSS_YEAR",
        }),
      ]),
    });
  });

  it("uses zero for missing values only under an explicit policy", () => {
    const result = unwrap(
      composeProfitAndLossYearInputs(
        authoritativeProjection([
          { year: 1, revenue: "1000", operatingExpenses: "400" },
          { year: 2, revenue: "1200", operatingExpenses: "450" },
        ]),
        authoritativeDepreciation([{ year: 1, depreciation: "100" }]),
        authoritativeInterest([{ year: 1, interestExpense: "50" }]),
        {
          missingDepreciation: "USE_EXPLICIT_ZERO",
          missingInterestExpense: "USE_EXPLICIT_ZERO",
        },
      ),
    );

    expect(result[1]).toEqual({
      year: 2,
      revenue: "1200",
      operatingExpenses: "450",
      depreciation: "0",
      interestExpense: "0",
    });
  });

  it("accepts supplied numeric zero under the strict composition policy", () => {
    const result = unwrap(
      composeProfitAndLossYearInputs(
        authoritativeProjection([
          { year: 1, revenue: "0", operatingExpenses: "0" },
        ]),
        authoritativeDepreciation([{ year: 1, depreciation: "0" }]),
        authoritativeInterest([{ year: 1, interestExpense: "0" }]),
      ),
    );

    expect(result).toEqual([
      {
        year: 1,
        revenue: "0",
        operatingExpenses: "0",
        depreciation: "0",
        interestExpense: "0",
      },
    ]);
  });

  it("rejects duplicate upstream years", () => {
    const result = composeProfitAndLossYearInputs(
      authoritativeProjection([
        { year: 1, revenue: "1000", operatingExpenses: "400" },
      ]),
      authoritativeDepreciation([
        { year: 1, depreciation: "100" },
        { year: 1, depreciation: "110" },
      ]),
      authoritativeInterest([{ year: 1, interestExpense: "50" }]),
    );

    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          code: "DUPLICATE_DEPRECIATION_SOURCE_YEAR",
        }),
      ]),
    });
  });

  it("rejects depreciation or interest years absent from the projection", () => {
    const result = composeProfitAndLossYearInputs(
      authoritativeProjection([
        { year: 1, revenue: "1000", operatingExpenses: "400" },
      ]),
      authoritativeDepreciation([
        { year: 1, depreciation: "100" },
        { year: 2, depreciation: "110" },
      ]),
      authoritativeInterest([
        { year: 1, interestExpense: "50" },
        { year: 2, interestExpense: "40" },
      ]),
    );

    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          code: "DEPRECIATION_YEAR_NOT_IN_PROJECTION",
        }),
        expect.objectContaining({ code: "INTEREST_YEAR_NOT_IN_PROJECTION" }),
      ]),
    });
  });

  it("rejects negative authoritative source amounts after alignment", () => {
    const result = composeProfitAndLossYearInputs(
      authoritativeProjection([
        { year: 1, revenue: "1000", operatingExpenses: "400" },
      ]),
      authoritativeDepreciation([{ year: 1, depreciation: "-1" }]),
      authoritativeInterest([{ year: 1, interestExpense: "-2" }]),
    );

    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          code: "NEGATIVE_PROFIT_AND_LOSS_DEPRECIATION",
        }),
        expect.objectContaining({
          code: "NEGATIVE_PROFIT_AND_LOSS_INTEREST_EXPENSE",
        }),
      ]),
    });
  });
});
