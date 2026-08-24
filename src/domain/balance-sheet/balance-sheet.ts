import type { Assumption } from "../shared/assumptions";
import type {
  Identifier,
  MonetaryAmount,
  ProjectionYear,
} from "../shared/types";

/**
 * Normalized closing balances and period movements consumed by the engine.
 * Derived totals and net fixed assets are intentionally excluded.
 */
export interface BalanceSheetYearInput {
  readonly year: ProjectionYear;
  readonly grossFixedAssets: MonetaryAmount;
  readonly accumulatedDepreciation: MonetaryAmount;
  readonly inventory: MonetaryAmount;
  readonly receivables: MonetaryAmount;
  readonly otherCurrentAssets: MonetaryAmount;
  readonly cashAndBank: MonetaryAmount;
  /** Non-current portion only when current debt is separately classified. */
  readonly longTermLoanOutstanding: MonetaryAmount;
  readonly currentDebt: MonetaryAmount;
  readonly payables: MonetaryAmount;
  readonly otherCurrentLiabilities: MonetaryAmount;
  readonly promoterCapital: MonetaryAmount;
  readonly profitAfterTax: MonetaryAmount;
  readonly retainedEarningsAdjustments: MonetaryAmount;
  readonly otherEquity: MonetaryAmount;
}

export interface BalanceSheetProjectionInput {
  readonly projectId: Identifier;
  readonly openingRetainedEarnings: Assumption<MonetaryAmount>;
  readonly years: readonly BalanceSheetYearInput[];
}

/** One independent point-in-time closing financial position. */
export interface BalanceSheetYear {
  readonly year: ProjectionYear;
  readonly grossFixedAssets: MonetaryAmount;
  readonly accumulatedDepreciation: MonetaryAmount;
  readonly netFixedAssets: MonetaryAmount;
  readonly inventory: MonetaryAmount;
  readonly receivables: MonetaryAmount;
  readonly otherCurrentAssets: MonetaryAmount;
  readonly cashAndBank: MonetaryAmount;
  readonly totalCurrentAssets: MonetaryAmount;
  readonly totalAssets: MonetaryAmount;
  readonly longTermLoanOutstanding: MonetaryAmount;
  readonly currentDebt: MonetaryAmount;
  readonly payables: MonetaryAmount;
  readonly otherCurrentLiabilities: MonetaryAmount;
  readonly totalLiabilities: MonetaryAmount;
  readonly promoterCapital: MonetaryAmount;
  readonly openingRetainedEarnings: MonetaryAmount;
  readonly profitAfterTax: MonetaryAmount;
  readonly retainedEarningsAdjustments: MonetaryAmount;
  readonly closingRetainedEarnings: MonetaryAmount;
  readonly otherEquity: MonetaryAmount;
  readonly totalEquity: MonetaryAmount;
  /** Total assets less total liabilities less total equity. */
  readonly balanceDifference: MonetaryAmount;
  readonly isBalanced: boolean;
}

/** Point-in-time rows deliberately have no meaningless cumulative totals. */
export interface BalanceSheetSchedule {
  readonly projectId: Identifier;
  readonly openingRetainedEarnings: Assumption<MonetaryAmount>;
  readonly years: readonly BalanceSheetYear[];
}

export interface BalanceSheetRetainedEarningsYearInput {
  readonly year: ProjectionYear;
  readonly profitAfterTax: MonetaryAmount;
  readonly retainedEarningsAdjustments: MonetaryAmount;
}

export interface BalanceSheetRetainedEarningsInput {
  readonly projectId: Identifier;
  readonly openingRetainedEarnings: Assumption<MonetaryAmount>;
  readonly years: readonly BalanceSheetRetainedEarningsYearInput[];
}

export interface BalanceSheetRetainedEarningsYear {
  readonly year: ProjectionYear;
  readonly openingRetainedEarnings: MonetaryAmount;
  readonly profitAfterTax: MonetaryAmount;
  readonly retainedEarningsAdjustments: MonetaryAmount;
  readonly closingRetainedEarnings: MonetaryAmount;
}

export interface BalanceSheetRetainedEarningsSchedule {
  readonly projectId: Identifier;
  readonly openingRetainedEarnings: Assumption<MonetaryAmount>;
  readonly years: readonly BalanceSheetRetainedEarningsYear[];
}

