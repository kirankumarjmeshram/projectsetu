import { describe, expect, it } from "vitest";

import type { CalculationResult } from "../shared/calculation";
import {
  decimalValue,
  monetaryAmount,
  percentage,
  percentageToFactor,
  toDecimal,
  toMonetaryAmount,
} from "../shared/decimal";
import { sampleUserSource } from "../testing/domain-fixtures";
import {
  calculateOperatingExpenseProjection,
  calculateRevenueAndOperatingExpenseProjection,
  calculateRevenueProjection,
} from "./calculations";
import type {
  FixedOperatingExpenseProjectionAssumption,
  OperatingExpenseProjectionAssumption,
  PercentageOperatingExpenseProjectionAssumption,
  ProjectionOperatingExpenseCategory,
  RevenueAndOperatingExpenseProjection,
  RevenueAndOperatingExpenseProjectionInput,
  RevenueProjection,
  RevenueProjectionAssumption,
} from "./projection";

function unwrap<TValue>(result: CalculationResult<TValue>): TValue {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(result.errors.map((error) => error.code).join(", "));
  }

  return result.value;
}

function revenueAssumption(
  overrides: Partial<RevenueProjectionAssumption> = {},
): RevenueProjectionAssumption {
  return {
    id: "revenue-synthetic-product",
    productOrServiceName: "Synthetic Product",
    unit: "unit",
    quantity: { value: decimalValue("100"), source: sampleUserSource },
    unitPrice: { value: monetaryAmount("10"), source: sampleUserSource },
    capacityUtilisation: {
      value: percentage("100"),
      source: sampleUserSource,
    },
    quantityGrowth: { value: percentage("0"), source: sampleUserSource },
    sellingPriceEscalation: {
      value: percentage("0"),
      source: sampleUserSource,
    },
    ...overrides,
  };
}

function fixedExpense(
  id: string,
  category: ProjectionOperatingExpenseCategory,
  amount: string,
  escalation = "0",
  overrides: Partial<FixedOperatingExpenseProjectionAssumption> = {},
): FixedOperatingExpenseProjectionAssumption {
  return {
    id,
    name: "Synthetic Fixed Expense",
    category,
    calculationMethod: "FIXED_ANNUAL_AMOUNT",
    annualAmount: {
      value: monetaryAmount(amount),
      source: sampleUserSource,
    },
    annualEscalation: {
      value: percentage(escalation),
      source: sampleUserSource,
    },
    ...overrides,
  };
}

function percentageExpense(
  id: string,
  category: ProjectionOperatingExpenseCategory,
  rate: string,
  escalation = "0",
  overrides: Partial<PercentageOperatingExpenseProjectionAssumption> = {},
): PercentageOperatingExpenseProjectionAssumption {
  return {
    id,
    name: "Synthetic Percentage Expense",
    category,
    calculationMethod: "PERCENTAGE_OF_REVENUE",
    percentageOfRevenue: {
      value: percentage(rate),
      source: sampleUserSource,
    },
    annualEscalation: {
      value: percentage(escalation),
      source: sampleUserSource,
    },
    ...overrides,
  };
}

function projectionInput(
  overrides: Partial<RevenueAndOperatingExpenseProjectionInput> = {},
): RevenueAndOperatingExpenseProjectionInput {
  return {
    projectId: "project-synthetic-projection",
    projectionPeriodYears: 1,
    revenueAssumptions: [revenueAssumption()],
    operatingExpenseAssumptions: [],
    ...overrides,
  };
}

function projection(
  overrides: Partial<RevenueAndOperatingExpenseProjectionInput> = {},
): RevenueAndOperatingExpenseProjection {
  return unwrap(
    calculateRevenueAndOperatingExpenseProjection(projectionInput(overrides)),
  );
}

function sumAmounts(values: readonly string[]): string {
  let total = toDecimal(monetaryAmount("0"));

  for (const value of values) {
    total = total.plus(toDecimal(monetaryAmount(value)));
  }

  return toMonetaryAmount(total);
}

