import { describe, expect, it } from "vitest";

import type { Assumption } from "../../../shared/assumptions";
import type { CalculationResult } from "../../../shared/calculation";
import { decimalValue, monetaryAmount } from "../../../shared/decimal";
import type { SourceReference } from "../../../shared/provenance";
import { evaluateNlm } from "./evaluation";
import type {
  NlmActivity,
  NlmCostItem,
  NlmEntityType,
  NlmEvaluationInput,
} from "./contracts";

const source: SourceReference = { id: "TEST.SOURCE", type: "USER_INPUT" };
const a = <T>(value: T): Assumption<T> => ({ value, source });
const cost = (
  id: string,
  amount: string,
  tag: NlmCostItem["tag"] = "MACHINERY_EQUIPMENT",
): NlmCostItem => ({
  costItemId: id,
  description: id,
  amount: monetaryAmount(amount),
  tag,
  sourceReferences: [source],
});

function unwrap<T>(result: CalculationResult<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok)
    throw new Error(result.errors.map((error) => error.code).join());
  return result.value;
}

function input(
  activity: NlmActivity,
  female?: string,
  male?: string,
  entity: NlmEntityType = "INDIVIDUAL",
): NlmEvaluationInput {
  return {
    projectId: "P1",
    evaluationAsOfDate: "2026-08-24",
    activity: a(activity),
    entityType: a(entity),
    financeMode: a("BANK_OR_FI"),
    ...(female ? { femaleAnimals: a(decimalValue(female)) } : {}),
    ...(male ? { maleAnimals: a(decimalValue(male)) } : {}),
    costItems: [cost("M", "10000000")],
  };
}

describe("NLM activity definitions", () => {
  it.each([
    ["RURAL_POULTRY", "1000", "100", "2500000"],
    ["SHEEP_GOAT", "100", "5", "1000000"],
    ["SHEEP_GOAT", "500", "25", "5000000"],
    ["PIGGERY", "50", "5", "1500000"],
    ["PIGGERY", "100", "10", "3000000"],
    ["HORSE", "10", "2", "5000000"],
    ["DONKEY", "50", "5", "5000000"],
  ] as const)(
    "applies the source-backed %s unit cap",
    (activity, female, male, cap) => {
      const result = unwrap(evaluateNlm(input(activity, female, male)));
      expect(result.activityCap).toBe(cap);
      expect(result.calculatedEligibleSubsidy).toBe(cap);
      expect(result.unitResolution.capacityCompliance).toBe(
        "MEETS_CONFIGURED_SIZE",
      );
      expect(
        result.unitResolution.trace.sourceReferences.map(
          (item) => item.sourceId,
        ),
      ).toContain("NLM.PARLIAMENT.LS-303.2025-02-04");
    },
  );

  it("distinguishes pastoral and non-pastoral 10+1 camel caps", () => {
    const pastoral = unwrap(
      evaluateNlm({
        ...input("CAMEL", "10", "1"),
        isPastoralCamelUnit: a(true),
      }),
    );
    const other = unwrap(
      evaluateNlm({
        ...input("CAMEL", "10", "1"),
        isPastoralCamelUnit: a(false),
      }),
    );
    expect(pastoral.activityCap).toBe("300000");
    expect(other.activityCap).toBe("500000");
  });

  it.each(["FEED_FODDER", "FODDER_SEED_PROCESSING"] as const)(
    "uses the fixed activity cap for %s without inventing an animal unit",
    (activity) => {
      const entity =
        activity === "FODDER_SEED_PROCESSING" ? "FPO" : "INDIVIDUAL";
      const result = unwrap(
        evaluateNlm(input(activity, undefined, undefined, entity)),
      );
      expect(result.activityCap).toBe("5000000");
      expect(result.unitResolution.capacityCompliance).toBe("NOT_APPLICABLE");
    },
  );

  it("does not replace activity caps with a generic Rs 50 lakh cap", () => {
    const poultry = unwrap(evaluateNlm(input("RURAL_POULTRY", "1000", "100")));
    expect(poultry.rawSubsidy).toBe("5000000");
    expect(poultry.calculatedEligibleSubsidy).toBe("2500000");
  });
});

