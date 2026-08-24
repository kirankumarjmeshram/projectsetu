import type {
  CalculationError,
  CalculationResult,
} from "../shared/calculation";
import type { SourceReference } from "../shared/provenance";
import type { Identifier, ISODate, MonetaryAmount } from "../shared/types";
import type {
  BankFinanceComplianceResult,
  BenefitKind,
  BenefitReleaseModel,
  ContributionComplianceResult,
  FinancingProgramDefinition,
  ProgramCompatibilityResult,
  ProgramEvaluationFacts,
  ProgramEvaluationResult,
  ProgramEvaluationSnapshot,
  ProgramId,
  ProgramSelection,
  ProgramVersionId,
  SchemeCostItem,
} from "../schemes/program";
import type { RuleSourceReference } from "../schemes/provenance";

export type FundingComposerMode =
  "BANKABLE_PROJECT" | "SINGLE_PROGRAM" | "MULTI_PROGRAM";

export type FundingResolutionStatus =
  | "RESOLVED"
  | "RESOLVED_WITH_WARNINGS"
  | "UNRESOLVED"
  | "INELIGIBLE_SELECTION"
  | "MANUAL_REVIEW_REQUIRED";

export interface SourceBackedAmount {
  readonly value: MonetaryAmount;
  readonly sourceReferences: readonly SourceReference[];
}

export interface OtherSourceBackedFinance extends SourceBackedAmount {
  readonly financeSourceId: Identifier;
  readonly availableAtInitialFunding: boolean;
}

export interface AuthoritativeProjectCostInput {
  readonly totalProjectCost: MonetaryAmount;
  readonly costItems: readonly SchemeCostItem[];
}

export interface AuthoritativeFinancingInput {
  readonly promoterContribution?: SourceBackedAmount;
  readonly bankFinance?: SourceBackedAmount;
  readonly requestedCredit?: SourceBackedAmount;
  readonly otherFinance: readonly OtherSourceBackedFinance[];
}

export interface RequestedProgramAllocation {
  readonly allocationId: Identifier;
  readonly programId: ProgramId;
  readonly programVersionId?: ProgramVersionId;
  readonly benefitId: Identifier;
  readonly costItemId: Identifier;
  readonly costPortionId: Identifier;
  readonly allocatedCostAmount: MonetaryAmount;
}

export interface FundingComposerInput {
  readonly projectId: Identifier;
  readonly evaluationAsOfDate: ISODate;
  readonly projectCost: AuthoritativeProjectCostInput;
  readonly financing: AuthoritativeFinancingInput;
  readonly selectedPrograms: readonly ProgramSelection[];
  readonly facts: ProgramEvaluationFacts;
  readonly requestedAllocations?: readonly RequestedProgramAllocation[];
}

export type IndividualProgramEvaluationStatus =
  | "EVALUATED"
  | "DUPLICATE_SELECTION"
  | "VERSION_RESOLUTION_FAILURE"
  | "EVALUATION_FAILURE";

export interface IndividualProgramCompositionEvaluation {
  readonly selection: ProgramSelection;
  readonly status: IndividualProgramEvaluationStatus;
  readonly snapshot?: ProgramEvaluationSnapshot;
  readonly definition?: FinancingProgramDefinition;
  readonly evaluation?: ProgramEvaluationResult;
  readonly errors: readonly CalculationError[];
  readonly sourceReferences: readonly RuleSourceReference[];
}

export type FundingCompatibilityStatus =
  | "COMPATIBLE"
  | "INCOMPATIBLE"
  | "CONDITIONALLY_COMPATIBLE"
  | "UNKNOWN"
  | "MANUAL_REVIEW_REQUIRED";

export type CompatibilityScope = "PROGRAM" | "BENEFIT" | "COST_PORTION";

export interface PairwiseCompatibilityEvaluation {
  readonly leftProgram: ProgramEvaluationSnapshot;
  readonly rightProgram: ProgramEvaluationSnapshot;
  readonly status: FundingCompatibilityStatus;
  readonly scope: CompatibilityScope;
  readonly reasonCode: string;
  readonly conditions: readonly string[];
  readonly result: ProgramCompatibilityResult;
  readonly sourceReferences: readonly RuleSourceReference[];
}

