import { describe, expect, it } from "vitest";

import type { Assumption } from "../../../shared/assumptions";
import type { CalculationResult } from "../../../shared/calculation";
import { decimalValue, monetaryAmount } from "../../../shared/decimal";
import type { SourceReference } from "../../../shared/provenance";
import { evaluateProgramCompatibility } from "../../compatibility";
import { programId, programVersionId } from "../../program";
import type {
  PmfmeActivityClassification,
  PmfmeComponent,
  PmfmeCostItem,
  PmfmeEvaluationInput,
} from "./contracts";
import { evaluatePmfme } from "./evaluation";
import {
  PMFME_PROGRAM_IDS,
  pmfmeAifConvergenceRule,
  pmfmeProgramDefinitions,
} from "./index";

const source: SourceReference = { id: "TEST.SOURCE", type: "USER_INPUT" };
const a = <T>(value: T): Assumption<T> => ({ value, source });
const cost = (
  id: string,
  amount: string,
  tag: PmfmeCostItem["tag"],
): PmfmeCostItem => ({
  costItemId: id,
  description: id,
  amount: monetaryAmount(amount),
  tag,
  sourceReferences: [source],
});
function unwrap<T>(result: CalculationResult<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected success");
  return result.value;
}
function input(
  component: PmfmeComponent = "INDIVIDUAL_UNIT",
): PmfmeEvaluationInput {
  return {
    projectId: "P1",
    evaluationAsOfDate: "2024-03-31",
    component: a(component),
    entityType: a(
      component === "COMMON_INFRASTRUCTURE"
        ? "FPO"
        : component === "SHG_SEED_CAPITAL"
          ? "SHG"
          : "INDIVIDUAL",
    ),
    projectType: a("NEW"),
    odopStatus: a("NON_ODOP_ALLOWED"),
    activityClassification: a("ELIGIBLE_FOOD_PROCESSING"),
    actualBeneficiaryContribution: a(monetaryAmount("1000000")),
    costItems: [cost("P", "700000", "PLANT_AND_MACHINERY")],
  };
}

describe("PMFME capital support", () => {
  it("calculates 35 percent for an individual new or existing unit", () => {
    for (const projectType of ["NEW", "EXISTING_UPGRADATION"] as const) {
      const result = unwrap(
        evaluatePmfme({ ...input(), projectType: a(projectType) }),
      );
      expect(result.rawSubsidy).toBe("245000");
      expect(result.subsidyRate).toBe("35");
      expect(result.eligibilityStatus).toBe("ELIGIBLE");
    }
  });

  it("caps individual and group-unit subsidy at Rs 10 lakh", () => {
    for (const component of [
      "INDIVIDUAL_UNIT",
      "GROUP_CAPITAL_SUPPORT",
    ] as const) {
      const base = input(component);
      const result = unwrap(
        evaluatePmfme({
          ...base,
          entityType: a(
            component === "GROUP_CAPITAL_SUPPORT" ? "FPO" : "INDIVIDUAL",
          ),
          costItems: [cost("P", "10000000", "PLANT_AND_MACHINERY")],
        }),
      );
      expect(result.rawSubsidy).toBe("3500000");
      expect(result.calculatedEligibleSubsidy).toBe("1000000");
    }
  });

  it("uses the independent Rs 3 crore common-infrastructure cap", () => {
    const result = unwrap(
      evaluatePmfme({
        ...input("COMMON_INFRASTRUCTURE"),
        actualBeneficiaryContribution: a(monetaryAmount("10000000")),
        costItems: [cost("P", "100000000", "PLANT_AND_MACHINERY")],
      }),
    );
    expect(result.rawSubsidy).toBe("35000000");
    expect(result.subsidyCap).toBe("30000000");
    expect(result.calculatedEligibleSubsidy).toBe("30000000");
    expect(result.calculatedEligibleSubsidy).not.toBe("1000000");
  });

  it("enforces technical civil work at exactly 30 percent of eligible cost", () => {
    const within = unwrap(
      evaluatePmfme({
        ...input(),
        costItems: [
          cost("P", "7", "PLANT_AND_MACHINERY"),
          cost("C", "3", "TECHNICAL_CIVIL_WORK"),
        ],
      }),
    );
    expect(within.eligibleTechnicalCivilWork).toBe("3");
    expect(within.eligibleProjectCost).toBe("10");

    const capped = unwrap(
      evaluatePmfme({
        ...input(),
        costItems: [
          cost("P", "700000", "PLANT_AND_MACHINERY"),
          cost("C", "500000", "TECHNICAL_CIVIL_WORK"),
        ],
      }),
    );
    expect(capped.maximumEligibleTechnicalCivilWork).toBe("300000");
    expect(capped.eligibleTechnicalCivilWork).toBe("300000");
    expect(capped.excessTechnicalCivilWork).toBe("200000");
    expect(capped.eligibleProjectCost).toBe("1000000");
  });

  it("excludes land, rented/leased workshed and working capital", () => {
    const result = unwrap(
      evaluatePmfme({
        ...input(),
        costItems: [
          cost("P", "100", "PLANT_AND_MACHINERY"),
          cost("L", "10", "LAND"),
          cost("R", "20", "RENTAL_WORKSHED"),
          cost("E", "30", "LEASE_WORKSHED"),
          cost("W", "40", "WORKING_CAPITAL"),
        ],
      }),
    );
    expect(result.eligibleProjectCost).toBe("100");
    expect(result.excludedCosts).toBe("100");
  });

  it("requires exact 10 percent beneficiary contribution and bank finance", () => {
    const result = unwrap(
      evaluatePmfme({
        ...input(),
        actualBeneficiaryContribution: a(monetaryAmount("99.99")),
        costItems: [cost("P", "1000", "PLANT_AND_MACHINERY")],
      }),
    );
    expect(result.requiredBeneficiaryContribution).toBe("100");
    expect(result.contributionShortfall).toBe("0.01");
    expect(result.bankFinanceRequirement).toBe("900");
    expect(result.eligibilityStatus).toBe("INELIGIBLE");
  });
});

