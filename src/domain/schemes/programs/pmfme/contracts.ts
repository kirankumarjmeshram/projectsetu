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

export type PmfmeComponent =
  | "INDIVIDUAL_UNIT"
  | "GROUP_CAPITAL_SUPPORT"
  | "COMMON_INFRASTRUCTURE"
  | "SHG_SEED_CAPITAL";

export type PmfmeEntityType =
  | "INDIVIDUAL"
  | "PROPRIETORSHIP"
  | "PARTNERSHIP"
  | "FPO"
  | "FPC"
  | "NGO"
  | "COOPERATIVE"
  | "SHG"
  | "SHG_FEDERATION"
  | "PRIVATE_LIMITED_COMPANY"
  | "GOVERNMENT_AGENCY";

export type PmfmeProjectType = "NEW" | "EXISTING_UPGRADATION";
export type PmfmeOdopStatus = "ODOP_MATCH" | "NON_ODOP_ALLOWED";

export type PmfmeActivityClassification =
  | "ELIGIBLE_FOOD_PROCESSING"
  | "TRADING_UNPROCESSED_MILLETS_CEREALS_SPICES"
  | "UNPROCESSED_OR_LOOSE_MILK"
  | "TRADING_FRUITS_VEGETABLES"
  | "TRADING_UNPROCESSED_MINOR_FOREST_PRODUCT"
  | "BEEKEEPING_OR_LOOSE_HONEY"
  | "LOOSE_OIL_TRADING_OR_REPACKING"
  | "TRADING_GROUNDNUT_OR_ARECANUT"
  | "ANIMAL_REARING"
  | "TRADING_FRESH_FISH_MEAT_CHICKEN"
  | "REPACKING_MANUFACTURED_PRODUCTS"
  | "FOOD_SERVICE_ENTERPRISE"
  | "UNVERIFIED_ACTIVITY";

export type PmfmeCostTag =
  | "PLANT_AND_MACHINERY"
  | "TECHNICAL_CIVIL_WORK"
  | "LAND"
  | "RENTAL_WORKSHED"
  | "LEASE_WORKSHED"
  | "WORKING_CAPITAL"
  | "OTHER";

export interface PmfmeCostItem {
  readonly costItemId: Identifier;
  readonly description: string;
  readonly amount: MonetaryAmount;
  readonly tag: PmfmeCostTag;
  readonly sourceReferences: readonly SourceReference[];
}

export interface PmfmeEvaluationInput {
  readonly projectId: Identifier;
  readonly evaluationAsOfDate: ISODate;
  readonly component?: Assumption<PmfmeComponent>;
  readonly entityType?: Assumption<PmfmeEntityType>;
  readonly projectType?: Assumption<PmfmeProjectType>;
  readonly odopStatus?: Assumption<PmfmeOdopStatus>;
  readonly activityClassification?: Assumption<PmfmeActivityClassification>;
  readonly actualBeneficiaryContribution?: Assumption<MonetaryAmount>;
  readonly foodProcessingShgMembers?: Assumption<DecimalValue>;
  readonly costItems: readonly PmfmeCostItem[];
}

export interface PmfmeRuleTrace {
  readonly ruleId: Identifier;
  readonly result: string;
  readonly explanationCode: string;
  readonly sourceReferences: readonly RuleSourceReference[];
  readonly evidenceSources: readonly SourceReference[];
}

export interface PmfmeCostLineResult {
  readonly costItem: PmfmeCostItem;
  readonly status: "ELIGIBLE" | "PARTIALLY_ELIGIBLE" | "INELIGIBLE";
  readonly eligibleAmount: MonetaryAmount;
  readonly excludedAmount: MonetaryAmount;
  readonly trace: PmfmeRuleTrace;
}

export interface PmfmeEvaluationResult {
  readonly snapshot: ProgramEvaluationSnapshot;
  readonly component?: PmfmeComponent;
  readonly actualProjectCost: MonetaryAmount;
  readonly eligibleProjectCost: MonetaryAmount;
  readonly eligiblePlantMachinery: MonetaryAmount;
  readonly actualTechnicalCivilWork: MonetaryAmount;
  readonly maximumEligibleTechnicalCivilWork: MonetaryAmount;
  readonly eligibleTechnicalCivilWork: MonetaryAmount;
  readonly excessTechnicalCivilWork: MonetaryAmount;
  readonly excludedCosts: MonetaryAmount;
  readonly requiredBeneficiaryContribution: MonetaryAmount;
  readonly actualBeneficiaryContribution?: MonetaryAmount;
  readonly contributionShortfall: MonetaryAmount;
  readonly bankFinanceRequirement: MonetaryAmount;
  readonly subsidyRate?: Percentage;
  readonly rawSubsidy: MonetaryAmount;
  readonly subsidyCap?: MonetaryAmount;
  readonly calculatedEligibleSubsidy: MonetaryAmount;
  readonly calculatedSeedCapital: MonetaryAmount;
  readonly odopStatus?: PmfmeOdopStatus;
  readonly eligibilityStatus: ProgramEligibilityStatus;
  readonly manualReviewItems: readonly string[];
  readonly convergenceMetadata: readonly string[];
  readonly costLines: readonly PmfmeCostLineResult[];
  readonly ruleTraces: readonly PmfmeRuleTrace[];
}

export type PmfmeCalculationResult = CalculationResult<PmfmeEvaluationResult>;