describe("revenue and operating-expense projection", () => {
  it("calculates a one-year projection and operating surplus", () => {
    const result = projection({
      revenueAssumptions: [
        revenueAssumption({
          capacityUtilisation: {
            value: percentage("80"),
            source: sampleUserSource,
          },
        }),
      ],
      operatingExpenseAssumptions: [
        fixedExpense("raw-material", "RAW_MATERIALS", "100"),
        percentageExpense("wages", "WAGES", "10"),
      ],
    });

    expect(result.years).toHaveLength(1);
    expect(result.years[0]).toMatchObject({
      year: 1,
      totalRevenue: "800",
      rawMaterialAndVariableCosts: "100",
      wages: "80",
      totalOperatingExpenses: "180",
      operatingSurplusBeforeDepreciationInterestAndTax: "620",
    });
    expect(result.years[0]?.revenueLines[0]).toMatchObject({
      quantity: "100",
      capacityUtilisation: "80",
      effectiveQuantity: "80",
      unitPrice: "10",
      revenue: "800",
    });
  });

  it("keeps multi-year values unchanged when growth rates are zero", () => {
    const result = projection({ projectionPeriodYears: 3 });

    expect(result.years.map((year) => year.totalRevenue)).toEqual([
      "1000",
      "1000",
      "1000",
    ]);
  });

  it("compounds quantity growth from one year to the next", () => {
    const result = projection({
      projectionPeriodYears: 3,
      revenueAssumptions: [
        revenueAssumption({
          quantityGrowth: {
            value: percentage("10"),
            source: sampleUserSource,
          },
        }),
      ],
    });

    expect(result.years.map((year) => year.revenueLines[0]?.quantity)).toEqual([
      "100",
      "110",
      "121",
    ]);
    expect(result.years.map((year) => year.totalRevenue)).toEqual([
      "1000",
      "1100",
      "1210",
    ]);
  });

  it("supports declining quantity through negative growth", () => {
    const result = projection({
      projectionPeriodYears: 3,
      revenueAssumptions: [
        revenueAssumption({
          quantityGrowth: {
            value: percentage("-10"),
            source: sampleUserSource,
          },
        }),
      ],
    });

    expect(result.years.map((year) => year.revenueLines[0]?.quantity)).toEqual([
      "100",
      "90",
      "81",
    ]);
    expect(result.years.map((year) => year.totalRevenue)).toEqual([
      "1000",
      "900",
      "810",
    ]);
  });

  it("compounds selling-price escalation independently", () => {
    const result = projection({
      projectionPeriodYears: 3,
      revenueAssumptions: [
        revenueAssumption({
          sellingPriceEscalation: {
            value: percentage("5"),
            source: sampleUserSource,
          },
        }),
      ],
    });

    expect(result.years.map((year) => year.revenueLines[0]?.unitPrice)).toEqual(
      ["10", "10.5", "11.025"],
    );
    expect(result.years.map((year) => year.totalRevenue)).toEqual([
      "1000",
      "1050",
      "1102.5",
    ]);
  });

  it("supports declining unit price through negative escalation", () => {
    const result = projection({
      projectionPeriodYears: 3,
      revenueAssumptions: [
        revenueAssumption({
          sellingPriceEscalation: {
            value: percentage("-20"),
            source: sampleUserSource,
          },
        }),
      ],
    });

    expect(result.years.map((year) => year.revenueLines[0]?.unitPrice)).toEqual(
      ["10", "8", "6.4"],
    );
    expect(result.years.map((year) => year.totalRevenue)).toEqual([
      "1000",
      "800",
      "640",
    ]);
  });

  it("supports explicit yearly capacity-utilisation assumptions", () => {
    const result = projection({
      projectionPeriodYears: 3,
      revenueAssumptions: [
        revenueAssumption({
          capacityUtilisation: {
            value: percentage("50"),
            source: sampleUserSource,
          },
          yearlyOverrides: [
            {
              year: 2,
              capacityUtilisation: {
                value: percentage("75"),
                source: sampleUserSource,
              },
            },
          ],
        }),
      ],
    });

    expect(result.years.map((year) => year.totalRevenue)).toEqual([
      "500",
      "750",
      "500",
    ]);
  });

  it("uses explicit quantity and price overrides as the next growth base", () => {
    const result = projection({
      projectionPeriodYears: 3,
      revenueAssumptions: [
        revenueAssumption({
          quantityGrowth: {
            value: percentage("10"),
            source: sampleUserSource,
          },
          sellingPriceEscalation: {
            value: percentage("5"),
            source: sampleUserSource,
          },
          yearlyOverrides: [
            {
              year: 2,
              quantity: {
                value: decimalValue("200"),
                source: sampleUserSource,
              },
              unitPrice: {
                value: monetaryAmount("20"),
                source: sampleUserSource,
              },
            },
          ],
        }),
      ],
    });

    expect(result.years.map((year) => year.totalRevenue)).toEqual([
      "1000",
      "4000",
      "4620",
    ]);
    expect(result.years[2]?.revenueLines[0]).toMatchObject({
      quantity: "220",
      unitPrice: "21",
    });
  });

  it("aggregates multiple product and service lines", () => {
    const result = projection({
      revenueAssumptions: [
        revenueAssumption({ id: "product-one" }),
        revenueAssumption({
          id: "service-two",
          productOrServiceName: "Synthetic Service",
          quantity: {
            value: decimalValue("50"),
            source: sampleUserSource,
          },
          unitPrice: {
            value: monetaryAmount("20"),
            source: sampleUserSource,
          },
          capacityUtilisation: {
            value: percentage("50"),
            source: sampleUserSource,
          },
        }),
      ],
    });

    expect(result.years[0]?.revenueLines).toHaveLength(2);
    expect(result.years[0]?.totalRevenue).toBe("1500");
  });

  it("allows zero revenue through zero capacity utilisation", () => {
    const result = projection({
      revenueAssumptions: [
        revenueAssumption({
          capacityUtilisation: {
            value: percentage("0"),
            source: sampleUserSource,
          },
        }),
      ],
      operatingExpenseAssumptions: [
        percentageExpense("raw-material", "RAW_MATERIALS", "25"),
      ],
    });

    expect(result.years[0]).toMatchObject({
      totalRevenue: "0",
      totalOperatingExpenses: "0",
      operatingSurplusBeforeDepreciationInterestAndTax: "0",
    });
  });

  it("allows zero quantity and produces valid zero revenue", () => {
    const result = projection({
      revenueAssumptions: [
        revenueAssumption({
          quantity: {
            value: decimalValue("0"),
            source: sampleUserSource,
          },
        }),
      ],
    });

    expect(result.years[0]?.revenueLines[0]).toMatchObject({
      quantity: "0",
      effectiveQuantity: "0",
      revenue: "0",
    });
    expect(result.years[0]?.totalRevenue).toBe("0");
  });

  it("allows zero unit price and produces valid zero revenue", () => {
    const result = projection({
      revenueAssumptions: [
        revenueAssumption({
          unitPrice: {
            value: monetaryAmount("0"),
            source: sampleUserSource,
          },
        }),
      ],
    });

    expect(result.years[0]?.revenueLines[0]).toMatchObject({
      unitPrice: "0",
      revenue: "0",
    });
    expect(result.years[0]?.totalRevenue).toBe("0");
  });

  it("allows no revenue lines and still produces canonical zero rows", () => {
    const result = projection({
      projectionPeriodYears: 2,
      revenueAssumptions: [],
    });

    expect(result.years).toEqual([
      expect.objectContaining({ year: 1, totalRevenue: "0" }),
      expect.objectContaining({ year: 2, totalRevenue: "0" }),
    ]);
  });

  it("preserves exact decimal precision without binary floating artifacts", () => {
    const result = projection({
      revenueAssumptions: [
        revenueAssumption({
          quantity: {
            value: decimalValue("0.1"),
            source: sampleUserSource,
          },
          unitPrice: {
            value: monetaryAmount("0.2"),
            source: sampleUserSource,
          },
          capacityUtilisation: {
            value: percentage("12.5"),
            source: sampleUserSource,
          },
        }),
      ],
    });

    expect(result.years[0]?.revenueLines[0]).toMatchObject({
      effectiveQuantity: "0.0125",
      revenue: "0.0025",
    });
    expect(result.years[0]?.totalRevenue).toBe("0.0025");
  });
});