export interface BenefitCompatibilityEvaluation {
  readonly leftProgram: ProgramEvaluationSnapshot;
  readonly leftBenefitId: Identifier;
  readonly leftBenefitKind: BenefitKind;
  readonly rightProgram: ProgramEvaluationSnapshot;
  readonly rightBenefitId: Identifier;
  readonly rightBenefitKind: BenefitKind;
  readonly status: FundingCompatibilityStatus;
  readonly reasonCode: string;
  readonly sourceReferences: readonly RuleSourceReference[];
}

export type FundingAllocationKind =
  | "SUBSIDY"
  | "MARGIN_MONEY"
  | "GRANT"
  | "SEED_CAPITAL"
  | "REIMBURSEMENT"
  | "INTEREST_SUBVENTION"
  | "CREDIT"
  | "CREDIT_GUARANTEE"
  | "OTHER";

export type FundingAvailability =
  "INITIAL" | "DEFERRED_CONDITIONAL" | "NON_CASH_CONTINGENT";

export type FundingAllocationType = "AUTO" | "MANUAL" | "NON_COST_BASED";

export interface FundingAllocationLedgerEntry {
  readonly allocationId: Identifier;
  readonly programId: ProgramId;
  readonly programVersionId: ProgramVersionId;
  readonly benefitId: Identifier;
  readonly benefitKind: BenefitKind;
  readonly fundingKind: FundingAllocationKind;
  readonly availability: FundingAvailability;
  readonly costItemId?: Identifier;
  readonly costPortionId?: Identifier;
  readonly basisAmount: MonetaryAmount;
  readonly allocatedCostAmount: MonetaryAmount;
  readonly remainingCostAmount?: MonetaryAmount;
  readonly benefitAmount: MonetaryAmount;
  readonly allocationType: FundingAllocationType;
  readonly release: BenefitReleaseModel;
  readonly sourceRuleIds: readonly Identifier[];
  readonly sourceReferences: readonly RuleSourceReference[];
}

export type FundingConflictCode =
  | "PROGRAM_INCOMPATIBILITY"
  | "BENEFIT_INCOMPATIBILITY"
  | "DOUBLE_FUNDING_CONFLICT"
  | "COST_OVERALLOCATION"
  | "CONTRIBUTION_CONSTRAINT_CONFLICT"
  | "BANK_FINANCE_CONSTRAINT_CONFLICT"
  | "ALLOCATION_REQUIRED"
  | "PROGRAM_INELIGIBLE"
  | "PROGRAM_VERSION_RESOLUTION_FAILURE"
  | "DUPLICATE_PROGRAM_SELECTION"
  | "UNKNOWN_COST_ITEM"
  | "UNKNOWN_BENEFIT"
  | "DUPLICATE_COST_PORTION"
  | "INELIGIBLE_COST_ALLOCATION";

export interface FundingConflict {
  readonly code: FundingConflictCode;
  readonly messageCode: string;
  readonly programIds: readonly ProgramId[];
  readonly benefitIds?: readonly Identifier[];
  readonly costItemIds?: readonly Identifier[];
  readonly sourceRuleIds: readonly Identifier[];
  readonly sourceReferences: readonly RuleSourceReference[];
  readonly parameters: Readonly<Record<string, string>>;
}

export type FundingExplanationSeverity = "INFO" | "WARNING" | "BLOCKING";

export interface FundingExplanation {
  readonly code: string;
  readonly severity: FundingExplanationSeverity;
  readonly programIds: readonly ProgramId[];
  readonly costItemIds: readonly Identifier[];
  readonly sourceRuleIds: readonly Identifier[];
  readonly sourceReferences: readonly RuleSourceReference[];
  readonly parameters: Readonly<Record<string, string>>;
}

export interface ContributionConstraintEvaluation {
  readonly program: ProgramEvaluationSnapshot;
  readonly requiredContribution: MonetaryAmount;
  readonly actualContribution?: MonetaryAmount;
  readonly shortfall: MonetaryAmount;
  readonly compliance: ContributionComplianceResult["status"];
  readonly sourceReferences: readonly RuleSourceReference[];
}

