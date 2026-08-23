import { describe, expect, it } from "vitest";

import type { CalculationResult } from "../shared/calculation";
import {
  monetaryAmount,
  percentage,
  toDecimal,
  toMonetaryAmount,
} from "../shared/decimal";
import { sampleUserSource } from "../testing/domain-fixtures";
import {
  calculateAssetDepreciationSchedule,
  calculateDepreciationSchedule,
  calculateStraightLineAnnualDepreciation,
  calculateWrittenDownValueDepreciation,
} from "./calculations";
import type {
  AssetDepreciationSchedule,
  DepreciableAsset,
  DepreciationAssetAddition,
  DepreciationProjectionInput,
  DepreciationSchedule,
  StraightLineDepreciableAsset,
  WrittenDownValueDepreciableAsset,
} from "./depreciation";

function unwrap<TValue>(result: CalculationResult<TValue>): TValue {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(result.errors.map((error) => error.code).join(", "));
  }

  return result.value;
}

function straightLineAsset(
  overrides: Partial<StraightLineDepreciableAsset> = {},
): StraightLineDepreciableAsset {
  return {
    id: "asset-synthetic-straight-line",
    name: "Synthetic Straight-Line Asset",
    category: "EQUIPMENT",
    originalCost: {
      value: monetaryAmount("1000"),
      source: sampleUserSource,
    },
    residualValue: {
      value: monetaryAmount("100"),
      source: sampleUserSource,
    },
    method: "STRAIGHT_LINE",
    usefulLifeYears: { value: 3, source: sampleUserSource },
    depreciationStartYear: 1,
    ...overrides,
  };
}

function writtenDownValueAsset(
  overrides: Partial<WrittenDownValueDepreciableAsset> = {},
): WrittenDownValueDepreciableAsset {
  return {
    id: "asset-synthetic-wdv",
    name: "Synthetic WDV Asset",
    category: "PLANT_AND_MACHINERY",
    originalCost: {
      value: monetaryAmount("1000"),
      source: sampleUserSource,
    },
    residualValue: {
      value: monetaryAmount("0"),
      source: sampleUserSource,
    },
    method: "WRITTEN_DOWN_VALUE",
    depreciationRate: {
      value: percentage("20"),
      source: sampleUserSource,
    },
    depreciationStartYear: 1,
    ...overrides,
  };
}

function addition(
  id: string,
  year: number,
  cost: string,
  residualValue = "0",
): DepreciationAssetAddition {
  return {
    id,
    year,
    cost: { value: monetaryAmount(cost), source: sampleUserSource },
    residualValue: {
      value: monetaryAmount(residualValue),
      source: sampleUserSource,
    },
  };
}

function input(
  overrides: Partial<DepreciationProjectionInput> = {},
): DepreciationProjectionInput {
  return {
    projectId: "project-synthetic-depreciation",
    projectionPeriodYears: 3,
    assets: [straightLineAsset()],
    ...overrides,
  };
}

function schedule(
  overrides: Partial<DepreciationProjectionInput> = {},
): DepreciationSchedule {
  return unwrap(calculateDepreciationSchedule(input(overrides)));
}

function sumAmounts(values: readonly string[]): string {
  let total = toDecimal(monetaryAmount("0"));

  for (const value of values) {
    total = total.plus(toDecimal(monetaryAmount(value)));
  }

  return toMonetaryAmount(total);
}

function expectAssetReconciliation(
  assetSchedule: AssetDepreciationSchedule,
): void {
  for (const [index, year] of assetSchedule.years.entries()) {
    expect(
      toMonetaryAmount(
        toDecimal(year.openingCarryingValue)
          .plus(toDecimal(year.additions))
          .minus(toDecimal(year.depreciation)),
      ),
    ).toBe(year.closingCarryingValue);
    expect(
      toMonetaryAmount(
        toDecimal(year.openingGrossValue).plus(toDecimal(year.additions)),
      ),
    ).toBe(year.closingGrossValue);
    expect(
      toMonetaryAmount(
        toDecimal(year.closingGrossValue).minus(
          toDecimal(year.closingCarryingValue),
        ),
      ),
    ).toBe(year.accumulatedDepreciation);
    expect(toDecimal(year.depreciation).isNegative()).toBe(false);
    expect(toDecimal(year.closingCarryingValue).isNegative()).toBe(false);
    expect(
      toDecimal(year.closingCarryingValue).greaterThanOrEqualTo(
        toDecimal(year.residualValue),
      ),
    ).toBe(true);

    if (index > 0) {
      const previousYear = assetSchedule.years[index - 1]!;

      expect(year.openingCarryingValue).toBe(previousYear.closingCarryingValue);
      expect(year.openingGrossValue).toBe(previousYear.closingGrossValue);
      expect(
        toMonetaryAmount(
          toDecimal(previousYear.accumulatedDepreciation).plus(
            toDecimal(year.depreciation),
          ),
        ),
      ).toBe(year.accumulatedDepreciation);
    }
  }
}

