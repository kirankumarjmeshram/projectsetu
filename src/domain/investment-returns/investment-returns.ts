import type { Assumption } from "../shared/assumptions";
import type {
  DecimalValue,
  Identifier,
  MonetaryAmount,
  Percentage,
} from "../shared/types";

export const investmentReturnPerspectives = [
  "PROJECT_RETURN",
  "EQUITY_RETURN",
] as const;
export type InvestmentReturnPerspective =
  (typeof investmentReturnPerspectives)[number];

/** Equally spaced annual period: 0 is the investment point, 1 is Year 1 end. */
export interface InvestmentCashFlowPeriod {
  readonly periodIndex: number;
  readonly cashFlow: MonetaryAmount;
}

/** The calculation boundary contains authoritative net investment cash flows only. */
export interface InvestmentCashFlowSeries {
  readonly projectId: Identifier;
  readonly perspective: InvestmentReturnPerspective;
  readonly periods: readonly InvestmentCashFlowPeriod[];
}

export interface InvestmentReturnsAnalysisInput {
  readonly series: InvestmentCashFlowSeries;
  /** Per-period percent-point rate; supplied explicitly and never inferred. */
  readonly discountRate: Assumption<Percentage>;
}

export const investmentReturnMetricStatuses = [
  "DEFINED",
  "UNDEFINED_NO_SIGN_CHANGE",
  "AMBIGUOUS_MULTIPLE_IRR_POSSIBLE",
  "NOT_RECOVERED_WITHIN_HORIZON",
  "UNDEFINED_ZERO_INITIAL_INVESTMENT",
  "INVALID_CASH_FLOW_PATTERN",
  "NUMERICAL_CONVERGENCE_FAILURE",
] as const;
export type InvestmentReturnMetricStatus =
  (typeof investmentReturnMetricStatuses)[number];
export type UndefinedInvestmentReturnMetricStatus = Exclude<
  InvestmentReturnMetricStatus,
  "DEFINED"
>;

export interface DefinedInvestmentReturnMetric<TValue extends DecimalValue> {
  readonly status: "DEFINED";
  readonly value: TValue;
}

export interface UndefinedInvestmentReturnMetric {
  readonly status: UndefinedInvestmentReturnMetricStatus;
  readonly value?: never;
}

export type InvestmentReturnMetric<TValue extends DecimalValue = DecimalValue> =
  DefinedInvestmentReturnMetric<TValue> | UndefinedInvestmentReturnMetric;

/** Multiplier convention: present value = cash flow × discount factor. */
export interface DiscountedCashFlowRow extends InvestmentCashFlowPeriod {
  readonly discountRate: Percentage;
  readonly discountFactor: DecimalValue;
  readonly presentValue: MonetaryAmount;
  readonly cumulativePresentValue: MonetaryAmount;
}

export interface NetPresentValueResult {
  readonly projectId: Identifier;
  readonly perspective: InvestmentReturnPerspective;
  readonly discountRate: Percentage;
  readonly rows: readonly DiscountedCashFlowRow[];
  readonly npv: MonetaryAmount;
}

export interface IrrSearchPolicy {
  readonly maximumIterations: number;
  readonly maximumBracketExpansions: number;
  /** Rate-factor tolerance: `0.0001` means one basis point in factor terms. */
  readonly rateTolerance: DecimalValue;
  readonly npvTolerance: MonetaryAmount;
}

export interface InternalRateOfReturnResult {
  readonly projectId: Identifier;
  readonly perspective: InvestmentReturnPerspective;
  readonly signChangeCount: number;
  readonly iterations: number;
  readonly irr: InvestmentReturnMetric<Percentage>;
  /** Present only for a defined result and evaluated using Decimal.js. */
  readonly residualNpv?: MonetaryAmount;
}

export interface PaybackCashFlowRow extends InvestmentCashFlowPeriod {
  readonly cumulativeCashFlow: MonetaryAmount;
}

export interface SimplePaybackResult {
  readonly projectId: Identifier;
  readonly perspective: InvestmentReturnPerspective;
  readonly rows: readonly PaybackCashFlowRow[];
  readonly paybackPeriod: InvestmentReturnMetric;
  readonly recoveryPeriodIndex?: number;
}

export interface DiscountedPaybackResult {
  readonly projectId: Identifier;
  readonly perspective: InvestmentReturnPerspective;
  readonly discountRate: Percentage;
  readonly rows: readonly DiscountedCashFlowRow[];
  readonly paybackPeriod: InvestmentReturnMetric;
  readonly recoveryPeriodIndex?: number;
}

export interface ProfitabilityIndexResult {
  readonly projectId: Identifier;
  readonly perspective: InvestmentReturnPerspective;
  readonly discountRate: Percentage;
  readonly initialInvestment: MonetaryAmount;
  readonly presentValueOfFuturePositiveCashFlows: MonetaryAmount;
  readonly profitabilityIndex: InvestmentReturnMetric;
}

export interface InvestmentReturnsAnalysis {
  readonly projectId: Identifier;
  readonly perspective: InvestmentReturnPerspective;
  readonly series: InvestmentCashFlowSeries;
  readonly discountRate: Assumption<Percentage>;
  readonly netPresentValue: NetPresentValueResult;
  readonly internalRateOfReturn: InternalRateOfReturnResult;
  readonly simplePayback: SimplePaybackResult;
  readonly discountedPayback: DiscountedPaybackResult;
  readonly profitabilityIndex: ProfitabilityIndexResult;
}

export interface ProjectInvestmentCashFlowComponents {
  /** Project resources deployed at period 0; not promoter or loan financing. */
  readonly initialInvestment: Assumption<MonetaryAmount>;
  /** Explicitly normalized project operating cash generation, not PAT. */
  readonly operatingProjectCashFlow: Assumption<MonetaryAmount>;
  readonly workingCapitalInvestment: Assumption<MonetaryAmount>;
  readonly capitalExpenditure: Assumption<MonetaryAmount>;
  /** Optional: omission contributes zero and never triggers inference. */
  readonly terminalValue?: Assumption<MonetaryAmount>;
  /** Optional: omission contributes zero and never triggers inference. */
  readonly workingCapitalRecovery?: Assumption<MonetaryAmount>;
  readonly otherExplicitInvestmentCashFlow: Assumption<MonetaryAmount>;
}

export interface ProjectInvestmentCashFlowPeriodInput {
  readonly periodIndex: number;
  readonly components: ProjectInvestmentCashFlowComponents;
  /** Financing and accounting outputs are forbidden at this boundary. */
  readonly loanDisbursement?: never;
  readonly promoterContribution?: never;
  readonly principalRepayment?: never;
  readonly cashInterestPaid?: never;
  readonly profitAfterTax?: never;
  readonly ebitda?: never;
  readonly ebit?: never;
  readonly closingCash?: never;
  readonly netCashMovement?: never;
}

export interface ProjectInvestmentCashFlowCompositionInput {
  readonly projectId: Identifier;
  readonly periods: readonly ProjectInvestmentCashFlowPeriodInput[];
}

export interface ProjectInvestmentCashFlowPeriod extends InvestmentCashFlowPeriod {
  readonly components: ProjectInvestmentCashFlowComponents;
}

export interface ProjectInvestmentCashFlowSeries extends InvestmentCashFlowSeries {
  readonly perspective: "PROJECT_RETURN";
  readonly periods: readonly ProjectInvestmentCashFlowPeriod[];
}
