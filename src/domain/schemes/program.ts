import type { Assumption } from "../shared/assumptions";
import type { SourceReference } from "../shared/provenance";
import type {
  DecimalValue,
  Identifier,
  ISODate,
  MonetaryAmount,
  Percentage,
} from "../shared/types";
import type { RuleSourceReference } from "./provenance";

declare const programIdBrand: unique symbol;
declare const programVersionIdBrand: unique symbol;
declare const classificationTagBrand: unique symbol;

export type ProgramId = string & { readonly [programIdBrand]: "ProgramId" };
export type ProgramVersionId = string & {
  readonly [programVersionIdBrand]: "ProgramVersionId";
};
export type ClassificationTag = string & {
  readonly [classificationTagBrand]: "ClassificationTag";
};

const programIdPattern = /^[A-Z0-9][A-Z0-9._-]*\.[A-Z0-9][A-Z0-9._-]*$/;
const versionIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const tagPattern = /^[A-Z0-9][A-Z0-9._-]*$/;

export class InvalidProgramIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidProgramIdentityError";
  }
}

export function programId(value: unknown): ProgramId {
  if (typeof value !== "string" || !programIdPattern.test(value)) {
    throw new InvalidProgramIdentityError(
      "Program id must be a namespaced uppercase machine identifier.",
    );
  }
  return value as ProgramId;
}

export function programVersionId(value: unknown): ProgramVersionId {
  if (typeof value !== "string" || !versionIdPattern.test(value)) {
    throw new InvalidProgramIdentityError(
      "Program version id must be a stable machine identifier.",
    );
  }
  return value as ProgramVersionId;
}

export function classificationTag(value: unknown): ClassificationTag {
  if (typeof value !== "string" || !tagPattern.test(value)) {
    throw new InvalidProgramIdentityError(
      "Classification tag must contain uppercase letters, digits, dots, underscores, or hyphens.",
    );
  }
  return value as ClassificationTag;
}

export const programTypes = [
  "BASE_BANK_FINANCE",
  "CREDIT_PROGRAM",
  "CAPITAL_SUBSIDY",
  "MARGIN_MONEY_SUBSIDY",
  "INTEREST_SUBVENTION",
  "CREDIT_GUARANTEE",
  "GRANT",
  "REIMBURSEMENT",
  "SEED_CAPITAL",
  "COMPOSITE_ASSISTANCE",
  "CUSTOM",
] as const;
export type ProgramType = (typeof programTypes)[number];

export const programVersionStatuses = [
  "DRAFT",
  "ACTIVE",
  "SUPERSEDED",
  "RETIRED",
  "SUSPENDED",
  "ARCHIVED",
] as const;
export type ProgramVersionStatus = (typeof programVersionStatuses)[number];

export interface ProgramJurisdiction {
  readonly country: string;
  readonly states?: readonly string[];
  readonly districts?: readonly string[];
  readonly regions?: readonly string[];
  readonly areaClassifications?: readonly string[];
}

export const factGroups = [
  "applicant",
  "project",
  "enterprise",
  "location",
  "activity",
  "financing",
  "custom",
] as const;
export type FactGroup = (typeof factGroups)[number];
export type FactPath = `${FactGroup}.${string}`;
export type FactValue = string | boolean | readonly string[];
export type FactCollection = Readonly<Record<string, FactValue | undefined>>;

export interface ProgramEvaluationFacts {
  readonly applicant?: FactCollection;
  readonly project?: FactCollection;
  readonly enterprise?: FactCollection;
  readonly location?: FactCollection;
  readonly activity?: FactCollection;
  readonly financing?: FactCollection;
  readonly custom?: FactCollection;
}

export const eligibilityRuleTypes = [
  "REQUIRED",
  "EQUALS",
  "NOT_EQUALS",
  "IN",
  "NOT_IN",
  "MINIMUM",
  "MAXIMUM",
  "RANGE",
  "BOOLEAN",
  "DATE_RANGE",
  "ACTIVITY_INCLUDED",
  "ACTIVITY_EXCLUDED",
  "LOCATION",
  "ENTITY_TYPE",
  "CUSTOM_PREDICATE",
] as const;
export type EligibilityRuleType = (typeof eligibilityRuleTypes)[number];
export type EligibilityRuleOperator = "ALL" | "ANY" | "NONE";