describe("operating-expense projection", () => {
  it("compounds fixed annual expense escalation", () => {
    const result = projection({
      projectionPeriodYears: 3,
      operatingExpenseAssumptions: [fixedExpense("rent", "RENT", "100", "10")],
    });

    expect(result.years.map((year) => year.totalOperatingExpenses)).toEqual([
      "100",
      "110",
      "121",
    ]);
  });

  it("calculates percentage-based expenses from each year's revenue", () => {
    const result = projection({
      projectionPeriodYears: 3,
      revenueAssumptions: [
        revenueAssumption({
          quantityGrowth: {
            value: percentage("10"),
            source: sampleUserSource,
          },
        }),
      ],
      operatingExpenseAssumptions: [
        percentageExpense("raw-material", "RAW_MATERIALS", "25"),
      ],
    });

    expect(result.years.map((year) => year.totalOperatingExpenses)).toEqual([
      "250",
      "275",
      "302.5",
    ]);
  });

  it("can explicitly escalate a percentage-of-revenue rate", () => {
    const result = projection({
      projectionPeriodYears: 3,
      operatingExpenseAssumptions: [
        percentageExpense(
          "marketing",
          "MARKETING_AND_ADVERTISEMENT",
          "10",
          "10",
        ),
      ],
    });

    expect(
      result.years.map((year) => year.lines[0]?.percentageOfRevenue),
    ).toEqual(["10", "11", "12.1"]);
    expect(result.years.map((year) => year.totalOperatingExpenses)).toEqual([
      "100",
      "110",
      "121",
    ]);
  });

  it("supports declining fixed expenses and percentage-of-revenue rates", () => {
    const result = projection({
      projectionPeriodYears: 3,
      operatingExpenseAssumptions: [
        fixedExpense("rent", "RENT", "100", "-10"),
        percentageExpense("raw", "RAW_MATERIALS", "10", "-10"),
      ],
    });

    expect(result.years.map((year) => year.totalOperatingExpenses)).toEqual([
      "200",
      "180",
      "162",
    ]);
    expect(
      result.years.map((year) => year.lines[1]?.percentageOfRevenue),
    ).toEqual(["10", "9", "8.1"]);
  });

  it("uses a fixed-expense override as the next escalation base", () => {
    const result = projection({
      projectionPeriodYears: 3,
      operatingExpenseAssumptions: [
        fixedExpense("rent", "RENT", "100", "10", {
          yearlyOverrides: [
            {
              year: 2,
              annualAmount: {
                value: monetaryAmount("500"),
                source: sampleUserSource,
              },
              annualEscalation: {
                value: percentage("0"),
                source: sampleUserSource,
              },
            },
          ],
        }),
      ],
    });

    expect(result.years.map((year) => year.totalOperatingExpenses)).toEqual([
      "100",
      "500",
      "500",
    ]);
  });

  it("supports zero fixed expense and an empty expense collection", () => {
    const zeroLine = projection({
      operatingExpenseAssumptions: [
        fixedExpense("zero-expense", "CUSTOM", "0"),
      ],
    });
    const noLines = projection({ operatingExpenseAssumptions: [] });

    expect(zeroLine.years[0]?.totalOperatingExpenses).toBe("0");
    expect(noLines.years[0]).toMatchObject({
      totalOperatingExpenses: "0",
      operatingSurplusBeforeDepreciationInterestAndTax: "1000",
    });
  });

  it("aggregates multiple expense categories into transparent groups", () => {
    const result = projection({
      operatingExpenseAssumptions: [
        fixedExpense("raw", "RAW_MATERIALS", "100"),
        fixedExpense("wages", "WAGES", "50"),
        fixedExpense("salaries", "SALARIES", "60"),
        fixedExpense("power", "POWER_AND_ELECTRICITY", "20"),
        fixedExpense("fuel", "FUEL", "30"),
        fixedExpense("repairs", "REPAIRS_AND_MAINTENANCE", "10"),
        fixedExpense("rent", "RENT", "40"),
        percentageExpense("transport", "TRANSPORT", "5"),
        fixedExpense("custom", "CUSTOM", "15"),
      ],
    });

    expect(result.years[0]?.lines).toHaveLength(9);
    expect(result.years[0]).toMatchObject({
      rawMaterialAndVariableCosts: "150",
      wages: "50",
      salaries: "60",
      utilities: "50",
      repairsAndMaintenance: "10",
      administrativeAndOtherOperatingCosts: "55",
      totalOperatingExpenses: "375",
      operatingSurplusBeforeDepreciationInterestAndTax: "625",
    });
  });

  it("reconciles yearly revenue, category, expense, and surplus totals exactly", () => {
    const result = projection({
      projectionPeriodYears: 3,
      revenueAssumptions: [
        revenueAssumption({
          id: "product-one",
          quantityGrowth: {
            value: percentage("7.5"),
            source: sampleUserSource,
          },
        }),
        revenueAssumption({
          id: "product-two",
          quantity: {
            value: decimalValue("25.5"),
            source: sampleUserSource,
          },
          unitPrice: {
            value: monetaryAmount("3.75"),
            source: sampleUserSource,
          },
        }),
      ],
      operatingExpenseAssumptions: [
        percentageExpense("raw", "RAW_MATERIALS", "22.5"),
        fixedExpense("salary", "SALARIES", "123.45", "5"),
        fixedExpense("power", "POWER_AND_ELECTRICITY", "20.25", "2.5"),
        fixedExpense("admin", "ADMINISTRATIVE_EXPENSES", "10.1"),
      ],
    });

    for (const year of result.years) {
      expect(sumAmounts(year.revenueLines.map((line) => line.revenue))).toBe(
        year.totalRevenue,
      );
      expect(sumAmounts(year.lines.map((line) => line.amount))).toBe(
        year.totalOperatingExpenses,
      );
      expect(
        sumAmounts([
          year.rawMaterialAndVariableCosts,
          year.wages,
          year.salaries,
          year.utilities,
          year.repairsAndMaintenance,
          year.administrativeAndOtherOperatingCosts,
        ]),
      ).toBe(year.totalOperatingExpenses);
      expect(
        toMonetaryAmount(
          toDecimal(year.totalRevenue).minus(
            toDecimal(year.totalOperatingExpenses),
          ),
        ),
      ).toBe(year.operatingSurplusBeforeDepreciationInterestAndTax);

      for (const line of year.lines) {
        if (
          line.calculationMethod === "PERCENTAGE_OF_REVENUE" &&
          line.percentageOfRevenue
        ) {
          expect(line.amount).toBe(
            toMonetaryAmount(
              toDecimal(year.totalRevenue).times(
                percentageToFactor(line.percentageOfRevenue),
              ),
            ),
          );
        }
      }
    }
  });
});

