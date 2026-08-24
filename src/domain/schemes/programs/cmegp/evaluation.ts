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
import { CMEGP_VERIFIED_ELIGIBLE_ACTIVITIES } from "./activities";
import type {
  CmegpCalculationResult,
  CmegpCostLineResult,
  CmegpEvaluationInput,
  CmegpRuleTrace,
} from "./contracts";
import {
  cmegpContributionRate,
  cmegpProjectCeiling,
  cmegpSubsidyCap,
  cmegpSubsidyRate,
  cmegpWorkingCapitalRate,
} from "./rules";
import {
  cmegpMay2025AmendmentSource,
  cmegpOctober2025VerificationSource,
  cmegpOriginalGrSource,
} from "./sources";
import { CMEGP_CURRENT_VERSION_ID } from "./version";

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
  baseAlso = false,
): CmegpRuleTrace {
  return {
    ruleId,
    result,
    explanationCode,
    sourceReferences: baseAlso
      ? [cmegpOriginalGrSource, cmegpMay2025AmendmentSource]
      : [cmegpMay2025AmendmentSource],
    evidenceSources,
  };
}

function validateInput(input: CmegpEvaluationInput) {
  const errors = [];
  const seen = new Set<string>();
  for (const [index, item] of input.costItems.entries()) {
    if (seen.has(item.costItemId)) {
      errors.push({
        code: "DUPLICATE_CMEGP_COST_ITEM",
        message: "CMEGP cost item ids must be unique.",
        path: `costItems.${index}.costItemId`,
      });
    }
    seen.add(item.costItemId);
    try {
      if (toDecimal(monetaryAmount(item.amount)).isNegative())
        throw new Error();
    } catch {
      errors.push({
        code: "INVALID_CMEGP_COST_AMOUNT",
        message: "CMEGP cost amounts must be non-negative decimal values.",
        path: `costItems.${index}.amount`,
      });
    }
  }
  if (input.applicantAgeYears) {
    try {
      if (toDecimal(decimalValue(input.applicantAgeYears.value)).isNegative()) {
        throw new Error();
      }
    } catch {
      errors.push({
        code: "INVALID_CMEGP_APPLICANT_AGE",
        message: "CMEGP applicant age must be a non-negative decimal value.",
        path: "applicantAgeYears",
      });
    }
  }
  return errors;
}

function resolveCosts(
  input: CmegpEvaluationInput,
): readonly CmegpCostLineResult[] {
  const capital = input.costItems
    .filter(
      (item) => item.tag === "BUILDING" || item.tag === "MACHINERY_EQUIPMENT",
    )
    .reduce(
      (total, item) => total.plus(toDecimal(item.amount)),
      toDecimal(monetaryAmount("0")),
    );
  const workingItems = input.costItems.filter(
    (item) => item.tag === "WORKING_CAPITAL",
  );
  const actualWorking = workingItems.reduce(
    (total, item) => total.plus(toDecimal(item.amount)),
    toDecimal(monetaryAmount("0")),
  );
  const rate = input.sector
    ? percentageToFactor(cmegpWorkingCapitalRate(input.sector.value))
    : undefined;
  const maximumWorking = rate
    ? capital.times(rate).dividedBy(toDecimal(decimalValue("1")).minus(rate))
    : toDecimal(monetaryAmount("0"));
  const eligibleWorking = actualWorking.lessThan(maximumWorking)
    ? actualWorking
    : maximumWorking;
  let allocatedWorking = toDecimal(monetaryAmount("0"));
  return input.costItems.map((item) => {
    const amount = toDecimal(item.amount);
    let eligibleAmount = toDecimal(monetaryAmount("0"));
    let status: CmegpCostLineResult["status"] = "MANUAL_REVIEW_REQUIRED";
    let explanationCode = "CMEGP_COST_COMPONENT_NOT_VERIFIED_BY_CURRENT_GR";
    if (item.tag === "BUILDING" || item.tag === "MACHINERY_EQUIPMENT") {
      eligibleAmount = amount;
      status = "ELIGIBLE";
      explanationCode = "CMEGP_FIXED_CAPITAL_COMPONENT_ELIGIBLE";
    } else if (item.tag === "WORKING_CAPITAL" && input.sector) {
      const index = workingItems.indexOf(item);
      eligibleAmount = actualWorking.isZero()
        ? toDecimal(monetaryAmount("0"))
        : index === workingItems.length - 1
          ? eligibleWorking.minus(allocatedWorking)
          : eligibleWorking.times(amount).dividedBy(actualWorking);
      allocatedWorking = allocatedWorking.plus(eligibleAmount);
      status = eligibleAmount.equals(amount)
        ? "ELIGIBLE"
        : "PARTIALLY_ELIGIBLE";
      explanationCode = eligibleAmount.equals(amount)
        ? "CMEGP_WORKING_CAPITAL_WITHIN_SECTOR_LIMIT"
        : "CMEGP_WORKING_CAPITAL_CAPPED_AT_SECTOR_PERCENTAGE";
    }
    return {
      costItem: item,
      status,
      eligibleAmount: toMonetaryAmount(eligibleAmount),
      excludedAmount: toMonetaryAmount(amount.minus(eligibleAmount)),
      trace: trace(
        `CMEGP.COST.${item.tag}`,
        status,
        explanationCode,
        item.sourceReferences,
      ),
    };
  });
}

