import type { Assumption } from "../shared/assumptions";
import type {
  DecimalValue,
  Identifier,
  MonetaryAmount,
  Percentage,
  ProjectionYear,
} from "../shared/types";

export const metricStatuses = [
  "DEFINED",
  "UNDEFINED_ZERO_DENOMINATOR",
  "UNDEFINED_NEGATIVE_EQUITY",
  "UNDEFINED_NON_POSITIVE_CONTRIBUTION",
  "UNDEFINED_NEGATIVE_CAPITAL_EMPLOYED",
] as const;
export type MetricStatus = (typeof metricStatuses)[number];
export type UndefinedMetricStatus = Exclude<MetricStatus, "DEFINED">;

export interface DefinedMetricResult<TValue extends DecimalValue> {
  readonly status: "DEFINED";
  readonly value: TValue;
}

export interface UndefinedMetricResult {
  readonly status: UndefinedMetricStatus;
  readonly value?: never;
}

/** No metric result can contain NaN, Infinity, or an invented zero. */
export type MetricResult<TValue extends DecimalValue = DecimalValue> =
  DefinedMetricResult<TValue> | UndefinedMetricResult;

export interface DscrYearInput {
  readonly year: ProjectionYear;
  readonly profitAfterTax: MonetaryAmount;
  readonly depreciation: MonetaryAmount;
  readonly interestExpense: MonetaryAmount;
  readonly principalRepayment: MonetaryAmount;
}

export interface DscrYearResult extends DscrYearInput {
  readonly cashAvailableForDebtService: MonetaryAmount;
  readonly debtService: MonetaryAmount;
  readonly dscr: MetricResult;
}

export interface AverageDscrResult {
  /** Totals include only years with positive debt service. */
  readonly totalCashAvailableForDebtService: MonetaryAmount;
  readonly totalDebtService: MonetaryAmount;
  readonly averageDscr: MetricResult;
}

export interface InterestCoverageYearInput {
  readonly year: ProjectionYear;
  readonly ebit: MonetaryAmount;
  readonly interestExpense: MonetaryAmount;
}

export interface InterestCoverageYearResult extends InterestCoverageYearInput {
  readonly interestCoverageRatio: MetricResult;
}

export interface DebtEquityYearInput {
  readonly year: ProjectionYear;
  readonly longTermDebt: MonetaryAmount;
  readonly currentDebt: MonetaryAmount;
  readonly totalEquity: MonetaryAmount;
}

export interface DebtEquityYearResult extends DebtEquityYearInput {
  readonly interestBearingDebt: MonetaryAmount;
  readonly debtEquityRatio: MetricResult;
}

export interface CurrentRatioYearInput {
  readonly year: ProjectionYear;
  readonly totalCurrentAssets: MonetaryAmount;
  readonly totalCurrentLiabilities: MonetaryAmount;
}

export interface CurrentRatioYearResult extends CurrentRatioYearInput {
  readonly currentRatio: MetricResult;
}

export interface BreakEvenYearInput {
  readonly year: ProjectionYear;
  readonly revenue: MonetaryAmount;
  readonly variableCosts: MonetaryAmount;
  readonly fixedCosts: MonetaryAmount;
}

export interface BreakEvenYearResult extends BreakEvenYearInput {
  readonly contribution: MonetaryAmount;
  /** A decimal factor: `"0.4"` means a 40% contribution margin. */
  readonly contributionMarginRatio: MetricResult;
  readonly breakEvenSales: MetricResult<MonetaryAmount>;
  readonly breakEvenPercentage: MetricResult<Percentage>;
}

export interface RoiYearInput {
  readonly year: ProjectionYear;
  readonly profitAfterTax: MonetaryAmount;
  readonly totalProjectCost: MonetaryAmount;
}

export interface RoiYearResult extends RoiYearInput {
  readonly roi: MetricResult<Percentage>;
}

export interface RoceYearInput {
  readonly year: ProjectionYear;
  readonly ebit: MonetaryAmount;
  readonly totalAssets: MonetaryAmount;
  readonly totalCurrentLiabilities: MonetaryAmount;
}

export interface RoceYearResult extends RoceYearInput {
  readonly capitalEmployed: MonetaryAmount;
  readonly roce: MetricResult<Percentage>;
}

export interface ProfitabilityMarginYearInput {
  readonly year: ProjectionYear;
  readonly revenue: MonetaryAmount;
  readonly ebitda: MonetaryAmount;
  readonly ebit: MonetaryAmount;
  readonly profitBeforeTax: MonetaryAmount;
  readonly profitAfterTax: MonetaryAmount;
}

export interface ProfitabilityMarginYearResult extends ProfitabilityMarginYearInput {
  readonly ebitdaMargin: MetricResult<Percentage>;
  readonly ebitMargin: MetricResult<Percentage>;
  readonly pbtMargin: MetricResult<Percentage>;
  readonly patMargin: MetricResult<Percentage>;
}

