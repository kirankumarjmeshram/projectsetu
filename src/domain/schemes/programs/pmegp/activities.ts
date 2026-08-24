import type {
  PmegpActivityEligibilityResult,
  PmegpActivityFacts,
  PmegpLocationFacts,
  PmegpResolverTrace,
} from "./contracts";
import { pmegpNegativeListSource, pmegpNewEligibilitySource } from "./sources";

function trace(
  result: string,
  explanationCode: string,
  evidenceSources: PmegpResolverTrace["evidenceSources"],
): PmegpResolverTrace {
  return {
    ruleId: "PMEGP.ACTIVITY.RESOLUTION",
    result,
    explanationCode,
    sourceReferences: [pmegpNegativeListSource, pmegpNewEligibilitySource],
    evidenceSources,
  };
}

function result(
  status: PmegpActivityEligibilityResult["status"],
  portfolioConstraintStatus: PmegpActivityEligibilityResult["portfolioConstraintStatus"],
  explanationCode: string,
  evidenceSources: PmegpResolverTrace["evidenceSources"],
  manualReviewItems: readonly string[] = [],
): PmegpActivityEligibilityResult {
  return {
    status,
    portfolioConstraintStatus,
    manualReviewItems,
    traces: [trace(status, explanationCode, evidenceSources)],
  };
}

function tradingResult(
  activity: PmegpActivityFacts,
  evidenceSources: PmegpResolverTrace["evidenceSources"],
): PmegpActivityEligibilityResult {
  const quota = activity.portfolioQuotaStatus;
  if (!quota) {
    return result(
      "ALLOWED_WITH_CONDITIONS",
      "MANUAL_REVIEW_REQUIRED",
      "PMEGP_TRADING_ALLOWED_SUBJECT_TO_STATE_PORTFOLIO_CEILING",
      evidenceSources,
      ["PMEGP_TRADING_PORTFOLIO_QUOTA_REQUIRES_CURRENT_EVIDENCE"],
    );
  }
  return result(
    "ALLOWED_WITH_CONDITIONS",
    quota.value === "AVAILABLE" ? "SATISFIED" : "UNSATISFIED",
    "PMEGP_TRADING_ACTIVITY_SUBJECT_TO_PORTFOLIO_CEILING",
    [...evidenceSources, quota.source],
    quota.value === "UNAVAILABLE"
      ? ["PMEGP_TRADING_PORTFOLIO_CONSTRAINT_NOT_SATISFIED"]
      : [],
  );
}

