import type { BalanceSheetSchedule } from "@/domain/balance-sheet/balance-sheet";
import type { CashFlowSchedule } from "@/domain/cash-flow/cash-flow";
import type { DepreciationSchedule } from "@/domain/depreciation/depreciation";
import type {
  FinanceReconciliationResult,
  MeansOfFinanceSummary,
} from "@/domain/financing/calculations";
import type { MultiProgramFundingResult } from "@/domain/funding-composer/contracts";
import type { InvestmentReturnsAnalysis } from "@/domain/investment-returns/investment-returns";
import type { LoanRepaymentSchedule } from "@/domain/loan/loan";
import type { BankabilityMetricsSchedule } from "@/domain/metrics/metrics";
import type {
  AreaClassification,
  ProjectMode,
  ProjectStage,
  ProjectStatus,
} from "@/domain/project/project";
import type { ProfitAndLossSchedule } from "@/domain/profit-and-loss/profit-and-loss";
import type { ProjectCostSummary } from "@/domain/project-cost/calculations";
import type { RevenueAndOperatingExpenseProjection } from "@/domain/projection/projection";
import type { ProgramSelection } from "@/domain/schemes/program";
import type {
  Identifier,
  ISODate,
  ProjectionYear,
} from "@/domain/shared/types";
import type { WorkingCapitalSummary } from "@/domain/working-capital/calculations";

export type {
  BalanceSheetSchedule,
  BankabilityMetricsSchedule,
  CashFlowSchedule,
  InvestmentReturnsAnalysis,
  MultiProgramFundingResult,
  ProfitAndLossSchedule,
  WorkingCapitalSummary,
};

export type ProgramSelectionInput = ProgramSelection;

// ─── User-editable project assumption models ─────────────────────────────────

export interface ProjectDetailsInput {
  readonly id: Identifier;
  readonly name: string;
  readonly mode: ProjectMode;
  readonly industryActivity: string;
  readonly stage: ProjectStage;
  readonly status: ProjectStatus;
  readonly areaClassification: AreaClassification;
  readonly address?: {
    readonly lines: readonly string[];
    readonly villageTownCity?: string;
    readonly district: string;
    readonly state: string;
    readonly pinCode?: string;
  };
  readonly projectionPeriodYears: number;
  readonly implementationFrom?: ISODate;
  readonly implementationUntil?: ISODate;
}

export interface ApplicantPromoterInput {
  readonly applicantType:
    | "INDIVIDUAL"
    | "PROPRIETORSHIP"
    | "PARTNERSHIP"
    | "LLP"
    | "COMPANY"
    | "SHG"
    | "FPO"
    | "COOPERATIVE"
    | "TRUST_INSTITUTION"
    | "PRIVATE_LIMITED";
  readonly name: string;
  readonly gender: "MALE" | "FEMALE" | "OTHER";
  readonly age?: number;
  readonly socialCategory: "GENERAL" | "OBC" | "SC" | "ST" | "MINORITY";
  readonly specialCategoryFlags?: readonly string[];
  readonly educationQualification: string;
  readonly enterpriseStatus: "NEW" | "EXISTING";
  readonly priorSubsidyClaimed?: boolean;
  readonly edpTrainingCompleted?: boolean;
  readonly experienceYears?: number;
  readonly panNumber?: string;
  readonly aadhaarNumber?: string;
  readonly udymRegistrationNumber?: string;
}

export interface ProjectCostItemInput {
  readonly id: Identifier;
  readonly description: string;
  readonly category:
    | "LAND"
    | "LAND_DEVELOPMENT"
    | "BUILDING"
    | "CIVIL_WORKS"
    | "PLANT_AND_MACHINERY"
    | "EQUIPMENT"
    | "ELECTRICAL_INSTALLATION"
    | "FURNITURE"
    | "VEHICLE"
    | "COMPUTERS_AND_IT"
    | "PREOPERATIVE_EXPENSES"
    | "CONTINGENCIES"
    | "MARGIN_FOR_WORKING_CAPITAL"
    | "TECHNICAL_KNOW_HOW"
    | "OTHER";
  readonly amount: string; // Canonical decimal string
  readonly tax?: string;
  readonly freight?: string;
  readonly installation?: string;
  readonly notes?: string;
}

export interface FinanceSourceInput {
  readonly id: Identifier;
  readonly type:
    | "PROMOTER_CONTRIBUTION"
    | "TERM_LOAN"
    | "WORKING_CAPITAL_LOAN"
    | "CAPITAL_SUBSIDY"
    | "UNSECURED_LOAN"
    | "EQUITY"
    | "OTHER_CONTRIBUTION";
  readonly name: string;
  readonly amount: string; // Canonical decimal string
  readonly notes?: string;
}

export interface RevenueProductInput {
  readonly id: Identifier;
  readonly name: string;
  readonly unit: string; // e.g. "Kg", "Liters", "Units", "MT"
  readonly quantityYear1: string;
  readonly unitPriceYear1: string;
  readonly capacityUtilisationYear1: string; // e.g. "60" for 60%
  readonly annualQuantityGrowth: string; // e.g. "10" for 10%
  readonly annualPriceEscalation: string; // e.g. "5" for 5%
  readonly notes?: string;
}

