import type {
  DecimalValue,
  Identifier,
  MonetaryAmount,
  Percentage,
  ProjectionYear,
} from "../shared/types";

export interface YearlyRatio {
  readonly year: ProjectionYear;
  readonly value: DecimalValue;
}

export interface BreakEvenResult {
  readonly projectId: Identifier;
  readonly yearlyBreakEven: readonly YearlyRatio[];
}

export interface DSCRResult {
  readonly projectId: Identifier;
  readonly yearlyDSCR: readonly YearlyRatio[];
  readonly averageDSCR: DecimalValue;
}

export const irrTypes = ["PROJECT_IRR", "EQUITY_IRR"] as const;
export type IRRType = (typeof irrTypes)[number];

export interface IRRResult {
  readonly projectId: Identifier;
  readonly type: IRRType;
  readonly rate: Percentage;
}

export interface NPVResult {
  readonly projectId: Identifier;
  readonly netPresentValue: MonetaryAmount;
  readonly discountRate: Percentage;
}

export interface ROIResult {
  readonly projectId: Identifier;
  readonly yearlyROI?: readonly YearlyRatio[];
  readonly overallROI?: Percentage;
}

export interface PaybackPeriodResult {
  readonly projectId: Identifier;
  readonly periods: string;
}

export const financialRatioTypes = [
  "CURRENT_RATIO",
  "DEBT_EQUITY_RATIO",
  "TOL_TO_TNW",
  "GROSS_PROFIT_MARGIN",
  "EBITDA_MARGIN",
  "NET_PROFIT_MARGIN",
  "INTEREST_COVERAGE_RATIO",
  "FIXED_ASSET_TURNOVER",
  "INVENTORY_TURNOVER",
  "RECEIVABLE_DAYS",
  "ROCE",
  "ROE",
] as const;
export type FinancialRatioType = (typeof financialRatioTypes)[number];

export interface FinancialRatioResult {
  readonly projectId: Identifier;
  readonly type: FinancialRatioType;
  readonly yearlyValues: readonly YearlyRatio[];
}

export interface FinancialMetricResults {
  readonly breakEven?: BreakEvenResult;
  readonly dscr?: DSCRResult;
  readonly irr?: readonly IRRResult[];
  readonly npv?: NPVResult;
  readonly roi?: ROIResult;
  readonly paybackPeriod?: PaybackPeriodResult;
  readonly ratios?: readonly FinancialRatioResult[];
}
