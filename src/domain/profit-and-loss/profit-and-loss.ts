import type { Assumption } from "../shared/assumptions";
import type {
  Identifier,
  MonetaryAmount,
  Percentage,
  ProjectionYear,
} from "../shared/types";

export const profitAndLossTaxModes = [
  "NO_TAX",
  "PERCENTAGE_OF_POSITIVE_PBT",
] as const;
export type ProfitAndLossTaxMode = (typeof profitAndLossTaxModes)[number];

export interface ProfitAndLossTaxRateYearOverride {
  readonly year: ProjectionYear;
  /** Applies only to this projection year and does not change later years. */
  readonly taxRate: Assumption<Percentage>;
}

export interface NoTaxConfiguration {
  readonly mode: "NO_TAX";
  readonly taxRate?: never;
  readonly yearlyOverrides?: never;
}

export interface PercentageOfPositiveProfitBeforeTaxConfiguration {
  readonly mode: "PERCENTAGE_OF_POSITIVE_PBT";
  readonly taxRate: Assumption<Percentage>;
  readonly yearlyOverrides?: readonly ProfitAndLossTaxRateYearOverride[];
}

export type ProfitAndLossTaxConfiguration =
  NoTaxConfiguration | PercentageOfPositiveProfitBeforeTaxConfiguration;

/**
 * Normalized authoritative period flows. Upstream line-item structures are
 * intentionally excluded from the P&L calculation boundary.
 */
export interface ProfitAndLossYearInput {
  readonly year: ProjectionYear;
  readonly revenue: MonetaryAmount;
  readonly operatingExpenses: MonetaryAmount;
  readonly depreciation: MonetaryAmount;
  readonly interestExpense: MonetaryAmount;
}

export interface ProfitAndLossProjectionInput {
  readonly projectId: Identifier;
  readonly years: readonly ProfitAndLossYearInput[];
  readonly taxConfiguration: ProfitAndLossTaxConfiguration;
}

export interface ProfitAndLossYear {
  readonly year: ProjectionYear;
  readonly revenue: MonetaryAmount;
  readonly operatingExpenses: MonetaryAmount;
  readonly ebitda: MonetaryAmount;
  readonly depreciation: MonetaryAmount;
  readonly ebit: MonetaryAmount;
  readonly interestExpense: MonetaryAmount;
  readonly profitBeforeTax: MonetaryAmount;
  readonly taxMode: ProfitAndLossTaxMode;
  readonly taxRateApplied?: Percentage;
  readonly taxExpense: MonetaryAmount;
  readonly profitAfterTax: MonetaryAmount;
}

export interface ProfitAndLossCumulativeTotals {
  readonly cumulativeRevenue: MonetaryAmount;
  readonly cumulativeOperatingExpenses: MonetaryAmount;
  readonly cumulativeEbitda: MonetaryAmount;
  readonly cumulativeDepreciation: MonetaryAmount;
  readonly cumulativeEbit: MonetaryAmount;
  readonly cumulativeInterestExpense: MonetaryAmount;
  readonly cumulativeProfitBeforeTax: MonetaryAmount;
  readonly cumulativeTaxExpense: MonetaryAmount;
  readonly cumulativeProfitAfterTax: MonetaryAmount;
}

export interface ProfitAndLossSchedule {
  readonly projectId: Identifier;
  readonly taxConfiguration: ProfitAndLossTaxConfiguration;
  readonly years: readonly ProfitAndLossYear[];
  readonly cumulativeTotals: ProfitAndLossCumulativeTotals;
}

/**
 * Explicit P&L interest boundary. The caller is responsible for deciding which
 * loan interest is an expense after considering capitalization and accrual.
 */
export interface ProfitAndLossInterestExpenseYear {
  readonly year: ProjectionYear;
  readonly interestExpense: MonetaryAmount;
  /** Loan cash flows and balances are forbidden at this normalized boundary. */
  readonly principalRepayment?: never;
  readonly principalRepaid?: never;
  readonly totalDebtService?: never;
  readonly loanDisbursement?: never;
  readonly closingPrincipal?: never;
  /** The engine must not choose an accounting basis from loan schedule fields. */
  readonly interestCharged?: never;
  readonly interestPaid?: never;
  readonly capitalizedInterest?: never;
  readonly accruedInterest?: never;
}

export interface ProfitAndLossInterestExpenseSchedule {
  readonly projectId: Identifier;
  readonly years: readonly ProfitAndLossInterestExpenseYear[];
}

export const missingAuthoritativeValueTreatments = [
  "ERROR",
  "USE_EXPLICIT_ZERO",
] as const;
export type MissingAuthoritativeValueTreatment =
  (typeof missingAuthoritativeValueTreatments)[number];

export interface ProfitAndLossCompositionPolicy {
  readonly missingDepreciation: MissingAuthoritativeValueTreatment;
  readonly missingInterestExpense: MissingAuthoritativeValueTreatment;
}