interface EligibilityRuleBase {
  readonly ruleId: Identifier;
  readonly name: string;
  readonly description?: string;
  readonly sourceReferences: readonly RuleSourceReference[];
  readonly passAsConditional?: boolean;
}

interface FactRuleBase extends EligibilityRuleBase {
  readonly factPath: FactPath;
}

export type EligibilityRule =
  | (FactRuleBase & { readonly type: "REQUIRED" })
  | (FactRuleBase & {
      readonly type: "EQUALS" | "NOT_EQUALS";
      readonly expectedValue: string | boolean;
    })
  | (FactRuleBase & {
      readonly type: "IN" | "NOT_IN" | "LOCATION" | "ENTITY_TYPE";
      readonly expectedValues: readonly string[];
    })
  | (FactRuleBase & {
      readonly type: "MINIMUM";
      readonly minimum: DecimalValue;
    })
  | (FactRuleBase & {
      readonly type: "MAXIMUM";
      readonly maximum: DecimalValue;
    })
  | (FactRuleBase & {
      readonly type: "RANGE";
      readonly minimum: DecimalValue;
      readonly maximum: DecimalValue;
    })
  | (FactRuleBase & {
      readonly type: "BOOLEAN";
      readonly expectedValue: boolean;
    })
  | (FactRuleBase & {
      readonly type: "DATE_RANGE";
      readonly from: ISODate;
      readonly until?: ISODate;
    })
  | (FactRuleBase & {
      readonly type: "ACTIVITY_INCLUDED" | "ACTIVITY_EXCLUDED";
      readonly tags: readonly ClassificationTag[];
    })
  | (EligibilityRuleBase & {
      readonly type: "CUSTOM_PREDICATE";
      readonly predicateId: Identifier;
    });

export interface EligibilityRuleGroup {
  readonly groupId: Identifier;
  readonly operator: EligibilityRuleOperator;
  readonly rules: readonly (EligibilityRule | EligibilityRuleGroup)[];
}

export const ruleEvaluationStatuses = [
  "PASS",
  "CONDITIONAL_PASS",
  "FAIL",
  "UNKNOWN",
  "MANUAL_REVIEW",
] as const;
export type RuleEvaluationStatus = (typeof ruleEvaluationStatuses)[number];

export interface RuleEvaluationResult {
  readonly ruleId: Identifier;
  readonly ruleType: EligibilityRuleType | "GROUP";
  readonly status: RuleEvaluationStatus;
  readonly factPath?: FactPath;
  readonly actualValue?: FactValue;
  readonly explanationCode: string;
  readonly sourceReferences: readonly RuleSourceReference[];
  readonly children?: readonly RuleEvaluationResult[];
}

export const programEligibilityStatuses = [
  "ELIGIBLE",
  "INELIGIBLE",
  "CONDITIONALLY_ELIGIBLE",
  "INSUFFICIENT_INFORMATION",
  "MANUAL_REVIEW_REQUIRED",
] as const;
export type ProgramEligibilityStatus =
  (typeof programEligibilityStatuses)[number];

export interface ProgramEligibilityResult {
  readonly status: ProgramEligibilityStatus;
  readonly rootRuleResult: RuleEvaluationResult;
  readonly ruleResults: readonly RuleEvaluationResult[];
}

export interface SchemeCostItem {
  readonly costItemId: Identifier;
  readonly category: string;
  readonly amount: MonetaryAmount;
  readonly tags: readonly ClassificationTag[];
  readonly sourceReferences: readonly SourceReference[];
}

export const costEligibilityRuleTypes = [
  "INCLUDE_CATEGORIES",
  "EXCLUDE_CATEGORIES",
  "INCLUDE_TAGS",
  "EXCLUDE_TAGS",
  "PERCENTAGE_CAP",
  "ABSOLUTE_CAP",
  "MAXIMUM_ELIGIBLE_AMOUNT",
  "DURATION_CAP",
  "PER_UNIT_CAP",
  "MANUAL_REVIEW",
  "CUSTOM_RULE",
] as const;
export type CostEligibilityRuleType = (typeof costEligibilityRuleTypes)[number];

interface CostEligibilityRuleBase {
  readonly ruleId: Identifier;
  readonly sourceReferences: readonly RuleSourceReference[];
}

