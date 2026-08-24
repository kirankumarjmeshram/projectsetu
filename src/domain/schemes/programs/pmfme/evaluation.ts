import {
  calculationFailure,
  calculationSuccess,
} from "../../../shared/calculation";
import {
  decimalValue,
  monetaryAmount,
  percentageToFactor,
  toDecimal,
  toMonetaryAmount,
} from "../../../shared/decimal";
import type { SourceReference } from "../../../shared/provenance";
import { programId } from "../../program";
import {
  PMFME_COMPONENT_ENTITIES,
  PMFME_INELIGIBLE_ACTIVITIES,
} from "./activities";
import type {
  PmfmeCalculationResult,
  PmfmeCostLineResult,
  PmfmeEvaluationInput,
  PmfmeRuleTrace,
} from "./contracts";
import {
  PMFME_COMMON_INFRA_CAP,
  PMFME_CONTRIBUTION_RATE,
  PMFME_INDIVIDUAL_CAP,
  PMFME_SEED_CAPITAL_PER_MEMBER,
  PMFME_SEED_CAPITAL_PER_SHG_CAP,
  PMFME_SUBSIDY_RATE,
} from "./rules";
import {
  pmfmeAifConvergenceSource,
  pmfmeCurrentPortalSource,
  pmfmeMay2022ModificationSource,
  pmfmeOriginalGuidelineSource,
} from "./sources";
import { PMFME_CURRENT_RULE_VERSION_ID } from "./version";

const componentProgramIds = {
  INDIVIDUAL_UNIT: programId("GOI.PMFME.INDIVIDUAL_UNIT"),
  GROUP_CAPITAL_SUPPORT: programId("GOI.PMFME.GROUP_CAPITAL_SUPPORT"),
  COMMON_INFRASTRUCTURE: programId("GOI.PMFME.COMMON_INFRASTRUCTURE"),
  SHG_SEED_CAPITAL: programId("GOI.PMFME.SHG_SEED_CAPITAL"),
} as const;

function evidence(
  value: { readonly source: SourceReference } | undefined,
): readonly SourceReference[] {
  return value ? [value.source] : [];
}

function trace(
  ruleId: string,
  result: string,
  explanationCode: string,
  evidenceSources: readonly SourceReference[] = [],
): PmfmeRuleTrace {
  return {
    ruleId,
    result,
    explanationCode,
    sourceReferences: [pmfmeMay2022ModificationSource],
    evidenceSources,
  };
}

function validateInput(input: PmfmeEvaluationInput) {
  const errors = [];
  const seen = new Set<string>();
  for (const [index, item] of input.costItems.entries()) {
    if (seen.has(item.costItemId)) {
      errors.push({
        code: "DUPLICATE_PMFME_COST_ITEM",
        message: "PMFME cost item ids must be unique.",
        path: `costItems.${index}.costItemId`,
      });
    }
    seen.add(item.costItemId);
    try {
      if (toDecimal(monetaryAmount(item.amount)).isNegative())
        throw new Error();
    } catch {
      errors.push({
        code: "INVALID_PMFME_COST_AMOUNT",
        message: "PMFME cost amounts must be non-negative decimal values.",
        path: `costItems.${index}.amount`,
      });
    }
  }
  if (input.foodProcessingShgMembers) {
    try {
      const members = toDecimal(
        decimalValue(input.foodProcessingShgMembers.value),
      );
      if (!members.isInteger() || members.isNegative()) throw new Error();
    } catch {
      errors.push({
        code: "INVALID_PMFME_SHG_MEMBER_COUNT",
        message:
          "Food-processing SHG member count must be a non-negative integer.",
        path: "foodProcessingShgMembers",
      });
    }
  }
  return errors;
}