describe("projection validation", () => {
  it.each([0, -1, 1.5])(
    "rejects invalid projection period %s",
    (projectionPeriodYears) => {
      const result = calculateRevenueAndOperatingExpenseProjection(
        projectionInput({ projectionPeriodYears }),
      );

      expect(result).toEqual({
        ok: false,
        errors: [
          expect.objectContaining({ code: "INVALID_PROJECTION_PERIOD" }),
        ],
      });
    },
  );

  it("rejects negative quantity", () => {
    const result = calculateRevenueProjection(
      [
        revenueAssumption({
          quantity: {
            value: decimalValue("-1"),
            source: sampleUserSource,
          },
        }),
      ],
      1,
    );

    expect(result).toEqual({
      ok: false,
      errors: [expect.objectContaining({ code: "INVALID_REVENUE_QUANTITY" })],
    });
  });

  it("rejects negative unit price", () => {
    const result = calculateRevenueProjection(
      [
        revenueAssumption({
          unitPrice: {
            value: monetaryAmount("-1"),
            source: sampleUserSource,
          },
        }),
      ],
      1,
    );

    expect(result).toEqual({
      ok: false,
      errors: [expect.objectContaining({ code: "INVALID_REVENUE_UNIT_PRICE" })],
    });
  });

  it.each(["-0.1", "100.1"])(
    "rejects invalid capacity utilisation %s",
    (capacityUtilisation) => {
      const result = calculateRevenueProjection(
        [
          revenueAssumption({
            capacityUtilisation: {
              value: percentage(capacityUtilisation),
              source: sampleUserSource,
            },
          }),
        ],
        1,
      );

      expect(result).toEqual({
        ok: false,
        errors: [
          expect.objectContaining({ code: "INVALID_CAPACITY_UTILISATION" }),
        ],
      });
    },
  );

  it("rejects growth and escalation rates below -100 percent", () => {
    const result = calculateRevenueProjection(
      [
        revenueAssumption({
          quantityGrowth: {
            value: percentage("-100.1"),
            source: sampleUserSource,
          },
          sellingPriceEscalation: {
            value: percentage("-101"),
            source: sampleUserSource,
          },
        }),
      ],
      1,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((error) => error.code)).toEqual([
        "INVALID_QUANTITY_GROWTH",
        "INVALID_SELLING_PRICE_ESCALATION",
      ]);
    }
  });

  it("rejects negative fixed expenses and escalation below -100 percent", () => {
    const result = calculateRevenueAndOperatingExpenseProjection(
      projectionInput({
        operatingExpenseAssumptions: [
          fixedExpense("rent", "RENT", "-1", "-100.1"),
        ],
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((error) => error.code)).toEqual([
        "INVALID_OPERATING_EXPENSE_AMOUNT",
        "INVALID_OPERATING_EXPENSE_ESCALATION",
      ]);
    }
  });

  it("rejects percentage-rate escalation below -100 percent", () => {
    const result = calculateRevenueAndOperatingExpenseProjection(
      projectionInput({
        operatingExpenseAssumptions: [
          percentageExpense("raw", "RAW_MATERIALS", "10", "-100.1"),
        ],
      }),
    );

    expect(result).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({
          code: "INVALID_OPERATING_EXPENSE_ESCALATION",
        }),
      ],
    });
  });

  it.each(["-1", "100.1"])(
    "rejects invalid percentage-based expense rate %s",
    (rate) => {
      const result = calculateRevenueAndOperatingExpenseProjection(
        projectionInput({
          operatingExpenseAssumptions: [
            percentageExpense("raw", "RAW_MATERIALS", rate),
          ],
        }),
      );

      expect(result).toEqual({
        ok: false,
        errors: [
          expect.objectContaining({
            code: "INVALID_OPERATING_EXPENSE_PERCENTAGE",
          }),
        ],
      });
    },
  );

  it("rejects duplicate and out-of-range yearly overrides", () => {
    const result = calculateRevenueProjection(
      [
        revenueAssumption({
          yearlyOverrides: [{ year: 2 }, { year: 2 }, { year: 4 }],
        }),
      ],
      3,
    );

    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          code: "DUPLICATE_PROJECTION_OVERRIDE_YEAR",
        }),
        expect.objectContaining({ code: "INVALID_PROJECTION_OVERRIDE_YEAR" }),
      ]),
    });
  });

  it("rejects an escalated percentage that exceeds 100 in a projected year", () => {
    const result = calculateRevenueAndOperatingExpenseProjection(
      projectionInput({
        projectionPeriodYears: 2,
        operatingExpenseAssumptions: [
          percentageExpense("raw", "RAW_MATERIALS", "90", "20"),
        ],
      }),
    );

    expect(result).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({
          code: "PROJECTED_OPERATING_EXPENSE_PERCENTAGE_EXCEEDS_100",
        }),
      ],
    });
  });

  it("rejects an unsupported runtime expense method", () => {
    const malformed = {
      id: "unsupported-expense",
      name: "Synthetic Unsupported Expense",
      category: "CUSTOM",
      calculationMethod: "PER_UNIT",
    } as unknown as OperatingExpenseProjectionAssumption;
    const result = calculateRevenueAndOperatingExpenseProjection(
      projectionInput({ operatingExpenseAssumptions: [malformed] }),
    );

    expect(result).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({
          code: "UNSUPPORTED_OPERATING_EXPENSE_METHOD",
        }),
      ],
    });
  });

  it("rejects incomplete and non-sequential external revenue projections", () => {
    const incomplete: RevenueProjection = {
      projectionPeriodYears: 2,
      years: [{ year: 2, lines: [], totalRevenue: monetaryAmount("0") }],
    };
    const result = calculateOperatingExpenseProjection([], incomplete);

    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "INCOMPLETE_REVENUE_PROJECTION" }),
        expect.objectContaining({ code: "INVALID_REVENUE_PROJECTION_YEAR" }),
      ]),
    });
  });
});