export type CostEligibilityRule =
  | (CostEligibilityRuleBase & {
      readonly type: "INCLUDE_CATEGORIES" | "EXCLUDE_CATEGORIES";
      readonly categories: readonly string[];
    })
  | (CostEligibilityRuleBase & {
      readonly type: "INCLUDE_TAGS" | "EXCLUDE_TAGS";
      readonly tags: readonly ClassificationTag[];
    })
  | (CostEligibilityRuleBase & {
      readonly type: "PERCENTAGE_CAP";
      readonly percentage: Percentage;
    })
  | (CostEligibilityRuleBase & {
      readonly type: "ABSOLUTE_CAP" | "MAXIMUM_ELIGIBLE_AMOUNT";
      readonly amount: MonetaryAmount;
    })
  | (CostEligibilityRuleBase & {
      readonly type: "DURATION_CAP";
      readonly maximumDuration: DecimalValue;
      readonly durationFactPath: FactPath;
    })
  | (CostEligibilityRuleBase & {
      readonly type: "PER_UNIT_CAP";
      readonly maximumAmountPerUnit: MonetaryAmount;
      readonly unitCountFactPath: FactPath;
    })
  | (CostEligibilityRuleBase & { readonly type: "MANUAL_REVIEW" })
  | (CostEligibilityRuleBase & {
      readonly type: "CUSTOM_RULE";
      readonly handlerId: Identifier;
    });

export type CostEligibilityStatus =
  "ELIGIBLE" | "PARTIALLY_ELIGIBLE" | "INELIGIBLE" | "MANUAL_REVIEW_REQUIRED";

export interface CostEligibilityRuleResult {
  readonly ruleId: Identifier;
  readonly ruleType: CostEligibilityRuleType;
  readonly status: "PASS" | "EXCLUDED" | "CAPPED" | "MANUAL_REVIEW";
  readonly amountBefore: MonetaryAmount;
  readonly amountAfter: MonetaryAmount;
  readonly sourceReferences: readonly RuleSourceReference[];
}

export interface CostEligibilityLineResult {
  readonly costItem: SchemeCostItem;
  readonly status: CostEligibilityStatus;
  readonly eligibleAmount: MonetaryAmount;
  readonly ineligibleAmount: MonetaryAmount;
  readonly ruleResults: readonly CostEligibilityRuleResult[];
}

export interface ProjectCostEligibilityResult {
  readonly totalProjectCost: MonetaryAmount;
  readonly eligibleProjectCost: MonetaryAmount;
  readonly ineligibleProjectCost: MonetaryAmount;
  readonly lines: readonly CostEligibilityLineResult[];
}

export const benefitKinds = [
  "CAPITAL_SUBSIDY",
  "MARGIN_MONEY",
  "GRANT",
  "INTEREST_SUBVENTION",
  "CREDIT_GUARANTEE",
  "SEED_CAPITAL",
  "REIMBURSEMENT",
  "LOAN_LIMIT",
  "CREDIT_SUPPORT",
  "CUSTOM",
] as const;
export type BenefitKind = (typeof benefitKinds)[number];

export const benefitCalculationBases = [
  "TOTAL_PROJECT_COST",
  "ELIGIBLE_PROJECT_COST",
  "ELIGIBLE_CAPITAL_COST",
  "SPECIFIC_COST_COMPONENTS",
  "BANK_LOAN",
  "BENEFICIARY_CONTRIBUTION",
  "FIXED_AMOUNT",
  "PER_UNIT",
  "CUSTOM",
] as const;
export type BenefitCalculationBasis = (typeof benefitCalculationBases)[number];

export const releaseMechanisms = [
  "UPFRONT",
  "BACK_ENDED",
  "REIMBURSEMENT",
  "SINGLE_INSTALLMENT",
  "MULTIPLE_INSTALLMENTS",
  "POST_VERIFICATION",
  "POST_DISBURSEMENT",
  "POST_COMPLETION",
  "CUSTOM_CONDITIONAL",
] as const;
export type ReleaseMechanism = (typeof releaseMechanisms)[number];

export const releaseTriggerTypes = [
  "SANCTION",
  "LOAN_FIRST_DISBURSEMENT",
  "BENEFICIARY_EXPENDITURE",
  "PROJECT_PROGRESS",
  "PROJECT_COMPLETION",
  "VERIFICATION",
  "LOCK_IN_COMPLETION",
  "CUSTOM",
] as const;
export type ReleaseTriggerType = (typeof releaseTriggerTypes)[number];