function resolveCosts(input: PmfmeEvaluationInput): {
  readonly lines: readonly PmfmeCostLineResult[];
  readonly plant: ReturnType<typeof toDecimal>;
  readonly actualCivil: ReturnType<typeof toDecimal>;
  readonly maximumCivil: ReturnType<typeof toDecimal>;
  readonly eligibleCivil: ReturnType<typeof toDecimal>;
} {
  const plant = input.costItems
    .filter((item) => item.tag === "PLANT_AND_MACHINERY")
    .reduce(
      (total, item) => total.plus(toDecimal(item.amount)),
      toDecimal(monetaryAmount("0")),
    );
  const actualCivil = input.costItems
    .filter((item) => item.tag === "TECHNICAL_CIVIL_WORK")
    .reduce(
      (total, item) => total.plus(toDecimal(item.amount)),
      toDecimal(monetaryAmount("0")),
    );
  // C / (P + C) <= 30%, therefore C <= 3P/7. No rounding is introduced.
  const maximumCivil = plant.times("3").dividedBy("7");
  const eligibleCivil = actualCivil.lessThan(maximumCivil)
    ? actualCivil
    : maximumCivil;
  let allocatedCivil = toDecimal(monetaryAmount("0"));
  const civilItems = input.costItems.filter(
    (item) => item.tag === "TECHNICAL_CIVIL_WORK",
  );
  const lines = input.costItems.map((item) => {
    let eligibleAmount = toDecimal(monetaryAmount("0"));
    let explanationCode = "PMFME_COST_EXPRESSLY_EXCLUDED";
    if (item.tag === "PLANT_AND_MACHINERY") {
      eligibleAmount = toDecimal(item.amount);
      explanationCode = "PMFME_PLANT_AND_MACHINERY_ELIGIBLE";
    } else if (item.tag === "TECHNICAL_CIVIL_WORK") {
      const index = civilItems.indexOf(item);
      eligibleAmount = actualCivil.isZero()
        ? toDecimal(monetaryAmount("0"))
        : index === civilItems.length - 1
          ? eligibleCivil.minus(allocatedCivil)
          : eligibleCivil.times(toDecimal(item.amount)).dividedBy(actualCivil);
      allocatedCivil = allocatedCivil.plus(eligibleAmount);
      explanationCode = eligibleAmount.equals(toDecimal(item.amount))
        ? "PMFME_TECHNICAL_CIVIL_WITHIN_30_PERCENT_CAP"
        : "PMFME_TECHNICAL_CIVIL_CAPPED_AT_30_PERCENT_OF_ELIGIBLE_PROJECT_COST";
    }
    const original = toDecimal(item.amount);
    const status = eligibleAmount.isZero()
      ? "INELIGIBLE"
      : eligibleAmount.equals(original)
        ? "ELIGIBLE"
        : "PARTIALLY_ELIGIBLE";
    return {
      costItem: item,
      status,
      eligibleAmount: toMonetaryAmount(eligibleAmount),
      excludedAmount: toMonetaryAmount(original.minus(eligibleAmount)),
      trace: trace(
        `PMFME.COST.${item.tag}`,
        status,
        explanationCode,
        item.sourceReferences,
      ),
    } satisfies PmfmeCostLineResult;
  });
  return { lines, plant, actualCivil, maximumCivil, eligibleCivil };
}

