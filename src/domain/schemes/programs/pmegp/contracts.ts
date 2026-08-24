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
  RuleEvaluationResult,
  SchemeCostItem,
} from "../../program";
import type { RuleSourceReference } from "../../provenance";

export type PmegpSector = "MANUFACTURING" | "SERVICE" | "BUSINESS_TRADING";

export type PmegpProjectType =
  "NEW_ENTERPRISE" | "EXISTING_ENTERPRISE" | "EXPANSION" | "MODERNIZATION";

export type PmegpApplicantEntityType =
  | "INDIVIDUAL"
  | "SELF_HELP_GROUP"
  | "REGISTERED_INSTITUTION"
  | "PRODUCTION_COOPERATIVE"
  | "CHARITABLE_TRUST";

export type PmegpApplicantSpecialCategory =
  | "SC"
  | "ST"
  | "OBC"
  | "MINORITY"
  | "WOMAN"
  | "EX_SERVICEMAN"
  | "TRANSGENDER"
  | "DIFFERENTLY_ABLED";

export type PmegpNewEnterpriseSpecialArea =
  "NER" | "ASPIRATIONAL_DISTRICT" | "HILL_AREA" | "BORDER_AREA";

export type PmegpUpgradationSpecialArea = "NER" | "HILL_STATE";

export type PmegpBeneficiaryCategory =
  "GENERAL" | "SPECIAL" | "INSUFFICIENT_INFORMATION" | "MANUAL_REVIEW_REQUIRED";

export type PmegpAreaClassification = "URBAN" | "RURAL" | "UNKNOWN";

export type PmegpActivityClassification =
  | "STANDARD_ELIGIBLE"
  | "SLAUGHTERED_MEAT_PROCESSING"
  | "NON_VEGETARIAN_HOTEL_OR_DHABA"
  | "TOBACCO_PRODUCT"
  | "LIQUOR_OR_INTOXICANT_ACTIVITY"
  | "TODDY_FOR_SALE"
  | "RESTRICTED_PLASTIC_OR_ENVIRONMENT_DEPENDENT"
  | "CROP_CULTIVATION_OR_PLANTATION"
  | "AGRICULTURAL_VALUE_ADDITION"
  | "OFF_FARM_OR_FARM_LINKED_ACTIVITY"
  | "DAIRY"
  | "POULTRY"
  | "AQUACULTURE"
  | "BEEKEEPING_OR_INSECT_ACTIVITY"
  | "SERICULTURE_FARM_LINKED"
  | "PIGGERY"
  | "KHADI_VILLAGE_INDUSTRY_RETAIL"
  | "PMEGP_SFURTI_PRODUCT_RETAIL"
  | "MANUFACTURING_BACKED_RETAIL"
  | "GENERAL_RETAIL"
  | "OTHER_TRADING"
  | "INDIVIDUAL_TRANSPORT";

export type PmegpActivityEligibilityStatus =
  | "ALLOWED"
  | "PROHIBITED"
  | "ALLOWED_WITH_CONDITIONS"
  | "MANUAL_REVIEW_REQUIRED";

export type PmegpPortfolioConstraintStatus =
  "NOT_APPLICABLE" | "SATISFIED" | "UNSATISFIED" | "MANUAL_REVIEW_REQUIRED";

export interface PmegpApplicantFacts {
  readonly entityType?: Assumption<PmegpApplicantEntityType>;
  readonly ageYears?: Assumption<DecimalValue>;
  readonly educationStandardPassed?: Assumption<DecimalValue>;
  readonly hasPreviouslyAvailedGovernmentSubsidy?: Assumption<boolean>;
  readonly existingUnitAssistedUnderGovernmentScheme?: Assumption<boolean>;
  readonly familyHasExistingPmegpBeneficiary?: Assumption<boolean>;
  /** An explicit complete list. An empty source-backed list means no applicant special category. */
  readonly specialCategories?: Assumption<
    readonly PmegpApplicantSpecialCategory[]
  >;
}