export interface BenefitReleaseInstallment {
  readonly installmentNumber: number;
  readonly percentage: Percentage;
  readonly trigger: ReleaseTriggerType;
  readonly conditions?: readonly string[];
}

export interface BenefitReleaseModel {
  readonly mechanism: ReleaseMechanism;
  readonly installments?: readonly BenefitReleaseInstallment[];
  readonly conditions?: readonly string[];
}

export interface BenefitCapDefinition {
  readonly capId: Identifier;
  readonly type: "ABSOLUTE" | "PERCENTAGE_OF_BASIS";
  readonly amount?: MonetaryAmount;
  readonly percentage?: Percentage;
  readonly applicability?: EligibilityRuleGroup;
  readonly sourceReferences: readonly RuleSourceReference[];
}

interface BenefitDefinitionBase {
  readonly benefitId: Identifier;
  readonly name: string;
  readonly kind: BenefitKind;
  readonly basis: BenefitCalculationBasis;
  readonly specificCostItemIds?: readonly Identifier[];
  readonly creditLinked: boolean;
  readonly minimumBenefit?: MonetaryAmount;
  readonly caps?: readonly BenefitCapDefinition[];
  readonly release: BenefitReleaseModel;
  readonly sourceReferences: readonly RuleSourceReference[];
}

export type FinancialBenefitDefinition =
  | (BenefitDefinitionBase & {
      readonly calculation: "PERCENTAGE";
      readonly rate: Percentage;
    })
  | (BenefitDefinitionBase & {
      readonly calculation: "FIXED";
      readonly fixedAmount: MonetaryAmount;
    })
  | (BenefitDefinitionBase & {
      readonly calculation: "PER_UNIT";
      readonly amountPerUnit: MonetaryAmount;
      readonly unitCountFactPath: FactPath;
    })
  | (BenefitDefinitionBase & {
      readonly calculation: "CUSTOM";
      readonly handlerId: Identifier;
    });

export interface AppliedBenefitCap {
  readonly capId: Identifier;
  readonly capAmount: MonetaryAmount;
  readonly sourceReferences: readonly RuleSourceReference[];
}

export interface BenefitCalculationTrace {
  readonly basisType: BenefitCalculationBasis;
  readonly basisAmount: MonetaryAmount;
  readonly rate?: Percentage;
  readonly fixedAmount?: MonetaryAmount;
  readonly unitCount?: DecimalValue;
  readonly amountPerUnit?: MonetaryAmount;
  readonly rawBenefit: MonetaryAmount;
  readonly minimumBenefit?: MonetaryAmount;
  readonly appliedCaps: readonly AppliedBenefitCap[];
  readonly calculatedEligibleBenefit: MonetaryAmount;
}

export interface CalculatedBenefitResult {
  readonly benefitId: Identifier;
  readonly benefitKind: BenefitKind;
  readonly status:
    "CALCULATED" | "INSUFFICIENT_INFORMATION" | "MANUAL_REVIEW_REQUIRED";
  readonly calculatedEligibleBenefit?: MonetaryAmount;
  readonly trace?: BenefitCalculationTrace;
  readonly sourceReferences: readonly RuleSourceReference[];
  readonly release: BenefitReleaseModel;
}

export interface OverallProgramBenefitCap {
  readonly amount: MonetaryAmount;
  readonly sourceReferences: readonly RuleSourceReference[];
}

export interface AppliedOverallProgramBenefitCap {
  readonly calculatedBeforeCap: MonetaryAmount;
  readonly capAmount: MonetaryAmount;
  readonly calculatedAfterCap: MonetaryAmount;
  readonly sourceReferences: readonly RuleSourceReference[];
}

export type ContributionCalculationBasis =
  "TOTAL_PROJECT_COST" | "ELIGIBLE_PROJECT_COST";

export interface BeneficiaryContributionRequirement {
  readonly basis: ContributionCalculationBasis;
  readonly minimumPercentage?: Percentage;
  readonly fixedPercentage?: Percentage;
  readonly minimumAmount?: MonetaryAmount;
  readonly sourceReferences: readonly RuleSourceReference[];
}

export interface BankFinanceRequirement {
  readonly requirement: "REQUIRED" | "OPTIONAL" | "NOT_PERMITTED";
  readonly selfFinanceAllowed: boolean;
  readonly minimumAmount?: MonetaryAmount;
  readonly maximumAmount?: MonetaryAmount;
  readonly creditLinkedBenefit: boolean;
  readonly sourceReferences: readonly RuleSourceReference[];
}