describe("NLM cost, finance and eligibility rules", () => {
  it("excludes land, rent, lease, working capital and personal vehicles exactly", () => {
    const result = unwrap(
      evaluateNlm({
        ...input("SHEEP_GOAT", "100", "5"),
        costItems: [
          cost("S", "1000000", "SHED_HOUSING"),
          cost("L", "100", "LAND_PURCHASE"),
          cost("R", "200", "LAND_RENT"),
          cost("E", "300", "LAND_LEASE"),
          cost("W", "400", "WORKING_CAPITAL"),
          cost("V", "500", "PERSONAL_VEHICLE"),
        ],
      }),
    );
    expect(result.eligibleCapitalCost).toBe("1000000");
    expect(result.excludedCost).toBe("1500");
    expect(
      result.costLines.slice(1).every((line) => line.status === "INELIGIBLE"),
    ).toBe(true);
  });

  it("reconciles subsidy and remaining funding without intermediate rounding", () => {
    const result = unwrap(
      evaluateNlm({
        ...input("FEED_FODDER"),
        costItems: [cost("A", "0.1"), cost("B", "0.2")],
      }),
    );
    expect(result.actualProjectCost).toBe("0.3");
    expect(result.rawSubsidy).toBe("0.15");
    expect(result.remainingFundingRequirement).toBe("0.15");
  });

  it("preserves distinct bank-financed and self-financed release conditions", () => {
    const bank = unwrap(evaluateNlm(input("PIGGERY", "50", "5")));
    const self = unwrap(
      evaluateNlm({
        ...input("PIGGERY", "50", "5"),
        financeMode: a("SELF_FINANCE"),
      }),
    );
    expect(bank.installmentMetadata.installmentPercentages).toEqual([
      "50",
      "50",
    ]);
    expect(self.financeModeConstraints.conditions).toContain(
      "THREE_YEAR_BANK_GUARANTEE_FOR_REMAINING_PROJECT_COST_REQUIRED",
    );
    expect(bank.financeModeConstraints.conditions).not.toContain(
      "THREE_YEAR_BANK_GUARANTEE_FOR_REMAINING_PROJECT_COST_REQUIRED",
    );
  });

  it("rejects below-minimum units and preserves missing facts", () => {
    const below = unwrap(evaluateNlm(input("SHEEP_GOAT", "99", "5")));
    expect(below.eligibilityStatus).toBe("INELIGIBLE");
    expect(below.calculatedEligibleSubsidy).toBe("0");
    const missingUnit = unwrap(
      evaluateNlm({
        ...input("SHEEP_GOAT", "100", "5"),
        femaleAnimals: undefined,
        maleAnimals: undefined,
      }),
    );
    expect(missingUnit.eligibilityStatus).toBe("MANUAL_REVIEW_REQUIRED");
    expect(missingUnit.rawSubsidy).toBe("5000000");
    expect(missingUnit.calculatedEligibleSubsidy).toBe("0");
    const missing = unwrap(
      evaluateNlm({
        projectId: "P2",
        evaluationAsOfDate: "2026-08-24",
        costItems: [],
      }),
    );
    expect(missing.eligibilityStatus).toBe("INSUFFICIENT_INFORMATION");
  });

  it("rejects negative costs and duplicate cost ids", () => {
    const negative = evaluateNlm({
      ...input("PIGGERY", "50", "5"),
      costItems: [{ ...cost("N", "1"), amount: "-1" as never }],
    });
    expect(negative.ok).toBe(false);
    const duplicate = evaluateNlm({
      ...input("PIGGERY", "50", "5"),
      costItems: [cost("D", "1"), cost("D", "2")],
    });
    expect(duplicate.ok).toBe(false);
  });
});
