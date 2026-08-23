import { describe, expect, it } from "vitest";

import { monetaryAmount } from "../shared/decimal";
import type { FinanceSource, MeansOfFinance } from "./financing";
import {
  calculateMeansOfFinance,
  reconcileMeansOfFinance,
} from "./calculations";

function source(
  id: string,
  type: FinanceSource["type"],
  amount: string,
): FinanceSource {
  return {
    id,
    type,
    name: "Synthetic finance source",
    amount: monetaryAmount(amount),
  };
}

describe("calculateMeansOfFinance", () => {
  it("aggregates multiple sources and source types exactly", () => {
    const input: MeansOfFinance = {
      projectId: "project-sample-manufacturing",
      sources: [
        source("promoter-one", "PROMOTER_CONTRIBUTION", "100000.25"),
        source("term-one", "TERM_LOAN", "300000.5"),
        source("term-two", "TERM_LOAN", "99999.25"),
        source("working-capital-one", "WORKING_CAPITAL_FINANCE", "50000"),
      ],
      statedTotal: monetaryAmount("550000"),
    };

    const result = calculateMeansOfFinance(input);

    expect(result.totalMeansOfFinance).toBe("550000");
    expect(result.differenceFromStatedTotal).toBe("0");
    expect(result.sourceTypeTotals).toEqual([
      { type: "PROMOTER_CONTRIBUTION", total: "100000.25" },
      { type: "TERM_LOAN", total: "399999.75" },
      { type: "WORKING_CAPITAL_FINANCE", total: "50000" },
    ]);
  });

  it("returns canonical zero for no finance sources", () => {
    const result = calculateMeansOfFinance({
      projectId: "project-empty",
      sources: [],
      statedTotal: monetaryAmount("0"),
    });

    expect(result.totalMeansOfFinance).toBe("0");
    expect(result.sourceTypeTotals).toEqual([]);
  });
});

describe("reconcileMeansOfFinance", () => {
  it.each([
    {
      projectCost: "100",
      finance: "100",
      difference: "0",
      status: "BALANCED",
      balanced: true,
    },
    {
      projectCost: "100",
      finance: "90",
      difference: "-10",
      status: "SHORTFALL",
      balanced: false,
    },
    {
      projectCost: "100",
      finance: "110",
      difference: "10",
      status: "EXCESS",
      balanced: false,
    },
  ] as const)(
    "classifies $status without rounding",
    ({ projectCost, finance, difference, status, balanced }) => {
      const result = reconcileMeansOfFinance(
        monetaryAmount(projectCost),
        monetaryAmount(finance),
      );

      expect(result).toMatchObject({
        difference,
        absoluteDifference: difference.startsWith("-")
          ? difference.slice(1)
          : difference,
        status,
        balanced,
      });
    },
  );
});