function expectAggregateReconciliation(
  depreciationSchedule: DepreciationSchedule,
): void {
  for (const [
    index,
    yearlySummary,
  ] of depreciationSchedule.yearlySummaries.entries()) {
    const assetRows = depreciationSchedule.assetSchedules.flatMap(({ years }) =>
      years.filter(({ year }) => year === yearlySummary.year),
    );

    expect(sumAmounts(assetRows.map((row) => row.openingGrossValue))).toBe(
      yearlySummary.openingGrossFixedAssets,
    );
    expect(sumAmounts(assetRows.map((row) => row.additions))).toBe(
      yearlySummary.additions,
    );
    expect(sumAmounts(assetRows.map((row) => row.depreciation))).toBe(
      yearlySummary.depreciation,
    );
    expect(
      sumAmounts(assetRows.map((row) => row.accumulatedDepreciation)),
    ).toBe(yearlySummary.accumulatedDepreciation);
    expect(sumAmounts(assetRows.map((row) => row.closingGrossValue))).toBe(
      yearlySummary.closingGrossFixedAssets,
    );
    expect(sumAmounts(assetRows.map((row) => row.closingCarryingValue))).toBe(
      yearlySummary.closingNetCarryingValue,
    );
    expect(
      toMonetaryAmount(
        toDecimal(yearlySummary.openingGrossFixedAssets).plus(
          toDecimal(yearlySummary.additions),
        ),
      ),
    ).toBe(yearlySummary.closingGrossFixedAssets);
    expect(
      toMonetaryAmount(
        toDecimal(yearlySummary.closingGrossFixedAssets).minus(
          toDecimal(yearlySummary.accumulatedDepreciation),
        ),
      ),
    ).toBe(yearlySummary.closingNetCarryingValue);

    if (index > 0) {
      const previousSummary = depreciationSchedule.yearlySummaries[index - 1]!;

      expect(yearlySummary.openingGrossFixedAssets).toBe(
        previousSummary.closingGrossFixedAssets,
      );
      expect(
        toMonetaryAmount(
          toDecimal(previousSummary.closingNetCarryingValue)
            .plus(toDecimal(yearlySummary.additions))
            .minus(toDecimal(yearlySummary.depreciation)),
        ),
      ).toBe(yearlySummary.closingNetCarryingValue);
      expect(
        toMonetaryAmount(
          toDecimal(previousSummary.accumulatedDepreciation).plus(
            toDecimal(yearlySummary.depreciation),
          ),
        ),
      ).toBe(yearlySummary.accumulatedDepreciation);
    }
  }
}

describe("depreciation formulas", () => {
  it("calculates the straight-line annual amount from cost less residual value", () => {
    const result = unwrap(
      calculateStraightLineAnnualDepreciation(
        monetaryAmount("1000"),
        monetaryAmount("100"),
        3,
      ),
    );

    expect(result).toBe("300");
  });

  it("calculates WDV on opening carrying value plus full-year additions", () => {
    const result = unwrap(
      calculateWrittenDownValueDepreciation(
        monetaryAmount("900"),
        monetaryAmount("200"),
        monetaryAmount("0"),
        percentage("10"),
      ),
    );

    expect(result).toBe("110");
  });

  it("caps WDV depreciation at the residual floor", () => {
    const result = unwrap(
      calculateWrittenDownValueDepreciation(
        monetaryAmount("1000"),
        monetaryAmount("0"),
        monetaryAmount("500"),
        percentage("60"),
      ),
    );

    expect(result).toBe("500");
  });
});