export interface ContributionComplianceResult {
  readonly status:
    | "MEETS_REQUIREMENT"
    | "BELOW_REQUIREMENT"
    | "NOT_APPLICABLE"
    | "INSUFFICIENT_INFORMATION";
  readonly requiredMinimumContribution: MonetaryAmount;
  readonly actualContribution?: MonetaryAmount;
  readonly shortfall: MonetaryAmount;
  readonly sourceReferences: readonly RuleSourceReference[];
}

export interface BankFinanceComplianceResult {
  readonly status:
    | "MEETS_REQUIREMENT"
    | "BELOW_MINIMUM"
    | "ABOVE_MAXIMUM"
    | "FINANCE_NOT_PERMITTED"
    | "NOT_APPLICABLE"
    | "INSUFFICIENT_INFORMATION";
  readonly actualBankFinance?: MonetaryAmount;
  readonly sourceReferences: readonly RuleSourceReference[];
}

export interface ProgramFundingConstraint {
  readonly minimumPromoterContribution: MonetaryAmount;
  readonly maximumCalculatedBenefit: MonetaryAmount;
  readonly bankFinanceRequired: boolean;
  readonly minimumBankFinance?: MonetaryAmount;
  readonly maximumBankFinance?: MonetaryAmount;
  readonly selfFinanceAllowed: boolean;
  readonly eligibleCost: MonetaryAmount;
  readonly ineligibleCost: MonetaryAmount;
  readonly contributionCompliance: ContributionComplianceResult;
  readonly bankFinanceCompliance: BankFinanceComplianceResult;
}

export interface FinancingProgramDefinition {
  readonly programId: ProgramId;
  readonly versionId: ProgramVersionId;
  readonly displayName: string;
  readonly description?: string;
  readonly programTypes: readonly ProgramType[];
  readonly effectiveFrom: ISODate;
  readonly effectiveTo?: ISODate;
  readonly status: ProgramVersionStatus;
  readonly jurisdiction: ProgramJurisdiction;
  readonly sourceReferences: readonly RuleSourceReference[];
  readonly eligibility: EligibilityRuleGroup;
  readonly costEligibilityRules: readonly CostEligibilityRule[];
  readonly benefits: readonly FinancialBenefitDefinition[];
  readonly overallBenefitCap?: OverallProgramBenefitCap;
  readonly contributionRequirement?: BeneficiaryContributionRequirement;
  readonly bankFinanceRequirement?: BankFinanceRequirement;
  readonly nonFinancialBenefits?: readonly string[];
  readonly handlerIds?: readonly Identifier[];
}

export interface ProgramSelection {
  readonly programId: ProgramId;
  readonly versionId?: ProgramVersionId;
}

export interface ProgramEvaluationSnapshot {
  readonly programId: ProgramId;
  readonly programVersionId: ProgramVersionId;
  readonly evaluationAsOfDate: ISODate;
}

export interface ProgramEvaluationInput {
  readonly projectId: Identifier;
  readonly selection: ProgramSelection;
  readonly evaluationAsOfDate: ISODate;
  readonly facts: ProgramEvaluationFacts;
  readonly costItems: readonly SchemeCostItem[];
  readonly actualBeneficiaryContribution?: Assumption<MonetaryAmount>;
  readonly actualBankFinance?: Assumption<MonetaryAmount>;
}

export interface ProgramEvaluationResult {
  readonly projectId: Identifier;
  readonly snapshot: ProgramEvaluationSnapshot;
  readonly programTypes: readonly ProgramType[];
  readonly eligibility: ProgramEligibilityResult;
  readonly costEligibility: ProjectCostEligibilityResult;
  readonly benefits: readonly CalculatedBenefitResult[];
  readonly totalCalculatedEligibleBenefit: MonetaryAmount;
  readonly appliedOverallBenefitCap?: AppliedOverallProgramBenefitCap;
  readonly fundingConstraint: ProgramFundingConstraint;
  readonly warnings: readonly string[];
}

export const compatibilityStatuses = [
  "ALLOWED",
  "PROHIBITED",
  "ALLOWED_WITH_CONDITIONS",
  "ALLOWED_FOR_DISTINCT_COSTS",
  "ALLOWED_FOR_DISTINCT_BENEFIT_TYPES",
  "OFFICIAL_CONVERGENCE_SUPPORTED",
  "REQUIRES_MANUAL_REVIEW",
  "UNKNOWN",
] as const;
export type ProgramCompatibilityStatus = (typeof compatibilityStatuses)[number];

