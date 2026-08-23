import { describe, expect, it } from "vitest";

import { decimalValue, monetaryAmount } from "../shared/decimal";
import type { SourceReference } from "../shared/provenance";
import type {
  OperatingExpense,
  OperatingInput,
  ProductOrService,
} from "./operations";
import {
  calculateOperatingExpenseSummary,
  calculateOperatingInputCostSummary,
  calculateOperatingInputLine,
  calculateRevenueLine,
  calculateRevenueSummary,
} from "./calculations";

const source: SourceReference = {
  id: "source-synthetic-operations",
  type: "USER_INPUT",
  reference: "Synthetic operations test",
};

function product(id: string, quantity: string, rate: string): ProductOrService {
  return {
    id,
    name: "Example Product",
    unit: "unit",
    sellingPrice: [
      { year: 1, assumption: { value: monetaryAmount(rate), source } },
    ],
    salesQuantity: [
      { year: 1, assumption: { value: decimalValue(quantity), source } },
    ],
  };
}

function operatingInput(
  id: string,
  quantity: string,
  rate: string,
  transportCost?: string,
): OperatingInput {
  return {
    id,
    name: "Demo Raw Material",
    category: "RAW_MATERIAL",
    unit: "kg",
    quantity: { value: decimalValue(quantity), source },
    purchaseRate: { value: monetaryAmount(rate), source },
    transportCost: transportCost
      ? { value: monetaryAmount(transportCost), source }
      : undefined,
  };
}

describe("revenue calculations", () => {
  it("calculates one fractional quantity and selling rate", () => {
    const result = calculateRevenueLine(
      product("product-one", "2.5", "10.25"),
      1,
    );

    expect(result.ok && result.value.lineRevenue).toBe("25.625");
  });

  it("aggregates multiple products", () => {
    const result = calculateRevenueSummary(
      [product("product-one", "2", "100.5"), product("product-two", "3", "20")],
      1,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.lines).toHaveLength(2);
      expect(result.value.totalRevenue).toBe("261");
    }
  });

  it("uses explicit sales quantity without inferring capacity utilisation", () => {
    const input: ProductOrService = {
      ...product("capacity-product", "40", "5"),
      installedCapacity: {
        quantity: decimalValue("100"),
        unit: "unit",
      },
    };

    const result = calculateRevenueLine(input, 1);

    expect(result.ok && result.value.quantity).toBe("40");
    expect(result.ok && result.value.lineRevenue).toBe("200");
  });

  it("returns typed failures instead of inventing missing yearly assumptions", () => {
    const input: ProductOrService = {
      id: "missing-product",
      name: "Example Product",
      unit: "unit",
      sellingPrice: [],
    };

    const result = calculateRevenueLine(input, 1);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map(({ code }) => code)).toEqual([
        "MISSING_YEARLY_ASSUMPTION",
        "MISSING_YEARLY_ASSUMPTION",
      ]);
    }
  });
});

describe("operating-input calculations", () => {
  it("separates quantity-rate cost from explicit transport addition", () => {
    const result = calculateOperatingInputLine(
      operatingInput("material-one", "2.5", "4.2", "1.25"),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.baseCost).toBe("10.5");
      expect(result.value.transportCost).toBe("1.25");
      expect(result.value.totalCost).toBe("11.75");
    }
  });

  it("aggregates multiple input lines and zero values", () => {
    const result = calculateOperatingInputCostSummary([
      operatingInput("material-one", "10", "2.25"),
      operatingInput("material-two", "0", "999"),
      operatingInput("material-three", "3", "1.5", "1"),
    ]);

    expect(result.ok && result.value.totalInputCost).toBe("28");
  });

  it("reports missing quantity and purchase rate together", () => {
    const result = calculateOperatingInputLine({
      id: "material-missing",
      name: "Demo Material",
      category: "OTHER",
      unit: "unit",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveLength(2);
    }
  });
});

describe("operating-expense aggregation", () => {
  it("sums explicit yearly fixed and variable amounts", () => {
    const expenses: OperatingExpense[] = [
      {
        id: "expense-rent",
        name: "Demo Rent",
        behaviour: "FIXED",
        category: "RENT",
        yearlyAmounts: [
          { year: 1, assumption: { value: monetaryAmount("100.25"), source } },
        ],
      },
      {
        id: "expense-power",
        name: "Demo Electricity",
        behaviour: "VARIABLE",
        category: "ELECTRICITY",
        yearlyAmounts: [
          { year: 1, assumption: { value: monetaryAmount("49.75"), source } },
        ],
      },
    ];

    const result = calculateOperatingExpenseSummary(expenses, 1);

    expect(result.ok && result.value.totalOperatingExpenses).toBe("150");
  });
});