describe("straight-line schedules", () => {
  it("depreciates one asset evenly and reaches residual value exactly", () => {
    const result = schedule();
    const assetYears = result.assetSchedules[0]?.years ?? [];

    expect(assetYears).toHaveLength(3);
    expect(assetYears.map((year) => year.depreciation)).toEqual([
      "300",
      "300",
      "300",
    ]);
    expect(assetYears.map((year) => year.closingCarryingValue)).toEqual([
      "700",
      "400",
      "100",
    ]);
    expect(assetYears.map((year) => year.accumulatedDepreciation)).toEqual([
      "300",
      "600",
      "900",
    ]);
    expectAssetReconciliation(result.assetSchedules[0]!);
  });

  it("produces zero depreciation after useful life is exhausted", () => {
    const result = schedule({ projectionPeriodYears: 5 });
    const assetYears = result.assetSchedules[0]?.years ?? [];

    expect(assetYears.map((year) => year.depreciation)).toEqual([
      "300",
      "300",
      "300",
      "0",
      "0",
    ]);
    expect(assetYears[4]?.closingCarryingValue).toBe("100");
    expectAssetReconciliation(result.assetSchedules[0]!);
  });

  it("leaves the asset partially depreciated when projection is shorter than life", () => {
    const result = schedule({ projectionPeriodYears: 2 });
    const assetYears = result.assetSchedules[0]?.years ?? [];

    expect(assetYears.map((year) => year.depreciation)).toEqual(["300", "300"]);
    expect(assetYears[1]?.closingCarryingValue).toBe("400");
  });

  it("preserves Decimal.js precision and reconciles the final repeating division", () => {
    const result = schedule({
      assets: [
        straightLineAsset({
          originalCost: {
            value: monetaryAmount("1"),
            source: sampleUserSource,
          },
          residualValue: {
            value: monetaryAmount("0"),
            source: sampleUserSource,
          },
        }),
      ],
    });
    const assetYears = result.assetSchedules[0]?.years ?? [];

    expect(assetYears.map((year) => year.depreciation)).toEqual([
      "0.3333333333333333333333333333333333333333",
      "0.3333333333333333333333333333333333333333",
      "0.3333333333333333333333333333333333333334",
    ]);
    expect(assetYears[2]?.closingCarryingValue).toBe("0");
    expectAssetReconciliation(result.assetSchedules[0]!);
  });

  it("supports a zero-cost asset as a valid zero-depreciation schedule", () => {
    const result = schedule({
      assets: [
        straightLineAsset({
          originalCost: {
            value: monetaryAmount("0"),
            source: sampleUserSource,
          },
          residualValue: {
            value: monetaryAmount("0"),
            source: sampleUserSource,
          },
        }),
      ],
    });

    expect(result.assetSchedules[0]?.years).toEqual([
      expect.objectContaining({
        year: 1,
        depreciation: "0",
        closingCarryingValue: "0",
      }),
      expect.objectContaining({
        year: 2,
        depreciation: "0",
        closingCarryingValue: "0",
      }),
      expect.objectContaining({
        year: 3,
        depreciation: "0",
        closingCarryingValue: "0",
      }),
    ]);
  });
});