export const sameCostPolicies = [
  "NO_DOUBLE_ASSISTANCE",
  "ALLOW_DIFFERENT_BENEFIT_TYPES",
  "ALLOW_UP_TO_COST",
  "ALLOW_EXPLICIT_CONVERGENCE",
  "DISTINCT_COST_PORTIONS_ONLY",
  "MANUAL_REVIEW",
] as const;
export type SameCostPolicy = (typeof sameCostPolicies)[number];

export interface ProgramVersionConstraint {
  readonly programId: ProgramId;
  readonly versionIds?: readonly ProgramVersionId[];
}

export interface ProgramConvergenceRule {
  readonly convergenceRuleId: Identifier;
  readonly programA: ProgramVersionConstraint;
  readonly programB: ProgramVersionConstraint;
  readonly effectiveFrom: ISODate;
  readonly effectiveTo?: ISODate;
  readonly compatibilityStatus: ProgramCompatibilityStatus;
  readonly allowedBenefitTypes?: readonly BenefitKind[];
  readonly prohibitedBenefitTypes?: readonly BenefitKind[];
  readonly sameCostItemPolicy: SameCostPolicy;
  readonly conditions?: readonly string[];
  readonly sourceReferences: readonly RuleSourceReference[];
}

export interface ProgramCompatibilityResult {
  readonly programA: ProgramEvaluationSnapshot;
  readonly programB: ProgramEvaluationSnapshot;
  readonly status: ProgramCompatibilityStatus;
  readonly sameCostItemPolicy: SameCostPolicy;
  readonly allowedBenefitTypes?: readonly BenefitKind[];
  readonly prohibitedBenefitTypes?: readonly BenefitKind[];
  readonly convergenceRuleId?: Identifier;
  readonly conditions: readonly string[];
  readonly sourceReferences: readonly RuleSourceReference[];
}

export type AssistanceAllocationType =
  "FULL_COST_BASIS" | "DISTINCT_PORTION" | "NON_COST_BASED";

export interface CostAssistanceAllocation {
  readonly costItemId: Identifier;
  readonly programId: ProgramId;
  readonly programVersionId: ProgramVersionId;
  readonly benefitId: Identifier;
  readonly benefitKind: BenefitKind;
  readonly eligibleBasisAmount: MonetaryAmount;
  readonly benefitAmount: MonetaryAmount;
  readonly allocationType: AssistanceAllocationType;
  readonly portionId?: Identifier;
}

export type ProgramConflictCode =
  | "PROGRAM_CONFLICT"
  | "DOUBLE_FUNDING_CONFLICT"
  | "INCOMPATIBLE_BENEFITS"
  | "OVERLAPPING_COST_BASIS"
  | "MISSING_CONVERGENCE_RULE"
  | "VERSION_CONFLICT";

export interface ProgramStackConflict {
  readonly code: ProgramConflictCode;
  readonly programIds: readonly ProgramId[];
  readonly costItemId?: Identifier;
  readonly benefitIds?: readonly Identifier[];
  readonly message: string;
}

export interface ProgramStackEvaluation {
  readonly projectId: Identifier;
  readonly mode: "BANKABLE_PROJECT" | "PROGRAM_STACK";
  readonly selectedPrograms: readonly ProgramEvaluationSnapshot[];
  readonly individualEvaluations: readonly ProgramEvaluationResult[];
  readonly compatibilityResults: readonly ProgramCompatibilityResult[];
  readonly allocations: readonly CostAssistanceAllocation[];
  readonly conflicts: readonly ProgramStackConflict[];
  readonly warnings: readonly string[];
  readonly manualReviewItems: readonly string[];
  readonly combinedCalculatedEligibleBenefits: MonetaryAmount;
  readonly combinedEligibleBenefits?: MonetaryAmount;
}

export interface ProgramStackEvaluationInput {
  readonly projectId: Identifier;
  readonly evaluationAsOfDate: ISODate;
  readonly selectedPrograms: readonly ProgramSelection[];
  readonly facts: ProgramEvaluationFacts;
  readonly costItems: readonly SchemeCostItem[];
  readonly actualBeneficiaryContribution?: Assumption<MonetaryAmount>;
  readonly actualBankFinance?: Assumption<MonetaryAmount>;
}
