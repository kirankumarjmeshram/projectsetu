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

export type NlmActivity =
  | "RURAL_POULTRY"
  | "SHEEP_GOAT"
  | "PIGGERY"
  | "FEED_FODDER"
  | "FODDER_SEED_PROCESSING"
  | "HORSE"
  | "DONKEY"
  | "CAMEL";

export type NlmEntityType =
  | "INDIVIDUAL"
  | "SHG"
  | "FPO"
  | "FCO"
  | "JLG"
  | "SECTION_8_COMPANY"
  | "PRIVATE_COMPANY"
  | "COOPERATIVE_SOCIETY";

export type NlmFinanceMode = "BANK_OR_FI" | "SELF_FINANCE";

export type NlmCostTag =
  | "SHED_HOUSING"
  | "BREEDING_STOCK"
  | "BREEDING_STOCK_TRANSPORT"
  | "BREEDING_STOCK_INSURANCE"
  | "MACHINERY_EQUIPMENT"
  | "HATCHERY_INFRASTRUCTURE"
  | "BROODER_INFRASTRUCTURE"
  | "PROCESSING_INFRASTRUCTURE"
  | "STORAGE_INFRASTRUCTURE"
  | "FODDER_CULTIVATION"
  | "LAND_PURCHASE"
  | "LAND_RENT"
  | "LAND_LEASE"
  | "WORKING_CAPITAL"
  | "PERSONAL_VEHICLE"
  | "OFFICE_ACCOMMODATION"
  | "OTHER";

export interface NlmCostItem {
  readonly costItemId: Identifier;
  readonly description: string;
  readonly amount: MonetaryAmount;
  readonly tag: NlmCostTag;
  readonly sourceReferences: readonly SourceReference[];
}

export interface NlmEvaluationInput {
  readonly projectId: Identifier;
  readonly evaluationAsOfDate: ISODate;
  readonly activity?: Assumption<NlmActivity>;
  readonly entityType?: Assumption<NlmEntityType>;
  readonly financeMode?: Assumption<NlmFinanceMode>;
  readonly femaleAnimals?: Assumption<DecimalValue>;
  readonly maleAnimals?: Assumption<DecimalValue>;
  readonly isPastoralCamelUnit?: Assumption<boolean>;
  readonly costItems: readonly NlmCostItem[];
}

export interface NlmRuleTrace {
  readonly ruleId: Identifier;
  readonly result: string;
  readonly explanationCode: string;
  readonly sourceReferences: readonly RuleSourceReference[];
  readonly evidenceSources: readonly SourceReference[];
}

export interface NlmCostLineResult {
  readonly costItem: NlmCostItem;
  readonly status: "ELIGIBLE" | "INELIGIBLE" | "MANUAL_REVIEW_REQUIRED";
  readonly eligibleAmount: MonetaryAmount;
  readonly excludedAmount: MonetaryAmount;
  readonly trace: NlmRuleTrace;
}

export interface NlmUnitResolution {
  readonly configuredUnitSize?: {
    readonly female: DecimalValue;
    readonly male: DecimalValue;
  };
  readonly actualUnitSize?: {
    readonly female: DecimalValue;
    readonly male: DecimalValue;
  };
  readonly applicableSubsidyCap?: MonetaryAmount;
  readonly capacityCompliance:
    | "NOT_APPLICABLE"
    | "MEETS_CONFIGURED_SIZE"
    | "BELOW_MINIMUM"
    | "UNCONFIGURED_SIZE"
    | "INSUFFICIENT_INFORMATION";
  readonly trace: NlmRuleTrace;
}

export interface NlmInstallmentMetadata {
  readonly installmentCount: 2;
  readonly installmentPercentages: readonly [Percentage, Percentage];
  readonly releaseTriggers: readonly string[];
  readonly verificationConditions: readonly string[];
  readonly sourceReferences: readonly RuleSourceReference[];
}

export interface NlmEvaluationResult {
  readonly snapshot: ProgramEvaluationSnapshot;
  readonly activity?: NlmActivity;
  readonly entityType?: NlmEntityType;
  readonly actualProjectCost: MonetaryAmount;
  readonly eligibleCapitalCost: MonetaryAmount;
  readonly excludedCost: MonetaryAmount;
  readonly subsidyRate: Percentage;
  readonly rawSubsidy: MonetaryAmount;
  readonly activityCap?: MonetaryAmount;
  readonly calculatedEligibleSubsidy: MonetaryAmount;
  readonly remainingFundingRequirement: MonetaryAmount;
  readonly unitResolution: NlmUnitResolution;
  readonly financeModeConstraints: {
    readonly bankFinanceAllowed: true;
    readonly selfFinanceAllowed: true;
    readonly selectedMode?: NlmFinanceMode;
    readonly conditions: readonly string[];
  };
  readonly installmentMetadata: NlmInstallmentMetadata;
  readonly eligibilityStatus: ProgramEligibilityStatus;
  readonly manualReviewItems: readonly string[];
  readonly costLines: readonly NlmCostLineResult[];
  readonly ruleTraces: readonly NlmRuleTrace[];
}

export type NlmCalculationResult = CalculationResult<NlmEvaluationResult>;