describe("written-down-value schedules", () => {
  it("carries each closing WDV into the next year's opening WDV", () => {
    const result = schedule({ assets: [writtenDownValueAsset()] });
    const assetYears = result.assetSchedules[0]?.years ?? [];

    expect(assetYears.map((year) => year.depreciation)).toEqual([
      "200",
      "160",
      "128",
    ]);
    expect(assetYears.map((year) => year.closingCarryingValue)).toEqual([
      "800",
      "640",
      "512",
    ]);
    expectAssetReconciliation(result.assetSchedules[0]!);
  });

  it("allows a zero-percent rate", () => {
    const result = schedule({
      assets: [
        writtenDownValueAsset({
          depreciationRate: {
            value: percentage("0"),
            source: sampleUserSource,
          },
        }),
      ],
    });

    expect(
      result.assetSchedules[0]?.years.map((year) => year.depreciation),
    ).toEqual(["0", "0", "0"]);
    expect(result.assetSchedules[0]?.years[2]?.closingCarryingValue).toBe(
      "1000",
    );
  });

  it("allows a 100-percent rate with zero residual value", () => {
    const result = schedule({
      assets: [
        writtenDownValueAsset({
          depreciationRate: {
            value: percentage("100"),
            source: sampleUserSource,
          },
        }),
      ],
    });

    expect(
      result.assetSchedules[0]?.years.map((year) => year.depreciation),
    ).toEqual(["1000", "0", "0"]);
    expect(result.assetSchedules[0]?.years[0]?.closingCarryingValue).toBe("0");
  });

  it("limits a 100-percent rate to a non-zero residual value", () => {
    const result = schedule({
      assets: [
        writtenDownValueAsset({
          residualValue: {
            value: monetaryAmount("100"),
            source: sampleUserSource,
          },
          depreciationRate: {
            value: percentage("100"),
            source: sampleUserSource,
          },
        }),
      ],
    });

    expect(
      result.assetSchedules[0]?.years.map((year) => year.depreciation),
    ).toEqual(["900", "0", "0"]);
    expect(result.assetSchedules[0]?.years[2]?.closingCarryingValue).toBe(
      "100",
    );
  });

  it("stops exactly at the WDV residual floor", () => {
    const result = schedule({
      assets: [
        writtenDownValueAsset({
          residualValue: {
            value: monetaryAmount("500"),
            source: sampleUserSource,
          },
          depreciationRate: {
            value: percentage("60"),
            source: sampleUserSource,
          },
        }),
      ],
    });

    expect(
      result.assetSchedules[0]?.years.map((year) => year.depreciation),
    ).toEqual(["500", "0", "0"]);
    expect(result.assetSchedules[0]?.years[2]?.closingCarryingValue).toBe(
      "500",
    );
  });
});

describe("asset additions", () => {
  it("gives a later straight-line addition its own full useful-life stream", () => {
    const result = schedule({
      projectionPeriodYears: 4,
      assets: [
        straightLineAsset({
          originalCost: {
            value: monetaryAmount("900"),
            source: sampleUserSource,
          },
          residualValue: {
            value: monetaryAmount("0"),
            source: sampleUserSource,
          },
          additions: [addition("addition-year-two", 2, "300")],
        }),
      ],
    });
    const assetYears = result.assetSchedules[0]?.years ?? [];

    expect(assetYears.map((year) => year.additions)).toEqual([
      "0",
      "300",
      "0",
      "0",
    ]);
    expect(assetYears.map((year) => year.depreciation)).toEqual([
      "300",
      "400",
      "400",
      "100",
    ]);
    expect(assetYears.map((year) => year.closingCarryingValue)).toEqual([
      "600",
      "500",
      "100",
      "0",
    ]);
    expectAssetReconciliation(result.assetSchedules[0]!);
  });

  it("keeps residual-bearing straight-line streams independent through different completion years", () => {
    const result = schedule({
      projectionPeriodYears: 6,
      assets: [
        straightLineAsset({
          originalCost: {
            value: monetaryAmount("900"),
            source: sampleUserSource,
          },
          residualValue: {
            value: monetaryAmount("90"),
            source: sampleUserSource,
          },
          additions: [
            addition("addition-year-two", 2, "300", "30"),
            addition("addition-year-four", 4, "150", "15"),
          ],
        }),
      ],
    });
    const assetYears = result.assetSchedules[0]?.years ?? [];

    expect(assetYears.map((year) => year.depreciation)).toEqual([
      "270",
      "360",
      "360",
      "135",
      "45",
      "45",
    ]);
    expect(assetYears.map((year) => year.residualValue)).toEqual([
      "90",
      "120",
      "120",
      "135",
      "135",
      "135",
    ]);
    expect(assetYears.map((year) => year.closingCarryingValue)).toEqual([
      "630",
      "570",
      "210",
      "225",
      "180",
      "135",
    ]);
    expect(assetYears[3]?.depreciation).toBe("135");
    expect(assetYears[5]?.closingCarryingValue).toBe("135");
    expectAssetReconciliation(result.assetSchedules[0]!);
  });

  it("combines multiple additions in their stated years", () => {
    const result = schedule({
      projectionPeriodYears: 5,
      assets: [
        straightLineAsset({
          originalCost: {
            value: monetaryAmount("600"),
            source: sampleUserSource,
          },
          residualValue: {
            value: monetaryAmount("0"),
            source: sampleUserSource,
          },
          additions: [
            addition("addition-year-two-a", 2, "300"),
            addition("addition-year-two-b", 2, "150"),
            addition("addition-year-four", 4, "90"),
          ],
        }),
      ],
    });
    const assetYears = result.assetSchedules[0]?.years ?? [];

    expect(assetYears.map((year) => year.additions)).toEqual([
      "0",
      "450",
      "0",
      "90",
      "0",
    ]);
    expect(assetYears.map((year) => year.depreciation)).toEqual([
      "200",
      "350",
      "350",
      "180",
      "30",
    ]);
    expectAssetReconciliation(result.assetSchedules[0]!);
  });

  it("includes WDV additions in the full-year depreciation base", () => {
    const result = schedule({
      assets: [
        writtenDownValueAsset({
          depreciationRate: {
            value: percentage("10"),
            source: sampleUserSource,
          },
          additions: [addition("addition-year-two", 2, "200")],
        }),
      ],
    });
    const assetYears = result.assetSchedules[0]?.years ?? [];

    expect(assetYears[1]).toMatchObject({
      openingCarryingValue: "900",
      additions: "200",
      depreciationBase: "1100",
      depreciation: "110",
      closingCarryingValue: "990",
    });
    expectAssetReconciliation(result.assetSchedules[0]!);
  });

  it("adds each addition residual to the cumulative residual floor", () => {
    const result = schedule({
      assets: [
        writtenDownValueAsset({
          residualValue: {
            value: monetaryAmount("100"),
            source: sampleUserSource,
          },
          depreciationRate: {
            value: percentage("100"),
            source: sampleUserSource,
          },
          additions: [addition("addition-year-two", 2, "200", "25")],
        }),
      ],
    });
    const assetYears = result.assetSchedules[0]?.years ?? [];

    expect(assetYears.map((year) => year.residualValue)).toEqual([
      "100",
      "125",
      "125",
    ]);
    expect(assetYears.map((year) => year.closingCarryingValue)).toEqual([
      "100",
      "125",
      "125",
    ]);
    expectAssetReconciliation(result.assetSchedules[0]!);
  });
});

