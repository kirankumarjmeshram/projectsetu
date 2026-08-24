import {
  calculationFailure,
  calculationSuccess,
} from "../../../shared/calculation";
import {
  decimalValue,
  monetaryAmount,
  percentage,
  percentageToFactor,
  toDecimal,
  toMonetaryAmount,
} from "../../../shared/decimal";
import type { SourceReference } from "../../../shared/provenance";
import { programId } from "../../program";
import { NLM_ACTIVITY_RULES } from "./activities";
import type {
  NlmCalculationResult,
  NlmCostLineResult,
  NlmEvaluationInput,
  NlmRuleTrace,
  NlmUnitResolution,
} from "./contracts";
import { NLM_ALWAYS_EXCLUDED_COST_TAGS, NLM_SUBSIDY_RATE } from "./rules";
import {
  nlmFebruary2026AmendmentSource,
  nlmJanuary2025GuidelineSource,
  nlmUnitSizeSource,
} from "./sources";
import { NLM_CURRENT_VERSION_ID } from "./version";

function evidence(
  value: { readonly source: SourceReference } | undefined,
): readonly SourceReference[] {
  return value ? [value.source] : [];
}

function trace(
  ruleId: string,
  result: string,
  explanationCode: string,
  evidenceSources: readonly SourceReference[],
  amendment = false,
): NlmRuleTrace {
  return {
    ruleId,
    result,
    explanationCode,
    sourceReferences: amendment
      ? [nlmJanuary2025GuidelineSource, nlmFebruary2026AmendmentSource]
      : [nlmJanuary2025GuidelineSource],
    evidenceSources,
  };
}

function validateInput(input: NlmEvaluationInput) {
  const errors = [];
  const seen = new Set<string>();
  for (const [index, item] of input.costItems.entries()) {
    if (seen.has(item.costItemId)) {
      errors.push({
        code: "DUPLICATE_NLM_COST_ITEM",
        message: "NLM cost item ids must be unique.",
        path: `costItems.${index}.costItemId`,
      });
    }
    seen.add(item.costItemId);
    try {
      if (toDecimal(monetaryAmount(item.amount)).isNegative())
        throw new Error();
    } catch {
      errors.push({
        code: "INVALID_NLM_COST_AMOUNT",
        message: "NLM cost amounts must be non-negative decimal values.",
        path: `costItems.${index}.amount`,
      });
    }
  }
  for (const [path, value] of [
    ["femaleAnimals", input.femaleAnimals],
    ["maleAnimals", input.maleAnimals],
  ] as const) {
    if (!value) continue;
    try {
      if (toDecimal(decimalValue(value.value)).isNegative()) throw new Error();
    } catch {
      errors.push({
        code: "INVALID_NLM_UNIT_SIZE",
        message: "NLM unit sizes must be non-negative decimal values.",
        path,
      });
    }
  }
  return errors;
}