/** Explicit normalized boundary for calculating every Task 011 yearly metric. */
export interface BankabilityMetricsYearInput {
  readonly year: ProjectionYear;
  readonly revenue: MonetaryAmount;
  readonly variableCosts: MonetaryAmount;
  readonly fixedCosts: MonetaryAmount;
  readonly ebitda: MonetaryAmount;
  readonly ebit: MonetaryAmount;
  readonly profitBeforeTax: MonetaryAmount;
  readonly profitAfterTax: MonetaryAmount;
  readonly depreciation: MonetaryAmount;
  readonly interestExpense: MonetaryAmount;
  readonly principalRepayment: MonetaryAmount;
  readonly longTermDebt: MonetaryAmount;
  readonly currentDebt: MonetaryAmount;
  readonly totalCurrentAssets: MonetaryAmount;
  readonly totalCurrentLiabilities: MonetaryAmount;
  readonly totalAssets: MonetaryAmount;
  readonly totalEquity: MonetaryAmount;
  readonly totalProjectCost: MonetaryAmount;
}

export interface BankabilityMetricsYearResult extends BankabilityMetricsYearInput {
  readonly cashAvailableForDebtService: MonetaryAmount;
  readonly debtService: MonetaryAmount;
  readonly dscr: MetricResult;
  readonly interestCoverageRatio: MetricResult;
  readonly interestBearingDebt: MonetaryAmount;
  readonly debtEquityRatio: MetricResult;
  readonly currentRatio: MetricResult;
  readonly contribution: MonetaryAmount;
  readonly contributionMarginRatio: MetricResult;
  readonly breakEvenSales: MetricResult<MonetaryAmount>;
  readonly breakEvenPercentage: MetricResult<Percentage>;
  readonly roi: MetricResult<Percentage>;
  readonly capitalEmployed: MonetaryAmount;
  readonly roce: MetricResult<Percentage>;
  readonly ebitdaMargin: MetricResult<Percentage>;
  readonly ebitMargin: MetricResult<Percentage>;
  readonly pbtMargin: MetricResult<Percentage>;
  readonly patMargin: MetricResult<Percentage>;
}

export interface BankabilityMetricsProjectionInput {
  readonly projectId: Identifier;
  readonly years: readonly BankabilityMetricsYearInput[];
}

export interface BankabilityMetricsSchedule {
  readonly projectId: Identifier;
  readonly years: readonly BankabilityMetricsYearResult[];
  readonly averageDscr: AverageDscrResult;
}

export interface MetricsProfitAndLossYear {
  readonly year: ProjectionYear;
  readonly revenue: MonetaryAmount;
  readonly ebitda: MonetaryAmount;
  readonly ebit: MonetaryAmount;
  readonly profitBeforeTax: MonetaryAmount;
  readonly profitAfterTax: MonetaryAmount;
  readonly depreciation: MonetaryAmount;
  readonly interestExpense: MonetaryAmount;
}

export interface MetricsProfitAndLossSchedule {
  readonly projectId: Identifier;
  readonly years: readonly MetricsProfitAndLossYear[];
}

/** Principal only; recognized interest comes from the authoritative P&L. */
export interface MetricsDebtServiceYear {
  readonly year: ProjectionYear;
  readonly principalRepayment: MonetaryAmount;
  readonly interestExpense?: never;
  readonly interestCharged?: never;
  readonly interestPaid?: never;
  readonly totalDebtService?: never;
  readonly closingPrincipal?: never;
}

export interface MetricsDebtServiceSchedule {
  readonly projectId: Identifier;
  readonly years: readonly MetricsDebtServiceYear[];
}

export interface MetricsBalanceSheetYear {
  readonly year: ProjectionYear;
  readonly totalCurrentAssets: MonetaryAmount;
  readonly totalCurrentLiabilities: MonetaryAmount;
  readonly totalAssets: MonetaryAmount;
  readonly totalEquity: MonetaryAmount;
  readonly longTermDebt: MonetaryAmount;
  readonly currentDebt: MonetaryAmount;
}

export interface MetricsBalanceSheetSchedule {
  readonly projectId: Identifier;
  readonly years: readonly MetricsBalanceSheetYear[];
}

export interface MetricsProjectCost {
  readonly projectId: Identifier;
  readonly totalProjectCost: MonetaryAmount;
}

export const operatingCostClassifications = ["FIXED", "VARIABLE"] as const;
export type OperatingCostClassification =
  (typeof operatingCostClassifications)[number];

export interface ProjectionExpenseCostClassification {
  readonly expenseId: Identifier;
  readonly classification: Assumption<OperatingCostClassification>;
}

export interface ProjectionCostClassification {
  readonly projectId: Identifier;
  readonly expenses: readonly ProjectionExpenseCostClassification[];
}

export interface MetricsBreakEvenSchedule {
  readonly projectId: Identifier;
  readonly years: readonly BreakEvenYearInput[];
}

export interface BankabilityMetricsAuthoritativeSchedules {
  readonly profitAndLoss: MetricsProfitAndLossSchedule;
  readonly debtService: MetricsDebtServiceSchedule;
  readonly balanceSheet: MetricsBalanceSheetSchedule;
  readonly projectCost: MetricsProjectCost;
  readonly breakEven: MetricsBreakEvenSchedule;
}

/** Compatibility surface consumed by the sensitivity result contract. */
export type FinancialMetricResults = BankabilityMetricsSchedule;
