import { describe, expect, it } from "vitest";

import { calculateMeansOfFinance } from "../financing/calculations";
import type { MeansOfFinance } from "../financing/financing";
import { calculateProjectCost } from "../project-cost/calculations";
import type { ProjectCost } from "../project-cost/project-cost";
import { monetaryAmount } from "../shared/decimal";
import { classificationTag } from "../schemes/program";
import {
  adaptMeansOfFinanceSummary,
  adaptProjectCostSummary,
} from "./adapters";
import { fixtureSource } from "./test-fixtures";

describe("funding composer adapters", () => {
  it("copies authoritative Project Cost Engine results with stable identities", () => {
    const projectCost: ProjectCost = {
      projectId: "PROJECT-1",
      statedTotal: monetaryAmount("100"),
      items: [
        {
          id: "MACHINE",
          description: "Machine",
          category: "PLANT_AND_MACHINERY",
          amount: { value: monetaryAmount("100"), source: fixtureSource },
          sourceReferences: [fixtureSource],
        },
      ],
    };
    const calculated = calculateProjectCost(projectCost);
    if (!calculated.ok) throw new Error("fixture failed");
    const adapted = adaptProjectCostSummary(calculated.value, {
      MACHINE: [classificationTag("PROCESSING")],
    });

    expect(adapted.totalProjectCost).toBe(calculated.value.totalProjectCost);
    expect(adapted.costItems[0]?.costItemId).toBe("MACHINE");
    expect(adapted.costItems[0]?.amount).toBe("100");
    expect(adapted.costItems[0]?.tags).toEqual(
      expect.arrayContaining(["PLANT_AND_MACHINERY", "CAPITAL", "PROCESSING"]),
    );
  });

  it("copies and classifies source-backed Financing Engine facts", () => {
    const means: MeansOfFinance = {
      projectId: "PROJECT-1",
      statedTotal: monetaryAmount("1000"),
      sources: [
        {
          id: "PROMOTER",
          type: "PROMOTER_CONTRIBUTION",
          name: "Promoter",
          amount: monetaryAmount("200"),
          source: fixtureSource,
        },
        {
          id: "BANK",
          type: "TERM_LOAN",
          name: "Bank",
          amount: monetaryAmount("700"),
          source: fixtureSource,
        },
        {
          id: "BACK_ENDED",
          type: "GOVERNMENT_SUBSIDY_OR_GRANT",
          name: "Back-ended assistance",
          amount: monetaryAmount("100"),
          source: fixtureSource,
        },
      ],
    };
    const result = adaptMeansOfFinanceSummary(calculateMeansOfFinance(means));
    if (!result.ok) throw new Error("fixture failed");

    expect(result.value.promoterContribution?.value).toBe("200");
    expect(result.value.bankFinance?.value).toBe("700");
    expect(result.value.otherFinance[0]).toMatchObject({
      financeSourceId: "BACK_ENDED",
      value: "100",
      availableAtInitialFunding: false,
    });
  });

  it("rejects means-of-finance lines without provenance", () => {
    const means: MeansOfFinance = {
      projectId: "PROJECT-1",
      statedTotal: monetaryAmount("1"),
      sources: [
        {
          id: "UNSOURCED",
          type: "TERM_LOAN",
          name: "Unsourced",
          amount: monetaryAmount("1"),
        },
      ],
    };
    const result = adaptMeansOfFinanceSummary(calculateMeansOfFinance(means));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe("MISSING_FINANCE_SOURCE_PROVENANCE");
    }
  });
});