function resolveUnit(input: NlmEvaluationInput): NlmUnitResolution {
  const activity = input.activity?.value;
  if (!activity) {
    return {
      capacityCompliance: "INSUFFICIENT_INFORMATION",
      trace: trace(
        "NLM.UNIT.ACTIVITY",
        "INSUFFICIENT_INFORMATION",
        "NLM_ACTIVITY_MISSING",
        evidence(input.activity),
      ),
    };
  }
  const rule = NLM_ACTIVITY_RULES[activity];
  if (rule.unitOptions.length === 0) {
    return {
      applicableSubsidyCap: rule.fixedCap,
      capacityCompliance: "NOT_APPLICABLE",
      trace: trace(
        `NLM.${activity}.UNIT-NOT-APPLICABLE`,
        "NOT_APPLICABLE",
        "NLM_ACTIVITY_HAS_FIXED_CAP_WITHOUT_CONFIGURED_ANIMAL_UNIT",
        evidence(input.activity),
        activity === "FODDER_SEED_PROCESSING",
      ),
    };
  }
  if (!input.femaleAnimals || !input.maleAnimals) {
    return {
      capacityCompliance: "INSUFFICIENT_INFORMATION",
      trace: trace(
        `NLM.${activity}.UNIT-SIZE`,
        "INSUFFICIENT_INFORMATION",
        "NLM_UNIT_SIZE_EVIDENCE_MISSING",
        [...evidence(input.femaleAnimals), ...evidence(input.maleAnimals)],
        ["HORSE", "DONKEY", "CAMEL"].includes(activity),
      ),
    };
  }
  const female = decimalValue(input.femaleAnimals.value);
  const male = decimalValue(input.maleAnimals.value);
  const actualUnitSize = { female, male };
  const matching = rule.unitOptions.filter(
    (option) =>
      toDecimal(option.female).equals(toDecimal(female)) &&
      toDecimal(option.male).equals(toDecimal(male)),
  );
  if (
    activity === "CAMEL" &&
    toDecimal(female).equals("10") &&
    toDecimal(male).equals("1") &&
    input.isPastoralCamelUnit === undefined
  ) {
    return {
      actualUnitSize,
      capacityCompliance: "INSUFFICIENT_INFORMATION",
      trace: trace(
        "NLM.CAMEL.PASTORAL-STATUS",
        "INSUFFICIENT_INFORMATION",
        "NLM_CAMEL_PASTORAL_STATUS_REQUIRED_FOR_10_PLUS_1_CAP",
        [],
        true,
      ),
    };
  }
  const option = matching.find(
    (candidate) =>
      (!candidate.pastoralOnly || input.isPastoralCamelUnit?.value === true) &&
      (!candidate.nonPastoralOnly ||
        input.isPastoralCamelUnit?.value === false),
  );
  if (option) {
    return {
      configuredUnitSize: { female: option.female, male: option.male },
      actualUnitSize,
      applicableSubsidyCap: option.cap,
      capacityCompliance: "MEETS_CONFIGURED_SIZE",
      trace: {
        ruleId: `NLM.${activity}.UNIT-CAP`,
        result: option.cap,
        explanationCode: "NLM_CONFIGURED_UNIT_SIZE_AND_ACTIVITY_CAP_APPLIED",
        sourceReferences: [
          nlmUnitSizeSource,
          ...(activity === "HORSE" ||
          activity === "DONKEY" ||
          activity === "CAMEL"
            ? [nlmFebruary2026AmendmentSource]
            : []),
        ],
        evidenceSources: [
          input.femaleAnimals.source,
          input.maleAnimals.source,
          ...evidence(input.isPastoralCamelUnit),
        ],
      },
    };
  }
  const minimum = rule.unitOptions[0]!;
  const below =
    toDecimal(female).lessThan(toDecimal(minimum.female)) ||
    toDecimal(male).lessThan(toDecimal(minimum.male));
  return {
    actualUnitSize,
    capacityCompliance: below ? "BELOW_MINIMUM" : "UNCONFIGURED_SIZE",
    trace: {
      ruleId: `NLM.${activity}.UNIT-CAP`,
      result: below ? "BELOW_MINIMUM" : "UNCONFIGURED_SIZE",
      explanationCode: below
        ? "NLM_UNIT_BELOW_MINIMUM"
        : "NLM_UNIT_DOES_NOT_MATCH_AN_AUTHORITATIVE_CONFIGURED_SIZE",
      sourceReferences: [nlmUnitSizeSource],
      evidenceSources: [input.femaleAnimals.source, input.maleAnimals.source],
    },
  };
}

function resolveCosts(input: NlmEvaluationInput): readonly NlmCostLineResult[] {
  const activity = input.activity?.value;
  return input.costItems.map((costItem) => {
    const alwaysExcluded = NLM_ALWAYS_EXCLUDED_COST_TAGS.includes(costItem.tag);
    const eligible =
      activity !== undefined &&
      NLM_ACTIVITY_RULES[activity].eligibleCostTags.includes(costItem.tag);
    const status = alwaysExcluded
      ? "INELIGIBLE"
      : eligible
        ? "ELIGIBLE"
        : "MANUAL_REVIEW_REQUIRED";
    const eligibleAmount =
      status === "ELIGIBLE" ? costItem.amount : monetaryAmount("0");
    return {
      costItem,
      status,
      eligibleAmount,
      excludedAmount: toMonetaryAmount(
        toDecimal(costItem.amount).minus(toDecimal(eligibleAmount)),
      ),
      trace: trace(
        `NLM.COST.${costItem.tag}`,
        status,
        alwaysExcluded
          ? "NLM_COST_EXPRESSLY_EXCLUDED"
          : eligible
            ? "NLM_ACTIVITY_COST_COMPONENT_ELIGIBLE"
            : "NLM_COST_COMPONENT_NOT_VERIFIED_FOR_SELECTED_ACTIVITY",
        costItem.sourceReferences,
        activity === "FODDER_SEED_PROCESSING",
      ),
    };
  });
}

