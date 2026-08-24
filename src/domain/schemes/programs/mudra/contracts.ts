import type { Assumption } from "../../../shared/assumptions";
import type { CalculationResult } from "../../../shared/calculation";
import type { SourceReference } from "../../../shared/provenance";
import type {
  Identifier,
  ISODate,
  MonetaryAmount,
} from "../../../shared/types";
import type {
  ProgramEligibilityStatus,
  ProgramEvaluationSnapshot,
} from "../../program";
import type { RuleSourceReference } from "../../provenance";

export type MudraCategory = "SHISHU" | "KISHORE" | "TARUN" | "TARUN_PLUS";
export type MudraActivity =
  | "MANUFACTURING"
  | "TRADING"
  | "SERVICE"
  | "POULTRY"
  | "DAIRY"
  | "BEEKEEPING"
  | "OTHER_ALLIED_TO_AGRICULTURE"
  | "CROP_CULTIVATION"
  | "PERSONAL_CONSUMPTION"
  | "UNVERIFIED";
export type MudraFinancingPurpose = "TERM_LOAN" | "WORKING_CAPITAL" | "BOTH";

export interface MudraEvaluationInput {
  readonly projectId: Identifier;
  readonly evaluationAsOfDate: ISODate;
  readonly requestedCredit?: Assumption<MonetaryAmount>;
  readonly activity?: Assumption<MudraActivity>;
  readonly financingPurpose?: Assumption<MudraFinancingPurpose>;
  readonly hasPriorTarunLoan?: Assumption<boolean>;
  readonly priorTarunSuccessfullyRepaid?: Assumption<boolean>;
}

export interface MudraRuleTrace {
  readonly ruleId: Identifier;
  readonly result: string;
  readonly explanationCode: string;
  readonly sourceReferences: readonly RuleSourceReference[];
  readonly evidenceSources: readonly SourceReference[];
}

export interface MudraEvaluationResult {
  readonly snapshot: ProgramEvaluationSnapshot;
  readonly requestedCredit?: MonetaryAmount;
  readonly applicableCategory?: MudraCategory;
  readonly categoryMinimum?: MonetaryAmount;
  readonly categoryMaximum?: MonetaryAmount;
  readonly tarunPlusPriorLoanRequirement: "NOT_APPLICABLE" | "REQUIRED";
  readonly termLoanAllowed: true;
  readonly workingCapitalAllowed: true;
  readonly collateralRequirementMetadata: "COLLATERAL_NOT_REQUIRED_UNDER_PROGRAM";
  readonly lendingInstitutionCategories: readonly string[];
  readonly eligibilityStatus: ProgramEligibilityStatus;
  readonly manualReviewItems: readonly string[];
  readonly ruleTraces: readonly MudraRuleTrace[];
}

export type MudraCalculationResult = CalculationResult<MudraEvaluationResult>;