export interface PmegpProjectFacts {
  readonly projectType?: Assumption<PmegpProjectType>;
  readonly sector?: Assumption<PmegpSector>;
}

export interface PmegpLocationFacts {
  readonly areaClassification?: Assumption<
    Exclude<PmegpAreaClassification, "UNKNOWN">
  >;
  /** An explicit complete list. An empty source-backed list means no new-enterprise special area. */
  readonly newEnterpriseSpecialAreas?: Assumption<
    readonly PmegpNewEnterpriseSpecialArea[]
  >;
  /** An explicit complete list for the independent upgradation rate resolver. */
  readonly upgradationSpecialAreas?: Assumption<
    readonly PmegpUpgradationSpecialArea[]
  >;
  readonly generalTradingPermittedArea?: Assumption<boolean>;
  readonly transportPortfolioCapExemptArea?: Assumption<boolean>;
  readonly isNer?: Assumption<boolean>;
}

export interface PmegpActivityFacts {
  readonly classification?: Assumption<PmegpActivityClassification>;
  readonly isProhibitedByLocalAuthority?: Assumption<boolean>;
  /** Optional external portfolio evidence; it never becomes applicant-level eligibility. */
  readonly portfolioQuotaStatus?: Assumption<"AVAILABLE" | "UNAVAILABLE">;
}

export type PmegpPriorProgram = "PMEGP" | "REGP" | "MUDRA";

export interface PmegpUpgradationHistoryFacts {
  readonly priorProgram?: Assumption<PmegpPriorProgram>;
  readonly priorMarginMoneyAdjusted?: Assumption<boolean>;
  readonly firstLoanRepaidOnTime?: Assumption<boolean>;
  readonly profitableYears?: Assumption<DecimalValue>;
  readonly hasGoodTurnover?: Assumption<boolean>;
  readonly hasGrowthPotential?: Assumption<boolean>;
  readonly udyamRegistered?: Assumption<boolean>;
}

export interface PmegpCostItem extends SchemeCostItem {
  /** Required for ready-built/rented/leased workshed items. */
  readonly annualAmount?: Assumption<MonetaryAmount>;
  /** Required for ready-built/rented/leased workshed items. */
  readonly durationYears?: Assumption<DecimalValue>;
}

export interface PmegpNewEnterpriseEvaluationInput {
  readonly projectId: Identifier;
  readonly evaluationAsOfDate: ISODate;
  readonly applicant: PmegpApplicantFacts;
  readonly project: PmegpProjectFacts;
  readonly location: PmegpLocationFacts;
  readonly activity: PmegpActivityFacts;
  readonly costItems: readonly PmegpCostItem[];
  readonly actualBeneficiaryContribution?: Assumption<MonetaryAmount>;
  readonly actualBankFinance?: Assumption<MonetaryAmount>;
}

export interface PmegpUpgradationEvaluationInput {
  readonly projectId: Identifier;
  readonly evaluationAsOfDate: ISODate;
  readonly project: Pick<PmegpProjectFacts, "sector">;
  readonly location: Pick<PmegpLocationFacts, "upgradationSpecialAreas">;
  readonly activity: PmegpActivityFacts;
  readonly history: PmegpUpgradationHistoryFacts;
  readonly costItems: readonly PmegpCostItem[];
  readonly actualBeneficiaryContribution?: Assumption<MonetaryAmount>;
  readonly actualBankFinance?: Assumption<MonetaryAmount>;
}

export interface PmegpResolverTrace {
  readonly ruleId: Identifier;
  readonly result: string;
  readonly explanationCode: string;
  readonly sourceReferences: readonly RuleSourceReference[];
  readonly evidenceSources: readonly SourceReference[];
}

export interface PmegpCategoryResolution {
  readonly category: PmegpBeneficiaryCategory;
  readonly qualifyingCategories: readonly (
    PmegpApplicantSpecialCategory | PmegpNewEnterpriseSpecialArea
  )[];
  readonly traces: readonly PmegpResolverTrace[];
}