export function evaluateCmegp(
  input: CmegpEvaluationInput,
): CmegpCalculationResult {
  const errors = validateInput(input);
  if (errors.length > 0) return calculationFailure(...errors);
  const costLines = resolveCosts(input);
  const actual = costLines.reduce(
    (total, line) => total.plus(toDecimal(line.costItem.amount)),
    toDecimal(monetaryAmount("0")),
  );
  const eligible = costLines.reduce(
    (total, line) => total.plus(toDecimal(line.eligibleAmount)),
    toDecimal(monetaryAmount("0")),
  );
  const ceiling = input.sector
    ? cmegpProjectCeiling(input.sector.value)
    : undefined;
  const admissible =
    ceiling && eligible.greaterThan(toDecimal(ceiling))
      ? toDecimal(ceiling)
      : eligible;
  const rate =
    input.beneficiaryCategory && input.areaClassification
      ? cmegpSubsidyRate(
          input.beneficiaryCategory.value,
          input.areaClassification.value,
        )
      : undefined;
  const subsidyCap =
    input.sector && input.beneficiaryCategory && input.areaClassification
      ? cmegpSubsidyCap(
          input.sector.value,
          input.beneficiaryCategory.value,
          input.areaClassification.value,
        )
      : undefined;
  const raw = rate
    ? admissible.times(percentageToFactor(rate))
    : toDecimal(monetaryAmount("0"));
  const subsidy =
    subsidyCap && raw.greaterThan(toDecimal(subsidyCap))
      ? toDecimal(subsidyCap)
      : raw;
  const contributionRate = input.beneficiaryCategory
    ? cmegpContributionRate(input.beneficiaryCategory.value)
    : undefined;
  const contribution = contributionRate
    ? admissible.times(percentageToFactor(contributionRate))
    : toDecimal(monetaryAmount("0"));
  const actualContribution = input.actualBeneficiaryContribution
    ? toDecimal(input.actualBeneficiaryContribution.value)
    : undefined;
  const shortfall =
    actualContribution && contribution.greaterThan(actualContribution)
      ? contribution.minus(actualContribution)
      : actualContribution
        ? toDecimal(monetaryAmount("0"))
        : contribution;
  const expectedBank = admissible.minus(contribution).minus(subsidy);

  const manualReviewItems: string[] = [];
  if (!input.projectState)
    manualReviewItems.push("CMEGP_PROJECT_STATE_REQUIRED");
  if (!input.sector) manualReviewItems.push("CMEGP_SECTOR_REQUIRED");
  if (!input.beneficiaryCategory)
    manualReviewItems.push("CMEGP_BENEFICIARY_CATEGORY_REQUIRED");
  if (!input.areaClassification)
    manualReviewItems.push("CMEGP_AREA_CLASSIFICATION_REQUIRED");
  if (!input.entityType) manualReviewItems.push("CMEGP_ENTITY_TYPE_REQUIRED");
  if (input.entityType?.value === "INDIVIDUAL" && !input.applicantAgeYears) {
    manualReviewItems.push("CMEGP_INDIVIDUAL_AGE_REQUIRED");
  }
  if (!input.activityClassification)
    manualReviewItems.push("CMEGP_ACTIVITY_REQUIRED");
  if (!input.hasPriorGovernmentSubsidyBenefit) {
    manualReviewItems.push("CMEGP_PRIOR_SUBSIDY_HISTORY_REQUIRED");
  }
  if (!input.actualBeneficiaryContribution) {
    manualReviewItems.push("CMEGP_ACTUAL_CONTRIBUTION_REQUIRED");
  }
  if (input.activityClassification?.value === "UNVERIFIED") {
    manualReviewItems.push(
      "CMEGP_ACTIVITY_REQUIRES_CURRENT_NEGATIVE_LIST_REVIEW",
    );
  }
  if (costLines.some((line) => line.status === "MANUAL_REVIEW_REQUIRED")) {
    manualReviewItems.push("CMEGP_UNVERIFIED_COST_COMPONENT_PRESENT");
  }
  const stateFails =
    input.projectState !== undefined &&
    input.projectState.value !== "MAHARASHTRA";
  const activityFails =
    input.activityClassification?.value === "STATE_NEGATIVE_LIST_ACTIVITY";
  const activityManual =
    input.activityClassification !== undefined &&
    !CMEGP_VERIFIED_ELIGIBLE_ACTIVITIES.includes(
      input.activityClassification.value,
    ) &&
    !activityFails;
  if (activityManual) manualReviewItems.push("CMEGP_ACTIVITY_NOT_VERIFIED");
  const ageFails =
    input.entityType?.value === "INDIVIDUAL" &&
    input.applicantAgeYears !== undefined &&
    toDecimal(input.applicantAgeYears.value).lessThan("18");
  const priorSubsidyFails =
    input.hasPriorGovernmentSubsidyBenefit?.value === true;
  const contributionFails =
    actualContribution !== undefined && shortfall.greaterThan(0);
  const missing =
    !input.projectState ||
    !input.sector ||
    !input.beneficiaryCategory ||
    !input.areaClassification ||
    !input.entityType ||
    !input.activityClassification ||
    !input.hasPriorGovernmentSubsidyBenefit ||
    !input.actualBeneficiaryContribution ||
    (input.entityType.value === "INDIVIDUAL" && !input.applicantAgeYears);
  const eligibilityStatus =
    stateFails ||
    activityFails ||
    ageFails ||
    priorSubsidyFails ||
    contributionFails
      ? "INELIGIBLE"
      : missing
        ? "INSUFFICIENT_INFORMATION"
        : manualReviewItems.length > 0
          ? "MANUAL_REVIEW_REQUIRED"
          : "ELIGIBLE";
  const jurisdiction = !input.projectState
    ? "UNKNOWN"
    : input.projectState.value === "MAHARASHTRA"
      ? "MAHARASHTRA"
      : "OTHER";
  return calculationSuccess({
    snapshot: {
      programId: programId("MH.CMEGP.NEW_ENTERPRISE"),
      programVersionId: CMEGP_CURRENT_VERSION_ID,
      evaluationAsOfDate: input.evaluationAsOfDate,
    },
    jurisdiction,
    component: "NEW_ENTERPRISE",
    actualProjectCost: toMonetaryAmount(actual),
    eligibleProjectCost: toMonetaryAmount(eligible),
    admissibleProjectCost: toMonetaryAmount(admissible),
    ...(ceiling ? { projectCeiling: ceiling } : {}),
    excludedCosts: toMonetaryAmount(actual.minus(eligible)),
    ...(input.beneficiaryCategory
      ? { beneficiaryCategory: input.beneficiaryCategory.value }
      : {}),
    ...(input.areaClassification
      ? { areaClassification: input.areaClassification.value }
      : {}),
    requiredContribution: toMonetaryAmount(contribution),
    ...(input.actualBeneficiaryContribution
      ? { actualContribution: input.actualBeneficiaryContribution.value }
      : {}),
    contributionShortfall: toMonetaryAmount(shortfall),
    ...(rate ? { subsidyRate: rate } : {}),
    rawSubsidy: toMonetaryAmount(raw),
    ...(subsidyCap ? { subsidyCap } : {}),
    calculatedEligibleSubsidy: toMonetaryAmount(subsidy),
    expectedBankFinance: toMonetaryAmount(expectedBank),
    releaseMetadata: {
      creditLinked: true,
      immediateBeneficiaryCash: false,
      holdingPeriodYears: decimalValue("3"),
      physicalVerificationAfterYears: decimalValue("2"),
      adjustmentAfterYears: decimalValue("3"),
      conditions: [
        "MARGIN_MONEY_HELD_BY_FINANCING_BANK_AGAINST_LOAN_ACCOUNT",
        "PHYSICAL_ASSET_VERIFICATION_AFTER_TWO_YEARS_FROM_FIRST_LOAN_DISBURSEMENT",
        "ADJUSTMENT_AFTER_THREE_YEARS_FROM_FIRST_LOAN_DISBURSEMENT",
        "DISTRICT_LEVEL_TASK_FORCE_COMMITTEE_APPROVAL_REQUIRED_FOR_ADJUSTMENT",
      ],
    },
    eligibilityStatus,
    manualReviewItems: [...new Set(manualReviewItems)],
    costLines,
    ruleTraces: [
      trace(
        "CMEGP.JURISDICTION",
        jurisdiction,
        "CMEGP_REQUIRES_EXPLICIT_MAHARASHTRA_PROJECT_LOCATION",
        evidence(input.projectState),
      ),
      trace(
        "CMEGP.RATE-CAP-MATRIX",
        rate && subsidyCap
          ? `${rate}:${subsidyCap}`
          : "INSUFFICIENT_INFORMATION",
        "CMEGP_2025_SECTOR_CATEGORY_AREA_MATRIX_APPLIED",
        [
          ...evidence(input.sector),
          ...evidence(input.beneficiaryCategory),
          ...evidence(input.areaClassification),
        ],
      ),
      trace(
        "CMEGP.CONTRIBUTION",
        contributionRate ?? "INSUFFICIENT_INFORMATION",
        "CMEGP_BASE_CONTRIBUTION_RULE_RETAINED_BY_2025_GR",
        evidence(input.beneficiaryCategory),
        true,
      ),
      ...costLines.map((line) => line.trace),
      {
        ruleId: "CMEGP.RELEASE-AND-ADJUSTMENT",
        result: "THREE_YEAR_BACK_ENDED_ADJUSTMENT",
        explanationCode: "CMEGP_CURRENT_VERIFICATION_AND_ADJUSTMENT_FLOW",
        sourceReferences: [
          cmegpMay2025AmendmentSource,
          cmegpOctober2025VerificationSource,
        ],
        evidenceSources: [],
      },
    ],
  });
}