describe("multiple assets and aggregate schedule", () => {
  it("aggregates multiple categories and exactly reconciles every yearly total", () => {
    const assets: readonly DepreciableAsset[] = [
      straightLineAsset({
        id: "building",
        name: "Synthetic Building",
        category: "BUILDING",
        originalCost: {
          value: monetaryAmount("1200"),
          source: sampleUserSource,
        },
        residualValue: {
          value: monetaryAmount("0"),
          source: sampleUserSource,
        },
        usefulLifeYears: { value: 4, source: sampleUserSource },
      }),
      writtenDownValueAsset({
        id: "machinery",
        name: "Synthetic Machinery",
        category: "PLANT_AND_MACHINERY",
        additions: [addition("machinery-addition", 2, "200")],
      }),
      writtenDownValueAsset({
        id: "furniture",
        name: "Synthetic Furniture",
        category: "FURNITURE_AND_FIXTURES",
        originalCost: {
          value: monetaryAmount("500"),
          source: sampleUserSource,
        },
        depreciationRate: {
          value: percentage("10"),
          source: sampleUserSource,
        },
      }),
      straightLineAsset({
        id: "vehicle",
        name: "Synthetic Vehicle",
        category: "VEHICLE",
        originalCost: {
          value: monetaryAmount("600"),
          source: sampleUserSource,
        },
        residualValue: {
          value: monetaryAmount("60"),
          source: sampleUserSource,
        },
        usefulLifeYears: { value: 3, source: sampleUserSource },
      }),
    ];
    const result = schedule({ assets });

    expect(result.assetSchedules).toHaveLength(4);
    expect(result.assetSchedules.map(({ asset }) => asset.category)).toEqual([
      "BUILDING",
      "PLANT_AND_MACHINERY",
      "FURNITURE_AND_FIXTURES",
      "VEHICLE",
    ]);

    for (const assetSchedule of result.assetSchedules) {
      expectAssetReconciliation(assetSchedule);
    }

    expectAggregateReconciliation(result);
  });

  it("emits aggregate zero rows before an asset's configured start year", () => {
    const result = schedule({
      assets: [straightLineAsset({ depreciationStartYear: 2 })],
    });

    expect(result.assetSchedules[0]?.years.map(({ year }) => year)).toEqual([
      2, 3,
    ]);
    expect(result.yearlySummaries[0]).toEqual({
      year: 1,
      openingGrossFixedAssets: "0",
      additions: "0",
      depreciation: "0",
      accumulatedDepreciation: "0",
      closingGrossFixedAssets: "0",
      closingNetCarryingValue: "0",
    });
  });

  it("returns canonical aggregate zero rows for an empty asset collection", () => {
    const result = schedule({ assets: [] });

    expect(result.assetSchedules).toEqual([]);
    expect(result.yearlySummaries).toEqual([
      expect.objectContaining({ year: 1, depreciation: "0" }),
      expect.objectContaining({ year: 2, depreciation: "0" }),
      expect.objectContaining({ year: 3, depreciation: "0" }),
    ]);
  });
});