export interface PmegpAreaResolution {
  readonly classification: PmegpAreaClassification;
  readonly traces: readonly PmegpResolverTrace[];
}

export interface PmegpActivityEligibilityResult {
  readonly status: PmegpActivityEligibilityStatus;
  readonly portfolioConstraintStatus: PmegpPortfolioConstraintStatus;
  readonly manualReviewItems: readonly string[];
  readonly traces: readonly PmegpResolverTrace[];
}

export interface PmegpCostRuleTrace {
  readonly ruleId: Identifier;
  readonly status: "PASS" | "EXCLUDED" | "CAPPED";
  readonly amountBefore: MonetaryAmount;
  readonly amountAfter: MonetaryAmount;
  readonly sourceReferences: readonly RuleSourceReference[];
}

export interface PmegpCostLineResult {
  readonly costItem: PmegpCostItem;
  readonly status: "ELIGIBLE" | "PARTIALLY_ELIGIBLE" | "INELIGIBLE";
  readonly eligibleAmount: MonetaryAmount;
  readonly ineligibleAmount: MonetaryAmount;
  readonly ruleTraces: readonly PmegpCostRuleTrace[];
}

export interface PmegpWorkingCapitalResult {
  readonly actualWorkingCapital: MonetaryAmount;
  readonly maximumPmegpEligibleWorkingCapital: MonetaryAmount;
  readonly eligibleWorkingCapital: MonetaryAmount;
  readonly excessWorkingCapital: MonetaryAmount;
  readonly capPercentage: Percentage;
  readonly complianceResult: "WITHIN_LIMIT" | "AT_LIMIT" | "EXCEEDS_LIMIT";
  readonly sourceReferences: readonly RuleSourceReference[];
}

export interface PmegpNewEnterpriseCostResult {
  readonly actualProjectCost: MonetaryAmount;
  readonly pmegpFinanceableProjectCost: MonetaryAmount;
  readonly pmegpAdmissibleProjectCost: MonetaryAmount;
  readonly excessProjectCostOutsideSubsidy: MonetaryAmount;
  readonly eligibleCapitalExpenditure: MonetaryAmount;
  readonly excludedCost: MonetaryAmount;
  readonly projectCostCeiling: MonetaryAmount;
  readonly workingCapital: PmegpWorkingCapitalResult;
  readonly lines: readonly PmegpCostLineResult[];
  readonly sourceReferences: readonly RuleSourceReference[];
}

export interface PmegpUpgradationCostResult {
  readonly actualProjectCost: MonetaryAmount;
  readonly pmegpAdmissibleProjectCost: MonetaryAmount;
  readonly excessProjectCostOutsideSubsidy: MonetaryAmount;
  readonly projectCostCeiling: MonetaryAmount;
  readonly sourceReferences: readonly RuleSourceReference[];
}

export interface PmegpContributionResult {
  readonly requiredContribution?: MonetaryAmount;
  readonly actualContribution?: MonetaryAmount;
  readonly shortfall?: MonetaryAmount;
  readonly contributionPercentage?: Percentage;
  readonly complianceResult:
    "MEETS_REQUIREMENT" | "BELOW_REQUIREMENT" | "INSUFFICIENT_INFORMATION";
  readonly sourceReferences: readonly RuleSourceReference[];
}

export interface PmegpBankFinanceConstraint {
  readonly basisProjectCost: MonetaryAmount;
  readonly bankFinancePercentage?: Percentage;
  readonly expectedBankFinance?: MonetaryAmount;
  readonly actualBankFinance?: MonetaryAmount;
  readonly complianceResult:
    | "MATCHES_EXPECTED"
    | "BELOW_EXPECTED"
    | "ABOVE_EXPECTED"
    | "INSUFFICIENT_INFORMATION";
  readonly sourceReferences: readonly RuleSourceReference[];
}