export interface BalanceSheetFixedAssetYear {
  readonly year: ProjectionYear;
  readonly grossFixedAssets: MonetaryAmount;
  readonly accumulatedDepreciation: MonetaryAmount;
  /** Retained only to validate the authoritative depreciation reconciliation. */
  readonly authoritativeNetFixedAssets: MonetaryAmount;
  readonly depreciation?: never;
  readonly depreciationExpense?: never;
}

export interface BalanceSheetFixedAssetSchedule {
  readonly projectId: Identifier;
  readonly years: readonly BalanceSheetFixedAssetYear[];
}

export interface BalanceSheetCashYear {
  readonly year: ProjectionYear;
  readonly cashAndBank: MonetaryAmount;
  readonly netCashMovement?: never;
  readonly operatingCashFlow?: never;
  readonly investingCashFlow?: never;
  readonly financingCashFlow?: never;
}

export interface BalanceSheetCashSchedule {
  readonly projectId: Identifier;
  readonly years: readonly BalanceSheetCashYear[];
}

/** Total closing principal before accounting maturity classification. */
export interface BalanceSheetLoanOutstandingYear {
  readonly year: ProjectionYear;
  readonly totalLoanOutstanding: MonetaryAmount;
  readonly principalRepayment?: never;
  readonly interestExpense?: never;
  readonly interestPaid?: never;
  readonly accruedInterest?: never;
}

export interface BalanceSheetLoanOutstandingSchedule {
  readonly projectId: Identifier;
  readonly years: readonly BalanceSheetLoanOutstandingYear[];
}

export interface BalanceSheetDebtClassificationYear {
  readonly year: ProjectionYear;
  readonly longTermLoanOutstanding: Assumption<MonetaryAmount>;
  readonly currentDebt: Assumption<MonetaryAmount>;
}

export interface BalanceSheetDebtClassificationSchedule {
  readonly projectId: Identifier;
  readonly years: readonly BalanceSheetDebtClassificationYear[];
}

export interface BalanceSheetPromoterCapitalYear {
  readonly year: ProjectionYear;
  readonly openingPromoterCapital: MonetaryAmount;
  readonly promoterContribution: MonetaryAmount;
  readonly closingPromoterCapital: MonetaryAmount;
}

export interface BalanceSheetPromoterCapitalSchedule {
  readonly projectId: Identifier;
  readonly openingPromoterCapital: Assumption<MonetaryAmount>;
  readonly years: readonly BalanceSheetPromoterCapitalYear[];
}

/** Source-backed accounting balances not semantically provided by other engines. */
export interface BalanceSheetAccountingBalanceYear {
  readonly year: ProjectionYear;
  readonly inventory: Assumption<MonetaryAmount>;
  readonly receivables: Assumption<MonetaryAmount>;
  readonly otherCurrentAssets: Assumption<MonetaryAmount>;
  readonly payables: Assumption<MonetaryAmount>;
  readonly otherCurrentLiabilities: Assumption<MonetaryAmount>;
  readonly retainedEarningsAdjustments: Assumption<MonetaryAmount>;
  readonly otherEquity: Assumption<MonetaryAmount>;
}

export interface BalanceSheetAccountingBalanceSchedule {
  readonly projectId: Identifier;
  readonly years: readonly BalanceSheetAccountingBalanceYear[];
}

export const balanceSheetMissingValueTreatments = [
  "ERROR",
  "USE_EXPLICIT_ZERO",
] as const;
export type BalanceSheetMissingValueTreatment =
  (typeof balanceSheetMissingValueTreatments)[number];

export interface BalanceSheetCompositionPolicy {
  readonly missingFixedAssets: BalanceSheetMissingValueTreatment;
  readonly missingCash: BalanceSheetMissingValueTreatment;
  readonly missingLoanOutstanding: BalanceSheetMissingValueTreatment;
  readonly missingDebtClassification: BalanceSheetMissingValueTreatment;
  readonly missingPromoterCapital: BalanceSheetMissingValueTreatment;
  readonly missingAccountingBalances: BalanceSheetMissingValueTreatment;
}