export function evaluatePmegpActivityEligibility(input: {
  readonly activity: PmegpActivityFacts;
  readonly location: PmegpLocationFacts;
}): PmegpActivityEligibilityResult {
  const localAuthority = input.activity.isProhibitedByLocalAuthority;
  if (!localAuthority) {
    return result(
      "MANUAL_REVIEW_REQUIRED",
      "NOT_APPLICABLE",
      "PMEGP_LOCAL_AUTHORITY_STATUS_MISSING",
      [],
      ["PMEGP_LOCAL_AUTHORITY_REVIEW_REQUIRED"],
    );
  }
  if (localAuthority.value) {
    return result(
      "PROHIBITED",
      "NOT_APPLICABLE",
      "PMEGP_ACTIVITY_PROHIBITED_BY_LOCAL_AUTHORITY",
      [localAuthority.source],
    );
  }

  const activity = input.activity.classification;
  if (!activity) {
    return result(
      "MANUAL_REVIEW_REQUIRED",
      "NOT_APPLICABLE",
      "PMEGP_ACTIVITY_CLASSIFICATION_MISSING",
      [localAuthority.source],
      ["PMEGP_ACTIVITY_CLASSIFICATION_REVIEW_REQUIRED"],
    );
  }
  const evidence = [localAuthority.source, activity.source];
  switch (activity.value) {
    case "SLAUGHTERED_MEAT_PROCESSING":
    case "TOBACCO_PRODUCT":
    case "LIQUOR_OR_INTOXICANT_ACTIVITY":
    case "TODDY_FOR_SALE":
    case "CROP_CULTIVATION_OR_PLANTATION":
      return result(
        "PROHIBITED",
        "NOT_APPLICABLE",
        "PMEGP_ACTIVITY_IN_REVISED_NEGATIVE_LIST",
        evidence,
      );
    case "RESTRICTED_PLASTIC_OR_ENVIRONMENT_DEPENDENT":
      return result(
        "MANUAL_REVIEW_REQUIRED",
        "NOT_APPLICABLE",
        "PMEGP_ENVIRONMENTAL_RULE_DEPENDS_ON_CURRENT_EXTERNAL_REGULATION",
        evidence,
        ["PMEGP_ENVIRONMENTAL_COMPLIANCE_REVIEW_REQUIRED"],
      );
    case "NON_VEGETARIAN_HOTEL_OR_DHABA":
    case "AGRICULTURAL_VALUE_ADDITION":
    case "OFF_FARM_OR_FARM_LINKED_ACTIVITY":
    case "DAIRY":
    case "POULTRY":
    case "AQUACULTURE":
    case "BEEKEEPING_OR_INSECT_ACTIVITY":
    case "SERICULTURE_FARM_LINKED":
    case "STANDARD_ELIGIBLE":
      return result(
        "ALLOWED",
        "NOT_APPLICABLE",
        "PMEGP_ACTIVITY_ALLOWED_BY_REVISED_GUIDELINE",
        evidence,
      );
    case "PIGGERY":
      if (!input.location.isNer) {
        return result(
          "MANUAL_REVIEW_REQUIRED",
          "NOT_APPLICABLE",
          "PMEGP_PIGGERY_NER_STATUS_MISSING",
          evidence,
          ["PMEGP_PIGGERY_LOCATION_REVIEW_REQUIRED"],
        );
      }
      return result(
        input.location.isNer.value ? "ALLOWED_WITH_CONDITIONS" : "PROHIBITED",
        "NOT_APPLICABLE",
        input.location.isNer.value
          ? "PMEGP_PIGGERY_ALLOWED_AS_NER_SPECIAL_CASE"
          : "PMEGP_PIGGERY_OUTSIDE_NER_NOT_ALLOWED",
        [...evidence, input.location.isNer.source],
      );
    case "KHADI_VILLAGE_INDUSTRY_RETAIL":
    case "PMEGP_SFURTI_PRODUCT_RETAIL":
    case "MANUFACTURING_BACKED_RETAIL":
      return tradingResult(input.activity, evidence);
    case "GENERAL_RETAIL":
      if (!input.location.generalTradingPermittedArea) {
        return result(
          "MANUAL_REVIEW_REQUIRED",
          "MANUAL_REVIEW_REQUIRED",
          "PMEGP_GENERAL_TRADING_LOCATION_EVIDENCE_MISSING",
          evidence,
          ["PMEGP_GENERAL_TRADING_LOCATION_REVIEW_REQUIRED"],
        );
      }
      if (!input.location.generalTradingPermittedArea.value) {
        return result(
          "PROHIBITED",
          "NOT_APPLICABLE",
          "PMEGP_GENERAL_RETAIL_NOT_IN_PERMITTED_AREA",
          [...evidence, input.location.generalTradingPermittedArea.source],
        );
      }
      return tradingResult(input.activity, [
        ...evidence,
        input.location.generalTradingPermittedArea.source,
      ]);
    case "OTHER_TRADING":
      return result(
        "MANUAL_REVIEW_REQUIRED",
        "MANUAL_REVIEW_REQUIRED",
        "PMEGP_OTHER_TRADING_REQUIRES_CLASSIFICATION_AND_PORTFOLIO_REVIEW",
        evidence,
        ["PMEGP_OTHER_TRADING_REVIEW_REQUIRED"],
      );
    case "INDIVIDUAL_TRANSPORT":
      if (!input.location.transportPortfolioCapExemptArea) {
        return result(
          "ALLOWED_WITH_CONDITIONS",
          "MANUAL_REVIEW_REQUIRED",
          "PMEGP_TRANSPORT_PORTFOLIO_EXEMPTION_STATUS_MISSING",
          evidence,
          ["PMEGP_TRANSPORT_PORTFOLIO_REVIEW_REQUIRED"],
        );
      }
      if (input.location.transportPortfolioCapExemptArea.value) {
        return result(
          "ALLOWED",
          "NOT_APPLICABLE",
          "PMEGP_TRANSPORT_ALLOWED_IN_PORTFOLIO_CAP_EXEMPT_AREA",
          [...evidence, input.location.transportPortfolioCapExemptArea.source],
        );
      }
      return result(
        "ALLOWED_WITH_CONDITIONS",
        "MANUAL_REVIEW_REQUIRED",
        "PMEGP_TRANSPORT_ALLOWED_SUBJECT_TO_PORTFOLIO_CEILING",
        [...evidence, input.location.transportPortfolioCapExemptArea.source],
        ["PMEGP_TRANSPORT_PORTFOLIO_QUOTA_REQUIRES_CURRENT_EVIDENCE"],
      );
  }
}