describe("depreciation validation", () => {
  it.each([0, -1, 1.5])(
    "rejects invalid projection period %s",
    (projectionPeriodYears) => {
      const result = calculateDepreciationSchedule(
        input({ projectionPeriodYears }),
      );

      expect(result).toEqual({
        ok: false,
        errors: [
          expect.objectContaining({
            code: "INVALID_DEPRECIATION_PROJECTION_PERIOD",
          }),
        ],
      });
    },
  );

  it("rejects negative cost and negative residual value", () => {
    const result = calculateDepreciationSchedule(
      input({
        assets: [
          straightLineAsset({
            originalCost: {
              value: monetaryAmount("-1"),
              source: sampleUserSource,
            },
            residualValue: {
              value: monetaryAmount("-2"),
              source: sampleUserSource,
            },
          }),
        ],
      }),
    );

    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "NEGATIVE_ASSET_COST" }),
        expect.objectContaining({ code: "NEGATIVE_RESIDUAL_VALUE" }),
      ]),
    });
  });

  it("rejects residual value greater than asset or addition cost", () => {
    const result = calculateDepreciationSchedule(
      input({
        assets: [
          straightLineAsset({
            originalCost: {
              value: monetaryAmount("100"),
              source: sampleUserSource,
            },
            residualValue: {
              value: monetaryAmount("101"),
              source: sampleUserSource,
            },
            additions: [addition("invalid-addition", 2, "20", "21")],
          }),
        ],
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.filter(
          ({ code }) => code === "RESIDUAL_VALUE_EXCEEDS_COST",
        ),
      ).toHaveLength(2);
    }
  });

  it("rejects an addition residual value greater than that addition's cost", () => {
    const result = calculateDepreciationSchedule(
      input({
        assets: [
          straightLineAsset({
            additions: [addition("invalid-addition", 2, "20", "21")],
          }),
        ],
      }),
    );

    expect(result).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({
          code: "RESIDUAL_VALUE_EXCEEDS_COST",
          path: "assets.0.additions.0.residualValue.value",
        }),
      ],
    });
  });

  it.each([0, -1, 1.5])(
    "rejects invalid straight-line useful life %s",
    (usefulLifeYears) => {
      const result = calculateDepreciationSchedule(
        input({
          assets: [
            straightLineAsset({
              usefulLifeYears: {
                value: usefulLifeYears,
                source: sampleUserSource,
              },
            }),
          ],
        }),
      );

      expect(result).toEqual({
        ok: false,
        errors: [expect.objectContaining({ code: "INVALID_USEFUL_LIFE" })],
      });
    },
  );

  it.each(["-0.1", "100.1"])(
    "rejects invalid WDV depreciation rate %s",
    (depreciationRate) => {
      const result = calculateDepreciationSchedule(
        input({
          assets: [
            writtenDownValueAsset({
              depreciationRate: {
                value: percentage(depreciationRate),
                source: sampleUserSource,
              },
            }),
          ],
        }),
      );

      expect(result).toEqual({
        ok: false,
        errors: [
          expect.objectContaining({ code: "INVALID_DEPRECIATION_RATE" }),
        ],
      });
    },
  );

  it("rejects negative additions and negative addition residual value", () => {
    const result = calculateDepreciationSchedule(
      input({
        assets: [
          straightLineAsset({
            additions: [addition("invalid-addition", 2, "-1", "-2")],
          }),
        ],
      }),
    );

    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "NEGATIVE_ASSET_ADDITION" }),
        expect.objectContaining({
          code: "NEGATIVE_ADDITION_RESIDUAL_VALUE",
        }),
      ]),
    });
  });

  it("rejects duplicate addition ids within one asset", () => {
    const result = calculateDepreciationSchedule(
      input({
        assets: [
          straightLineAsset({
            additions: [
              addition("duplicate-addition", 2, "100"),
              addition("duplicate-addition", 3, "200"),
            ],
          }),
        ],
      }),
    );

    expect(result).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({
          code: "DUPLICATE_ASSET_ADDITION_ID",
          path: "assets.0.additions.1.id",
        }),
      ],
    });
  });

  it.each([0, 4, 1.5])(
    "rejects addition year %s outside a three-year projection",
    (year) => {
      const result = calculateDepreciationSchedule(
        input({
          assets: [
            straightLineAsset({
              additions: [addition("invalid-addition", year, "100")],
            }),
          ],
        }),
      );

      expect(result).toEqual({
        ok: false,
        errors: [
          expect.objectContaining({
            code: "ADDITION_OUTSIDE_PROJECTION_PERIOD",
          }),
        ],
      });
    },
  );

  it("rejects an addition before the asset's depreciation start year", () => {
    const result = calculateDepreciationSchedule(
      input({
        assets: [
          straightLineAsset({
            depreciationStartYear: 2,
            additions: [addition("early-addition", 1, "100")],
          }),
        ],
      }),
    );

    expect(result).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({ code: "ADDITION_BEFORE_DEPRECIATION_START" }),
      ],
    });
  });

  it.each([0, 4, 1.5])(
    "rejects invalid asset depreciation start year %s",
    (depreciationStartYear) => {
      const result = calculateDepreciationSchedule(
        input({
          assets: [straightLineAsset({ depreciationStartYear })],
        }),
      );

      expect(result).toEqual({
        ok: false,
        errors: [
          expect.objectContaining({ code: "INVALID_DEPRECIATION_START_YEAR" }),
        ],
      });
    },
  );

  it("rejects a missing useful life for Straight Line", () => {
    const malformed = {
      ...straightLineAsset(),
      usefulLifeYears: undefined,
    } as unknown as DepreciableAsset;
    const result = calculateAssetDepreciationSchedule(malformed, 3);

    expect(result).toEqual({
      ok: false,
      errors: [expect.objectContaining({ code: "MISSING_USEFUL_LIFE" })],
    });
  });

  it("rejects a missing rate for WDV", () => {
    const malformed = {
      ...writtenDownValueAsset(),
      depreciationRate: undefined,
    } as unknown as DepreciableAsset;
    const result = calculateAssetDepreciationSchedule(malformed, 3);

    expect(result).toEqual({
      ok: false,
      errors: [expect.objectContaining({ code: "MISSING_DEPRECIATION_RATE" })],
    });
  });

  it("rejects incompatible method configuration", () => {
    const straightLineWithRate = {
      ...straightLineAsset(),
      depreciationRate: {
        value: percentage("10"),
        source: sampleUserSource,
      },
    } as unknown as DepreciableAsset;
    const wdvWithLife = {
      ...writtenDownValueAsset(),
      usefulLifeYears: { value: 5, source: sampleUserSource },
    } as unknown as DepreciableAsset;
    const result = calculateDepreciationSchedule(
      input({ assets: [straightLineWithRate, wdvWithLife] }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.filter(
          ({ code }) => code === "INCOMPATIBLE_DEPRECIATION_CONFIGURATION",
        ),
      ).toHaveLength(2);
    }
  });

  it("rejects an unsupported runtime depreciation method", () => {
    const malformed = {
      ...straightLineAsset(),
      method: "UNITS_OF_PRODUCTION",
    } as unknown as DepreciableAsset;
    const result = calculateAssetDepreciationSchedule(malformed, 3);

    expect(result).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({ code: "UNSUPPORTED_DEPRECIATION_METHOD" }),
      ],
    });
  });
});
