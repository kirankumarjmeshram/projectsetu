import {
  calculationFailure,
  calculationSuccess,
} from "../../../shared/calculation";
import { monetaryAmount, toDecimal } from "../../../shared/decimal";
import type { SourceReference } from "../../../shared/provenance";
import { programId } from "../../program";
import { resolveMudraCategory } from "./categories";
import type {
  MudraCalculationResult,
  MudraEvaluationInput,
  MudraRuleTrace,
} from "./contracts";
import {
  MUDRA_ELIGIBLE_ACTIVITIES,
  MUDRA_LENDING_INSTITUTION_CATEGORIES,
} from "./rules";
import {
  pmmyCurrentDfsSource,
  pmmyTarunPlusNotificationSource,
} from "./sources";
import { MUDRA_CURRENT_VERSION_ID } from "./version";

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
): MudraRuleTrace {
  return {
    ruleId,
    result,
    explanationCode,
    sourceReferences: [pmmyCurrentDfsSource, pmmyTarunPlusNotificationSource],
    evidenceSources,
  };
}

export function evaluateMudra(
  input: MudraEvaluationInput,
): MudraCalculationResult {
  if (input.requestedCredit) {
    try {
      if (toDecimal(monetaryAmount(input.requestedCredit.value)).isNegative()) {
        throw new Error();
      }
    } catch {
      return calculationFailure({
        code: "INVALID_MUDRA_REQUESTED_CREDIT",
        message: "Requested PMMY credit must be a non-negative decimal value.",
        path: "requestedCredit",
      });
    }
  }
  const category = input.requestedCredit
    ? resolveMudraCategory(input.requestedCredit.value)
    : undefined;
  const overLimit =
    input.requestedCredit !== undefined && category === undefined;
  const activityFails =
    input.activity !== undefined &&
    !MUDRA_ELIGIBLE_ACTIVITIES.includes(input.activity.value) &&
    input.activity.value !== "UNVERIFIED";
  const manualReviewItems: string[] = [];
  if (!input.requestedCredit)
    manualReviewItems.push("MUDRA_REQUESTED_CREDIT_REQUIRED");
  if (!input.activity) manualReviewItems.push("MUDRA_ACTIVITY_REQUIRED");
  if (!input.financingPurpose)
    manualReviewItems.push("MUDRA_FINANCING_PURPOSE_REQUIRED");
  if (input.activity?.value === "UNVERIFIED") {
    manualReviewItems.push("MUDRA_ACTIVITY_REQUIRES_MANUAL_REVIEW");
  }
  let tarunPlusFails = false;
  if (category?.category === "TARUN_PLUS") {
    if (!input.hasPriorTarunLoan) {
      manualReviewItems.push("MUDRA_TARUN_PLUS_PRIOR_TARUN_HISTORY_REQUIRED");
    } else if (!input.hasPriorTarunLoan.value) {
      tarunPlusFails = true;
    } else if (!input.priorTarunSuccessfullyRepaid) {
      manualReviewItems.push("MUDRA_TARUN_PLUS_REPAYMENT_STATUS_REQUIRED");
    } else if (!input.priorTarunSuccessfullyRepaid.value) {
      tarunPlusFails = true;
    }
  }
  const missing =
    !input.requestedCredit ||
    !input.activity ||
    !input.financingPurpose ||
    (category?.category === "TARUN_PLUS" &&
      (!input.hasPriorTarunLoan ||
        (input.hasPriorTarunLoan.value &&
          !input.priorTarunSuccessfullyRepaid)));
  const eligibilityStatus =
    overLimit || activityFails || tarunPlusFails
      ? "INELIGIBLE"
      : missing
        ? "INSUFFICIENT_INFORMATION"
        : manualReviewItems.length > 0
          ? "MANUAL_REVIEW_REQUIRED"
          : "ELIGIBLE";
  const categoryTrace = trace(
    "PMMY.CATEGORY.BOUNDARY",
    !input.requestedCredit
      ? "INSUFFICIENT_INFORMATION"
      : (category?.category ?? "ABOVE_PROGRAM_LIMIT"),
    category
      ? "PMMY_CATEGORY_RESOLVED_FROM_REQUESTED_CREDIT"
      : "PMMY_REQUEST_EXCEEDS_TARUN_PLUS_LIMIT",
    evidence(input.requestedCredit),
  );
  const tarunTrace = trace(
    "PMMY.TARUN-PLUS.PRIOR-REPAYMENT",
    category?.category !== "TARUN_PLUS"
      ? "NOT_APPLICABLE"
      : !input.hasPriorTarunLoan ||
          (input.hasPriorTarunLoan.value && !input.priorTarunSuccessfullyRepaid)
        ? "INSUFFICIENT_INFORMATION"
        : tarunPlusFails
          ? "FAIL"
          : "PASS",
    "PMMY_TARUN_PLUS_REQUIRES_PRIOR_TARUN_AVAILED_AND_SUCCESSFULLY_REPAID",
    [
      ...evidence(input.hasPriorTarunLoan),
      ...evidence(input.priorTarunSuccessfullyRepaid),
    ],
  );
  const activityTrace = trace(
    "PMMY.ACTIVITY.PURPOSE",
    !input.activity
      ? "INSUFFICIENT_INFORMATION"
      : activityFails
        ? "FAIL"
        : input.activity.value === "UNVERIFIED"
          ? "MANUAL_REVIEW_REQUIRED"
          : "PASS",
    "PMMY_INCOME_GENERATING_MICRO_ENTERPRISE_ACTIVITY_EVALUATED",
    evidence(input.activity),
  );
  return calculationSuccess({
    snapshot: {
      programId: programId("GOI.PMMY"),
      programVersionId: MUDRA_CURRENT_VERSION_ID,
      evaluationAsOfDate: input.evaluationAsOfDate,
    },
    ...(input.requestedCredit
      ? { requestedCredit: input.requestedCredit.value }
      : {}),
    ...(category
      ? {
          applicableCategory: category.category,
          categoryMinimum: category.minimum,
          categoryMaximum: category.maximum,
        }
      : {}),
    tarunPlusPriorLoanRequirement:
      category?.category === "TARUN_PLUS" ? "REQUIRED" : "NOT_APPLICABLE",
    termLoanAllowed: true,
    workingCapitalAllowed: true,
    collateralRequirementMetadata: "COLLATERAL_NOT_REQUIRED_UNDER_PROGRAM",
    lendingInstitutionCategories: MUDRA_LENDING_INSTITUTION_CATEGORIES,
    eligibilityStatus,
    manualReviewItems,
    ruleTraces: [categoryTrace, tarunTrace, activityTrace],
  });
}