export interface PmegpMarginMoneyTrace {
  readonly actualProjectCost: MonetaryAmount;
  readonly admissibleProjectCost: MonetaryAmount;
  readonly beneficiaryCategory: "GENERAL" | "SPECIAL";
  readonly areaClassification?: "URBAN" | "RURAL";
  readonly rate: Percentage;
  readonly rawMarginMoney: MonetaryAmount;
  readonly cap?: MonetaryAmount;
  readonly finalCalculatedEligibleMarginMoney: MonetaryAmount;
  readonly sourceReferences: readonly RuleSourceReference[];
}

export interface PmegpMarginMoneyResult {
  readonly status:
    "CALCULATED" | "INSUFFICIENT_INFORMATION" | "MANUAL_REVIEW_REQUIRED";
  readonly applicableRate?: Percentage;
  readonly calculatedEligibleMarginMoney?: MonetaryAmount;
  readonly trace?: PmegpMarginMoneyTrace;
}

export interface PmegpReleaseLifecycle {
  readonly creditLinked: true;
  readonly immediateBeneficiaryCash: false;
  readonly releaseRecipient: "FINANCING_BANK";
  readonly holdingMechanism: "TDR_SRF";
  readonly lockInPeriodYears: DecimalValue;
  readonly stages: readonly (
    | "ELIGIBLE"
    | "CLAIMED"
    | "RECEIVED_BY_BANK"
    | "LOCKED"
    | "VERIFIED"
    | "ADJUSTED"
  )[];
  readonly claimConditions: readonly string[];
  readonly adjustmentConditions: readonly string[];
  readonly shortfallReconciliationMetadata: readonly string[];
  readonly sourceReferences: readonly RuleSourceReference[];
}

export interface PmegpNormalizedSummary {
  readonly snapshot: ProgramEvaluationSnapshot;
  readonly actualProjectCost: MonetaryAmount;
  readonly pmegpAdmissibleProjectCost: MonetaryAmount;
  readonly eligibleCapitalExpenditure: MonetaryAmount;
  readonly eligibleWorkingCapital: MonetaryAmount;
  readonly excludedCost: MonetaryAmount;
  readonly beneficiaryCategory: PmegpBeneficiaryCategory | "NOT_APPLICABLE";
  readonly areaClassification: PmegpAreaClassification | "NOT_APPLICABLE";
  readonly requiredBeneficiaryContribution?: MonetaryAmount;
  readonly actualBeneficiaryContribution?: MonetaryAmount;
  readonly contributionShortfall?: MonetaryAmount;
  readonly applicableMarginMoneyRate?: Percentage;
  readonly calculatedEligibleMarginMoney?: MonetaryAmount;
  readonly expectedBankFinanceConstraint?: PmegpBankFinanceConstraint;
  readonly eligibilityStatus: ProgramEligibilityStatus;
  readonly manualReviewItems: readonly string[];
  readonly ruleTraces: readonly (
    RuleEvaluationResult | PmegpResolverTrace | PmegpCostRuleTrace
  )[];
  readonly releaseLifecycle: PmegpReleaseLifecycle;
}

export interface PmegpNewEnterpriseEvaluationResult {
  readonly summary: PmegpNormalizedSummary;
  readonly categoryResolution: PmegpCategoryResolution;
  readonly areaResolution: PmegpAreaResolution;
  readonly activityEligibility: PmegpActivityEligibilityResult;
  readonly costEligibility: PmegpNewEnterpriseCostResult;
  readonly contribution: PmegpContributionResult;
  readonly marginMoney: PmegpMarginMoneyResult;
}

export interface PmegpUpgradationEvaluationResult {
  readonly summary: PmegpNormalizedSummary;
  readonly activityEligibility: PmegpActivityEligibilityResult;
  readonly costEligibility: PmegpUpgradationCostResult;
  readonly contribution: PmegpContributionResult;
  readonly marginMoney: PmegpMarginMoneyResult;
}

export type PmegpNewEnterpriseCalculationResult =
  CalculationResult<PmegpNewEnterpriseEvaluationResult>;
export type PmegpUpgradationCalculationResult =
  CalculationResult<PmegpUpgradationEvaluationResult>;
