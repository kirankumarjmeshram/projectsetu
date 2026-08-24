import type { Assumption } from "../../../shared/assumptions";
import type { CalculationResult } from "../../../shared/calculation";
import type { SourceReference } from "../../../shared/provenance";
import type {
  DecimalValue,
  Identifier,
  ISODate,
  MonetaryAmount,
  Percentage,
} from "../../../shared/types";
import type {
  ProgramEligibilityStatus,
  ProgramEvaluationSnapshot,
} from "../../program";
import type { RuleSourceReference } from "../../provenance";

export type CmegpSector = "MANUFACTURING" | "SERVICE" | "AGRI_ALLIED";
export type CmegpBeneficiaryCategory = "GENERAL" | "SPECIAL";
export type CmegpAreaClassification = "URBAN" | "RURAL";
export type CmegpEntityType = "INDIVIDUAL" | "PARTNERSHIP" | "APPROVED_SHG";
export type CmegpActivityClassification =
  | "MANUFACTURING"
  | "SERVICE"
  | "AGRI_ALLIED"
  | "AGRI_BASED"
  | "E_MOBILITY"
  | "BRANDED_CHAIN_OUTLET"
  | "MOBILE_SALES_OR_FOOD_OUTLET"
  | "POULTRY_OR_HATCHERY"
  | "BEEKEEPING"
  | "FISHERIES"
  | "SERICULTURE"
  | "HOTEL_OR_DHABA"
  | "HOMESTAY"
  | "CLOUD_KITCHEN"
  | "WATER_SPORTS_OR_PASSENGER_BOAT"
  | "STATE_NEGATIVE_LIST_ACTIVITY"
  | "UNVERIFIED";
export type CmegpCostTag =
  | "BUILDING"
  | "MACHINERY_EQUIPMENT"
  | "WORKING_CAPITAL"
  | "LAND"
  | "RENTAL_OR_LEASE"
  | "VEHICLE"
  | "OTHER";

export interface CmegpCostItem {
  readonly costItemId: Identifier;
  readonly description: string;
  readonly amount: MonetaryAmount;
  readonly tag: CmegpCostTag;
  readonly sourceReferences: readonly SourceReference[];
}

export interface CmegpEvaluationInput {
  readonly projectId: Identifier;
  readonly evaluationAsOfDate: ISODate;
  readonly projectState?: Assumption<string>;
  readonly sector?: Assumption<CmegpSector>;
  readonly beneficiaryCategory?: Assumption<CmegpBeneficiaryCategory>;
  readonly areaClassification?: Assumption<CmegpAreaClassification>;
  readonly entityType?: Assumption<CmegpEntityType>;
  readonly applicantAgeYears?: Assumption<DecimalValue>;
  readonly activityClassification?: Assumption<CmegpActivityClassification>;
  readonly hasPriorGovernmentSubsidyBenefit?: Assumption<boolean>;
  readonly actualBeneficiaryContribution?: Assumption<MonetaryAmount>;
  readonly costItems: readonly CmegpCostItem[];
}

export interface CmegpRuleTrace {
  readonly ruleId: Identifier;
  readonly result: string;
  readonly explanationCode: string;
  readonly sourceReferences: readonly RuleSourceReference[];
  readonly evidenceSources: readonly SourceReference[];
}

export interface CmegpCostLineResult {
  readonly costItem: CmegpCostItem;
  readonly status: "ELIGIBLE" | "PARTIALLY_ELIGIBLE" | "MANUAL_REVIEW_REQUIRED";
  readonly eligibleAmount: MonetaryAmount;
  readonly excludedAmount: MonetaryAmount;
  readonly trace: CmegpRuleTrace;
}

export interface CmegpEvaluationResult {
  readonly snapshot: ProgramEvaluationSnapshot;
  readonly jurisdiction: "MAHARASHTRA" | "OTHER" | "UNKNOWN";
  readonly component: "NEW_ENTERPRISE";
  readonly actualProjectCost: MonetaryAmount;
  readonly eligibleProjectCost: MonetaryAmount;
  readonly admissibleProjectCost: MonetaryAmount;
  readonly projectCeiling?: MonetaryAmount;
  readonly excludedCosts: MonetaryAmount;
  readonly beneficiaryCategory?: CmegpBeneficiaryCategory;
  readonly areaClassification?: CmegpAreaClassification;
  readonly requiredContribution: MonetaryAmount;
  readonly actualContribution?: MonetaryAmount;
  readonly contributionShortfall: MonetaryAmount;
  readonly subsidyRate?: Percentage;
  readonly rawSubsidy: MonetaryAmount;
  readonly subsidyCap?: MonetaryAmount;
  readonly calculatedEligibleSubsidy: MonetaryAmount;
  readonly expectedBankFinance: MonetaryAmount;
  readonly releaseMetadata: {
    readonly creditLinked: true;
    readonly immediateBeneficiaryCash: false;
    readonly holdingPeriodYears: DecimalValue;
    readonly physicalVerificationAfterYears: DecimalValue;
    readonly adjustmentAfterYears: DecimalValue;
    readonly conditions: readonly string[];
  };
  readonly eligibilityStatus: ProgramEligibilityStatus;
  readonly manualReviewItems: readonly string[];
  readonly costLines: readonly CmegpCostLineResult[];
  readonly ruleTraces: readonly CmegpRuleTrace[];
}

export type CmegpCalculationResult = CalculationResult<CmegpEvaluationResult>;