describe("PMFME activities, seed capital and status", () => {
  it.each([
    "TRADING_UNPROCESSED_MILLETS_CEREALS_SPICES",
    "UNPROCESSED_OR_LOOSE_MILK",
    "TRADING_FRUITS_VEGETABLES",
    "TRADING_UNPROCESSED_MINOR_FOREST_PRODUCT",
    "BEEKEEPING_OR_LOOSE_HONEY",
    "LOOSE_OIL_TRADING_OR_REPACKING",
    "TRADING_GROUNDNUT_OR_ARECANUT",
    "ANIMAL_REARING",
    "TRADING_FRESH_FISH_MEAT_CHICKEN",
    "REPACKING_MANUFACTURED_PRODUCTS",
    "FOOD_SERVICE_ENTERPRISE",
  ] as readonly PmfmeActivityClassification[])(
    "rejects Annexure I activity %s",
    (activityClassification) => {
      const result = unwrap(
        evaluatePmfme({
          ...input(),
          activityClassification: a(activityClassification),
        }),
      );
      expect(result.eligibilityStatus).toBe("INELIGIBLE");
      expect(result.ruleTraces[1]?.sourceReferences[0]?.sourceId).toBe(
        "PMFME.OM.2022-05-18",
      );
    },
  );

  it("treats ODOP as preference and permits source-backed non-ODOP status", () => {
    const result = unwrap(evaluatePmfme(input()));
    expect(result.odopStatus).toBe("NON_ODOP_ALLOWED");
    expect(result.eligibilityStatus).toBe("ELIGIBLE");
  });

  it("calculates Rs 40,000 per food-processing SHG member capped at Rs 4 lakh", () => {
    const five = unwrap(
      evaluatePmfme({
        ...input("SHG_SEED_CAPITAL"),
        foodProcessingShgMembers: a(decimalValue("5")),
        costItems: [],
      }),
    );
    const twenty = unwrap(
      evaluatePmfme({
        ...input("SHG_SEED_CAPITAL"),
        foodProcessingShgMembers: a(decimalValue("20")),
        costItems: [],
      }),
    );
    expect(five.calculatedSeedCapital).toBe("200000");
    expect(twenty.calculatedSeedCapital).toBe("400000");
    expect(five.calculatedEligibleSubsidy).toBe("0");
  });

  it("preserves original-duration uncertainty without fabricating an extension", () => {
    const result = unwrap(
      evaluatePmfme({ ...input(), evaluationAsOfDate: "2026-08-24" }),
    );
    expect(result.eligibilityStatus).toBe("MANUAL_REVIEW_REQUIRED");
    expect(result.manualReviewItems).toContain(
      "PMFME_FORMAL_CONTINUATION_BEYOND_ORIGINAL_2024_25_PERIOD_NOT_LOCATED",
    );
    expect(pmfmeProgramDefinitions[0]?.effectiveTo).toBeUndefined();
  });

  it("registers official AIF convergence but does not compose funding", () => {
    const result = evaluateProgramCompatibility({
      programA: {
        programId: PMFME_PROGRAM_IDS.INDIVIDUAL_UNIT,
        programVersionId: programVersionId("2022-05-18-GUIDELINE-MODIFICATION"),
        evaluationAsOfDate: "2024-01-01",
      },
      programB: {
        programId: programId("GOI.AIF"),
        programVersionId: programVersionId("TEST"),
        evaluationAsOfDate: "2024-01-01",
      },
      asOfDate: "2024-01-01",
      rules: [pmfmeAifConvergenceRule],
    });
    expect(result.status).toBe("OFFICIAL_CONVERGENCE_SUPPORTED");
    expect(result.sourceReferences[0]?.sourceId).toBe(
      "PMFME.AIF.CONVERGENCE-SOP.2022-08-01",
    );
  });
});