export interface BankFinanceConstraintEvaluation {
  readonly program: ProgramEvaluationSnapshot;
  readonly creditProgram: boolean;
  readonly requirement: "REQUIRED" | "OPTIONAL" | "NOT_PERMITTED";
  readonly minimumBankFinance?: MonetaryAmount;
  readonly maximumBankFinance?: MonetaryAmount;
  readonly actualBankFinance?: MonetaryAmount;
  readonly requestedCredit?: MonetaryAmount;
  readonly maximumEligibleCredit?: MonetaryAmount;
  readonly creditCompliance?:
    | "WITHIN_LIMIT"
    | "ABOVE_LIMIT"
    | "INSUFFICIENT_INFORMATION"
    | "NO_LIMIT_CONFIGURED";
  readonly compliance: BankFinanceComplianceResult["status"];
  readonly sourceReferences: readonly RuleSourceReference[];
}

export interface FundingBenefitTotals {
  readonly capitalSubsidy: MonetaryAmount;
  readonly marginMoney: MonetaryAmount;
  readonly grant: MonetaryAmount;
  readonly seedCapital: MonetaryAmount;
  readonly reimbursement: MonetaryAmount;
  readonly otherCashAssistance: MonetaryAmount;
  readonly totalCalculatedCashBenefits: MonetaryAmount;
  readonly totalInitiallyAvailableAssistance: MonetaryAmount;
  readonly totalDeferredConditionalAssistance: MonetaryAmount;
  readonly interestSubvention: MonetaryAmount;
  readonly creditGuarantee: MonetaryAmount;
  readonly otherNonCashAssistance: MonetaryAmount;
}

export interface FundingSummary {
  readonly totalProjectCost: MonetaryAmount;
  readonly actualPromoterContribution?: MonetaryAmount;
  readonly requiredPromoterContribution: MonetaryAmount;
  readonly contributionShortfall: MonetaryAmount;
  readonly actualBankFinance?: MonetaryAmount;
  readonly minimumRequiredBankFinance?: MonetaryAmount;
  readonly maximumPermittedBankFinance?: MonetaryAmount;
  readonly totalOtherSourceBackedFinance: MonetaryAmount;
  readonly totalOtherInitiallyAvailableFinance: MonetaryAmount;
  readonly benefits: FundingBenefitTotals;
  readonly totalInitialFundingSources?: MonetaryAmount;
  readonly remainingInitialFundingRequirement?: MonetaryAmount;
  readonly initialFundingSurplus?: MonetaryAmount;
}

export interface ComposedNonFinancialBenefit {
  readonly program: ProgramEvaluationSnapshot;
  readonly benefitCode: string;
  readonly sourceReferences: readonly RuleSourceReference[];
}

export interface MultiProgramFundingResult {
  readonly projectId: Identifier;
  readonly evaluationAsOfDate: ISODate;
  readonly mode: FundingComposerMode;
  readonly resolutionStatus: FundingResolutionStatus;
  readonly projectCost: AuthoritativeProjectCostInput;
  readonly financing: AuthoritativeFinancingInput;
  readonly selectedPrograms: readonly ProgramSelection[];
  readonly individualProgramEvaluations: readonly IndividualProgramCompositionEvaluation[];
  readonly compatibilityEvaluations: readonly PairwiseCompatibilityEvaluation[];
  readonly benefitCompatibilityEvaluations: readonly BenefitCompatibilityEvaluation[];
  readonly allocationLedger: readonly FundingAllocationLedgerEntry[];
  readonly nonFinancialBenefits: readonly ComposedNonFinancialBenefit[];
  readonly contributionConstraints: readonly ContributionConstraintEvaluation[];
  readonly bankFinanceConstraints: readonly BankFinanceConstraintEvaluation[];
  readonly summary: FundingSummary;
  readonly conflicts: readonly FundingConflict[];
  readonly warnings: readonly FundingExplanation[];
  readonly manualReviewItems: readonly FundingExplanation[];
  readonly explanations: readonly FundingExplanation[];
}

export type FundingComposerCalculationResult =
  CalculationResult<MultiProgramFundingResult>;