export interface OperatingExpenseInput {
  readonly id: Identifier;
  readonly name: string;
  readonly category:
    | "RAW_MATERIALS"
    | "CONSUMABLES"
    | "POWER_AND_ELECTRICITY"
    | "FUEL"
    | "WAGES"
    | "SALARIES"
    | "RENT"
    | "REPAIRS_AND_MAINTENANCE"
    | "INSURANCE"
    | "ADMINISTRATIVE_EXPENSES"
    | "SELLING_EXPENSES"
    | "PACKING_EXPENSES"
    | "OTHER";
  readonly calculationMethod: "PERCENTAGE_OF_REVENUE" | "FIXED_ANNUAL_AMOUNT";
  readonly costBehavior: "VARIABLE" | "FIXED" | "SEMI_VARIABLE";
  readonly percentageOfRevenueYear1?: string;
  readonly annualAmountYear1?: string;
  readonly annualEscalation: string; // e.g. "5" for 5%
  readonly notes?: string;
}

export interface WorkingCapitalInput {
  readonly dayBase?: "360" | "365";
  readonly rawMaterialDays: string;
  readonly finishedGoodsDays: string;
  readonly receivableDays: string;
  readonly creditorDays: string;
  readonly borrowerMarginPercentage: string;
  readonly notes?: string;
}

export interface LoanAssumptionsInput {
  readonly id: Identifier;
  readonly loanType:
    "TERM_LOAN" | "WORKING_CAPITAL_DEMAND_LOAN" | "COMPOSITE_LOAN";
  readonly principalAmount: string;
  readonly annualInterestRate: string; // e.g. "9.5"
  readonly repaymentFrequency:
    "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY";
  readonly repaymentMethod: "EQUAL_PRINCIPAL" | "EMI";
  readonly repaymentTenureYears: number;
  readonly moratoriumPeriods?: number;
  readonly moratoriumType?: "PRINCIPAL_ONLY" | "FULL_PAYMENT";
  readonly moratoriumInterestTreatment?:
    "PAY_CURRENT" | "ACCRUE" | "CAPITALIZE";
  readonly notes?: string;
}

export interface DepreciationAssetInput {
  readonly id: Identifier;
  readonly name: string;
  readonly category:
    | "BUILDING"
    | "PLANT_AND_MACHINERY"
    | "EQUIPMENT"
    | "FURNITURE_AND_FIXTURES"
    | "VEHICLE"
    | "ELECTRICAL_INSTALLATION"
    | "OFFICE_EQUIPMENT"
    | "COMPUTER"
    | "OTHER";
  readonly method: "STRAIGHT_LINE" | "WRITTEN_DOWN_VALUE";
  readonly originalCost: string;
  readonly residualValue: string;
  readonly usefulLifeYears?: number;
  readonly depreciationRate?: string;
  readonly startYear?: ProjectionYear;
}

export interface TaxAndReturnsInput {
  readonly taxMode: "NO_TAX" | "PERCENTAGE_OF_POSITIVE_PBT";
  readonly taxRate: string; // e.g. "25"
  readonly discountRate: string; // e.g. "12" for NPV/IRR
  readonly initialOpeningCash: string;
}

export interface ProjectWizardInput {
  readonly project: ProjectDetailsInput;
  readonly applicant: ApplicantPromoterInput;
  readonly costItems: readonly ProjectCostItemInput[];
  readonly financingSources: readonly FinanceSourceInput[];
  readonly revenueProducts: readonly RevenueProductInput[];
  readonly operatingExpenses: readonly OperatingExpenseInput[];
  readonly workingCapital: WorkingCapitalInput;
  readonly loan: LoanAssumptionsInput;
  readonly depreciableAssets?: readonly DepreciationAssetInput[];
  readonly taxAndReturns: TaxAndReturnsInput;
  readonly selectedPrograms: readonly ProgramSelection[];
  readonly schemeFacts?: Record<string, unknown>;
}

// ─── Orchestrator Output Model ───────────────────────────────────────────────

export type OrchestrationIssueSeverity =
  "ERROR" | "WARNING" | "MANUAL_REVIEW" | "INFO";

export interface OrchestrationIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: OrchestrationIssueSeverity;
  readonly path?: string;
  readonly section?: string;
}

export interface ProjectCalculationResult {
  readonly projectId: Identifier;
  readonly success: boolean;
  readonly projectCost?: ProjectCostSummary;
  readonly meansOfFinance?: MeansOfFinanceSummary;
  readonly financingReconciliation?: FinanceReconciliationResult;
  readonly projection?: RevenueAndOperatingExpenseProjection;
  readonly workingCapitalSummaries?: readonly WorkingCapitalSummary[];
  readonly depreciation?: DepreciationSchedule;
  readonly loanSchedule?: LoanRepaymentSchedule;
  readonly profitAndLoss?: ProfitAndLossSchedule;
  readonly cashFlow?: CashFlowSchedule;
  readonly balanceSheet?: BalanceSheetSchedule;
  readonly bankabilityMetrics?: BankabilityMetricsSchedule;
  readonly investmentReturns?: InvestmentReturnsAnalysis;
  readonly fundingComposer?: MultiProgramFundingResult;
  readonly issues: readonly OrchestrationIssue[];
  readonly calculatedAt: ISODate;
}
