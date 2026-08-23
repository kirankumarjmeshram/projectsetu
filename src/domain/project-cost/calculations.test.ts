import { describe, expect, it } from "vitest";

import { decimalValue, monetaryAmount } from "../shared/decimal";
import type { SourceReference } from "../shared/provenance";
import type { ProjectCost, ProjectCostItem } from "./project-cost";
import { calculateProjectCost, calculateProjectCostLine } from "./calculations";

const source: SourceReference = {
  id: "source-synthetic-cost",
  type: "USER_INPUT",
  reference: "Synthetic project-cost test",
};

function money(value: string) {
  return { value: monetaryAmount(value), source };
}

function costItem(overrides: Partial<ProjectCostItem> = {}): ProjectCostItem {
  return {
    id: "cost-demo-machine",
    description: "Demo Machine",
    category: "EQUIPMENT",
    amount: money("0"),
    ...overrides,
  };
}

describe("calculateProjectCostLine", () => {
  it("calculates decimal quantity times rate without mutating the input", () => {
    const item = costItem({
      quantity: decimalValue("2.5"),
      rate: money("100.25"),
      amount: money("250.625"),
    });

    const result = calculateProjectCostLine(item);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.baseMethod).toBe("QUANTITY_TIMES_RATE");
      expect(result.value.baseAmount).toBe("250.625");
      expect(result.value.finalAmount).toBe("250.625");
      expect(result.value.input).toBe(item);
    }
  });

  it("preserves base and addition breakdowns", () => {
    const result = calculateProjectCostLine(
      costItem({
        quantity: decimalValue("2"),
        rate: money("100"),
        amount: money("200"),
        tax: money("18.25"),
        freight: money("7.5"),
        installation: money("4.25"),
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.baseAmount).toBe("200");
      expect(result.value.additions).toEqual({
        tax: "18.25",
        freight: "7.5",
        installation: "4.25",
        totalAdditions: "30",
      });
      expect(result.value.finalAmount).toBe("230");
    }
  });

  it("uses the stated amount when quantity and rate are both absent", () => {
    const result = calculateProjectCostLine(
      costItem({ amount: money("125.75") }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.baseMethod).toBe("STATED_AMOUNT");
      expect(result.value.finalAmount).toBe("125.75");
    }
  });

  it("returns a typed failure when only quantity or rate is supplied", () => {
    const result = calculateProjectCostLine(
      costItem({ quantity: decimalValue("1") }),
    );

    expect(result).toEqual({
      ok: false,
      errors: [
        {
          code: "MISSING_PROJECT_COST_RATE",
          message: "Project-cost quantity and rate must be supplied together.",
          path: "rate",
        },
      ],
    });
  });
});

describe("calculateProjectCost", () => {
  it("aggregates multiple items and only the supplied categories", () => {
    const input: ProjectCost = {
      projectId: "project-sample-manufacturing",
      items: [
        costItem({
          id: "equipment-one",
          quantity: decimalValue("2"),
          rate: money("100"),
          amount: money("200"),
          freight: money("10"),
        }),
        costItem({
          id: "land-one",
          category: "LAND",
          amount: money("50"),
        }),
        costItem({
          id: "equipment-two",
          amount: money("25"),
        }),
      ],
      statedTotal: monetaryAmount("275"),
    };

    const result = calculateProjectCost(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.categoryTotals).toEqual([
        { category: "EQUIPMENT", total: "235" },
        { category: "LAND", total: "50" },
      ]);
      expect(result.value.totalProjectCost).toBe("285");
      expect(result.value.differenceFromStatedTotal).toBe("10");
    }
  });

  it("handles zero and empty collections deterministically", () => {
    const empty = calculateProjectCost({
      projectId: "project-empty",
      items: [],
      statedTotal: monetaryAmount("0"),
    });
    const zeroLine = calculateProjectCostLine(
      costItem({
        quantity: decimalValue("0"),
        rate: money("999.99"),
        amount: money("0"),
      }),
    );

    expect(empty.ok && empty.value.totalProjectCost).toBe("0");
    expect(empty.ok && empty.value.categoryTotals).toEqual([]);
    expect(zeroLine.ok && zeroLine.value.finalAmount).toBe("0");
  });

  it("keeps large and fractional values exact", () => {
    const result = calculateProjectCostLine(
      costItem({
        quantity: decimalValue("2"),
        rate: money("999999999999999999999999.99"),
        amount: money("1999999999999999999999999.98"),
      }),
    );

    expect(result.ok && result.value.finalAmount).toBe(
      "1999999999999999999999999.98",
    );
  });
});