export function evaluatePmfme(
  input: PmfmeEvaluationInput,
): PmfmeCalculationResult {
  const errors = validateInput(input);
  if (errors.length > 0) return calculationFailure(...errors);
  const component = input.component?.value;
  const cost = resolveCosts(input);
  const actual = input.costItems.reduce(
    (total, item) => total.plus(toDecimal(item.amount)),
    toDecimal(monetaryAmount("0")),
  );
  const eligible = cost.lines.reduce(
    (total, line) => total.plus(toDecimal(line.eligibleAmount)),
    toDecimal(monetaryAmount("0")),
  );
  const contribution = actual.times(
    percentageToFactor(PMFME_CONTRIBUTION_RATE),
  );
  const actualContribution = input.actualBeneficiaryContribution
    ? toDecimal(input.actualBeneficiaryContribution.value)
    : undefined;
  const shortfall = actualContribution
    ? contribution.minus(actualContribution).greaterThan(0)
      ? contribution.minus(actualContribution)
      : toDecimal(monetaryAmount("0"))
    : contribution;
  const capitalComponent =
    component === "INDIVIDUAL_UNIT" ||
    component === "GROUP_CAPITAL_SUPPORT" ||
    component === "COMMON_INFRASTRUCTURE";
  const rawSubsidy = capitalComponent
    ? eligible.times(percentageToFactor(PMFME_SUBSIDY_RATE))
    : toDecimal(monetaryAmount("0"));
  const subsidyCap =
    component === "COMMON_INFRASTRUCTURE"
      ? PMFME_COMMON_INFRA_CAP
      : component === "INDIVIDUAL_UNIT" || component === "GROUP_CAPITAL_SUPPORT"
        ? PMFME_INDIVIDUAL_CAP
        : undefined;
  const subsidy =
    subsidyCap && rawSubsidy.greaterThan(toDecimal(subsidyCap))
      ? toDecimal(subsidyCap)
      : rawSubsidy;
  const memberCount = input.foodProcessingShgMembers
    ? toDecimal(input.foodProcessingShgMembers.value)
    : toDecimal(decimalValue("0"));
  const rawSeed =
    component === "SHG_SEED_CAPITAL"
      ? memberCount.times(toDecimal(PMFME_SEED_CAPITAL_PER_MEMBER))
      : toDecimal(monetaryAmount("0"));
  const seed = rawSeed.greaterThan(toDecimal(PMFME_SEED_CAPITAL_PER_SHG_CAP))
    ? toDecimal(PMFME_SEED_CAPITAL_PER_SHG_CAP)
    : rawSeed;

  const manualReviewItems: string[] = [];
  if (!component) manualReviewItems.push("PMFME_COMPONENT_REQUIRED");
  if (!input.entityType) manualReviewItems.push("PMFME_ENTITY_TYPE_REQUIRED");
  if (!input.activityClassification) {
    manualReviewItems.push("PMFME_ACTIVITY_CLASSIFICATION_REQUIRED");
  }
  if (!input.odopStatus && component !== "SHG_SEED_CAPITAL") {
    manualReviewItems.push("PMFME_ODOP_STATUS_REQUIRED");
  }
  if (!input.projectType && component !== "SHG_SEED_CAPITAL") {
    manualReviewItems.push("PMFME_PROJECT_TYPE_REQUIRED");
  }
  if (!actualContribution && capitalComponent) {
    manualReviewItems.push("PMFME_ACTUAL_CONTRIBUTION_REQUIRED");
  }
  if (component === "SHG_SEED_CAPITAL" && !input.foodProcessingShgMembers) {
    manualReviewItems.push("PMFME_FOOD_PROCESSING_SHG_MEMBER_COUNT_REQUIRED");
  }
  if (input.activityClassification?.value === "UNVERIFIED_ACTIVITY") {
    manualReviewItems.push("PMFME_ACTIVITY_REQUIRES_MANUAL_REVIEW");
  }
  if (input.evaluationAsOfDate > "2025-03-31") {
    manualReviewItems.push(
      "PMFME_FORMAL_CONTINUATION_BEYOND_ORIGINAL_2024_25_PERIOD_NOT_LOCATED",
    );
  }
  const entityFails =
    component !== undefined &&
    input.entityType !== undefined &&
    !PMFME_COMPONENT_ENTITIES[component].includes(input.entityType.value);
  const activityFails =
    input.activityClassification !== undefined &&
    PMFME_INELIGIBLE_ACTIVITIES.includes(input.activityClassification.value);
  const contributionFails =
    capitalComponent &&
    actualContribution !== undefined &&
    shortfall.greaterThan(0);
  const missingRequired =
    !component ||
    !input.entityType ||
    !input.activityClassification ||
    (component !== "SHG_SEED_CAPITAL" &&
      (!input.odopStatus || !input.projectType)) ||
    (component === "SHG_SEED_CAPITAL" && !input.foodProcessingShgMembers);
  const eligibilityStatus =
    entityFails || activityFails || contributionFails
      ? "INELIGIBLE"
      : missingRequired
        ? "INSUFFICIENT_INFORMATION"
        : manualReviewItems.length > 0
          ? "MANUAL_REVIEW_REQUIRED"
          : "ELIGIBLE";
  const activityTrace = trace(
    "PMFME.ACTIVITY.ANNEXURE-I",
    !input.activityClassification
      ? "INSUFFICIENT_INFORMATION"
      : activityFails
        ? "INELIGIBLE"
        : input.activityClassification.value === "UNVERIFIED_ACTIVITY"
          ? "MANUAL_REVIEW_REQUIRED"
          : "ELIGIBLE",
    activityFails
      ? "PMFME_ACTIVITY_APPEARS_IN_2022_ANNEXURE_I_NEGATIVE_LIST"
      : "PMFME_ACTIVITY_SCOPE_EVALUATED",
    evidence(input.activityClassification),
  );
  const entityTrace = trace(
    "PMFME.COMPONENT.ENTITY",
    !component || !input.entityType
      ? "INSUFFICIENT_INFORMATION"
      : entityFails
        ? "FAIL"
        : "PASS",
    "PMFME_COMPONENT_SPECIFIC_ENTITY_RULE_EVALUATED",
    [...evidence(input.component), ...evidence(input.entityType)],
  );
  return calculationSuccess({
    snapshot: {
      programId: component
        ? componentProgramIds[component]
        : programId("GOI.PMFME.UNRESOLVED_COMPONENT"),
      programVersionId: PMFME_CURRENT_RULE_VERSION_ID,
      evaluationAsOfDate: input.evaluationAsOfDate,
    },
    ...(component ? { component } : {}),
    actualProjectCost: toMonetaryAmount(actual),
    eligibleProjectCost: toMonetaryAmount(eligible),
    eligiblePlantMachinery: toMonetaryAmount(cost.plant),
    actualTechnicalCivilWork: toMonetaryAmount(cost.actualCivil),
    maximumEligibleTechnicalCivilWork: toMonetaryAmount(cost.maximumCivil),
    eligibleTechnicalCivilWork: toMonetaryAmount(cost.eligibleCivil),
    excessTechnicalCivilWork: toMonetaryAmount(
      cost.actualCivil.minus(cost.eligibleCivil),
    ),
    excludedCosts: toMonetaryAmount(actual.minus(eligible)),
    requiredBeneficiaryContribution: capitalComponent
      ? toMonetaryAmount(contribution)
      : monetaryAmount("0"),
    ...(input.actualBeneficiaryContribution
      ? {
          actualBeneficiaryContribution:
            input.actualBeneficiaryContribution.value,
        }
      : {}),
    contributionShortfall: capitalComponent
      ? toMonetaryAmount(shortfall)
      : monetaryAmount("0"),
    bankFinanceRequirement: capitalComponent
      ? toMonetaryAmount(actual.minus(contribution))
      : monetaryAmount("0"),
    ...(capitalComponent ? { subsidyRate: PMFME_SUBSIDY_RATE } : {}),
    rawSubsidy: toMonetaryAmount(rawSubsidy),
    ...(subsidyCap ? { subsidyCap } : {}),
    calculatedEligibleSubsidy: toMonetaryAmount(subsidy),
    calculatedSeedCapital: toMonetaryAmount(seed),
    ...(input.odopStatus ? { odopStatus: input.odopStatus.value } : {}),
    eligibilityStatus,
    manualReviewItems: [...new Set(manualReviewItems)],
    convergenceMetadata: [
      "PMFME_AIF_OFFICIAL_CONVERGENCE_SUPPORTED",
      "AIF_3_PERCENT_INTEREST_SUBVENTION_SUBJECT_TO_AIF_RULES",
      "AIF_CREDIT_GUARANTEE_SUPPORT_SUBJECT_TO_AIF_RULES",
      "NO_FUNDING_STACK_ALLOCATION_PERFORMED",
    ],
    costLines: cost.lines,
    ruleTraces: [
      entityTrace,
      activityTrace,
      ...cost.lines.map((line) => line.trace),
      {
        ruleId: "PMFME.AIF.CONVERGENCE",
        result: "OFFICIAL_CONVERGENCE_SUPPORTED",
        explanationCode: "PMFME_AIF_SOP_REGISTERED_AS_METADATA_ONLY",
        sourceReferences: [pmfmeAifConvergenceSource],
        evidenceSources: [],
      },
      {
        ruleId: "PMFME.STATUS.ORIGINAL-DURATION",
        result:
          input.evaluationAsOfDate > "2025-03-31"
            ? "MANUAL_REVIEW_REQUIRED"
            : "WITHIN_ORIGINAL_PERIOD",
        explanationCode:
          "PMFME_PORTAL_IS_OPERATIONAL_BUT_FORMAL_EXTENSION_WAS_NOT_LOCATED",
        sourceReferences: [
          pmfmeOriginalGuidelineSource,
          pmfmeCurrentPortalSource,
        ],
        evidenceSources: [],
      },
    ],
  });
}