export function evaluateNlm(input: NlmEvaluationInput): NlmCalculationResult {
  const errors = validateInput(input);
  if (errors.length > 0) return calculationFailure(...errors);

  const activity = input.activity?.value;
  const rule = activity ? NLM_ACTIVITY_RULES[activity] : undefined;
  const unitResolution = resolveUnit(input);
  const costLines = resolveCosts(input);
  const actual = costLines.reduce(
    (total, line) => total.plus(toDecimal(line.costItem.amount)),
    toDecimal(monetaryAmount("0")),
  );
  const eligible = costLines.reduce(
    (total, line) => total.plus(toDecimal(line.eligibleAmount)),
    toDecimal(monetaryAmount("0")),
  );
  const raw = eligible.times(percentageToFactor(NLM_SUBSIDY_RATE));
  const cap = unitResolution.applicableSubsidyCap ?? rule?.fixedCap;
  const benefitCanBeResolved =
    rule !== undefined && (rule.unitOptions.length === 0 || cap !== undefined);
  const calculated = !benefitCanBeResolved
    ? toDecimal(monetaryAmount("0"))
    : cap && raw.greaterThan(toDecimal(cap))
      ? toDecimal(cap)
      : raw;
  const manualReviewItems: string[] = [];
  if (!activity) manualReviewItems.push("NLM_ACTIVITY_REQUIRED");
  if (!input.entityType) manualReviewItems.push("NLM_ENTITY_TYPE_REQUIRED");
  if (!input.financeMode) manualReviewItems.push("NLM_FINANCE_MODE_REQUIRED");
  if (
    rule &&
    input.entityType &&
    !rule.eligibleEntities.includes(input.entityType.value)
  ) {
    manualReviewItems.push("NLM_ENTITY_NOT_ELIGIBLE_FOR_ACTIVITY");
  }
  if (
    unitResolution.capacityCompliance === "INSUFFICIENT_INFORMATION" ||
    unitResolution.capacityCompliance === "UNCONFIGURED_SIZE"
  ) {
    manualReviewItems.push("NLM_UNIT_SIZE_REQUIRES_RESOLUTION");
  }
  if (costLines.some((line) => line.status === "MANUAL_REVIEW_REQUIRED")) {
    manualReviewItems.push("NLM_UNVERIFIED_COST_COMPONENT_PRESENT");
  }
  const unitFails = unitResolution.capacityCompliance === "BELOW_MINIMUM";
  const entityFails =
    rule !== undefined &&
    input.entityType !== undefined &&
    !rule.eligibleEntities.includes(input.entityType.value);
  const eligibilityStatus =
    unitFails || entityFails
      ? "INELIGIBLE"
      : !activity || !input.entityType || !input.financeMode
        ? "INSUFFICIENT_INFORMATION"
        : manualReviewItems.length > 0
          ? "MANUAL_REVIEW_REQUIRED"
          : "ELIGIBLE";
  const entityTrace = trace(
    "NLM.ENTITY.ACTIVITY-SPECIFIC",
    !input.entityType
      ? "INSUFFICIENT_INFORMATION"
      : !rule
        ? "ACTIVITY_MISSING"
        : rule.eligibleEntities.includes(input.entityType.value)
          ? "PASS"
          : "FAIL",
    "NLM_ACTIVITY_SPECIFIC_ENTITY_RULE_EVALUATED",
    evidence(input.entityType),
    true,
  );
  const conditions =
    input.financeMode?.value === "SELF_FINANCE"
      ? [
          "PROJECT_APPRAISAL_BY_ACCOUNT_BANK_REQUIRED",
          "FIRST_INSTALLMENT_AFTER_25_PERCENT_INFRASTRUCTURE_EXPENDITURE_AND_SIA_VERIFICATION",
          "THREE_YEAR_BANK_GUARANTEE_FOR_REMAINING_PROJECT_COST_REQUIRED",
          "SECOND_INSTALLMENT_AFTER_COMPLETION_AND_SIA_VERIFICATION",
        ]
      : [
          "FIRST_INSTALLMENT_AFTER_LENDER_FIRST_LOAN_DISBURSEMENT_AND_SIA_CONFIRMATION",
          "SECOND_INSTALLMENT_AFTER_PROJECT_COMPLETION_AND_SIA_VERIFICATION",
        ];
  return calculationSuccess({
    snapshot: {
      programId: rule?.programId ?? programId("GOI.NLM.UNRESOLVED_ACTIVITY"),
      programVersionId: NLM_CURRENT_VERSION_ID,
      evaluationAsOfDate: input.evaluationAsOfDate,
    },
    ...(activity ? { activity } : {}),
    ...(input.entityType ? { entityType: input.entityType.value } : {}),
    actualProjectCost: toMonetaryAmount(actual),
    eligibleCapitalCost: toMonetaryAmount(eligible),
    excludedCost: toMonetaryAmount(actual.minus(eligible)),
    subsidyRate: percentage("50"),
    rawSubsidy: toMonetaryAmount(raw),
    ...(cap ? { activityCap: cap } : {}),
    calculatedEligibleSubsidy: toMonetaryAmount(calculated),
    remainingFundingRequirement: toMonetaryAmount(actual.minus(calculated)),
    unitResolution,
    financeModeConstraints: {
      bankFinanceAllowed: true,
      selfFinanceAllowed: true,
      ...(input.financeMode ? { selectedMode: input.financeMode.value } : {}),
      conditions,
    },
    installmentMetadata: {
      installmentCount: 2,
      installmentPercentages: [percentage("50"), percentage("50")],
      releaseTriggers: conditions,
      verificationConditions: [
        "STATE_IMPLEMENTING_AGENCY_VERIFICATION",
        "PROJECT_COMPLETION_CERTIFICATION_BEFORE_SECOND_INSTALLMENT",
      ],
      sourceReferences: [nlmJanuary2025GuidelineSource],
    },
    eligibilityStatus,
    manualReviewItems: [...new Set(manualReviewItems)],
    costLines,
    ruleTraces: [
      entityTrace,
      unitResolution.trace,
      ...costLines.map((line) => line.trace),
    ],
  });
}
