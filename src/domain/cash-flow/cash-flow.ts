import type { Assumption } from "../shared/assumptions";
import type {
  Identifier,
  MonetaryAmount,
  ProjectionYear,
} from "../shared/types";

/** Normalized authoritative period flows consumed by the indirect method. */
export interface CashFlowYearInput {
  readonly year: ProjectionYear;
  readonly profitAfterTax: MonetaryAmount;
  readonly depreciation: MonetaryAmount;
  /** Current-year NWC less prior-year NWC; positive is a cash outflow. */
  readonly changeInNetWorkingCapital: MonetaryAmount;
  readonly capitalExpenditure: MonetaryAmount;
  readonly promoterContribution: MonetaryAmount;
  readonly loanDisbursement: MonetaryAmount;
  readonly principalRepayment: MonetaryAmount;
  readonly cashInterestPaid: MonetaryAmount;
}

export interface CashFlowProjectionInput {
  readonly projectId: Identifier;
  readonly initialOpeningCash: Assumption<MonetaryAmount>;
  readonly years: readonly CashFlowYearInput[];
}

export interface CashFlowYear {
  readonly year: ProjectionYear;
  readonly openingCash: MonetaryAmount;
  readonly profitAfterTax: MonetaryAmount;
  readonly depreciationAddBack: MonetaryAmount;
  readonly changeInNetWorkingCapital: MonetaryAmount;
  readonly operatingCashFlow: MonetaryAmount;
  readonly capitalExpenditure: MonetaryAmount;
  readonly investingCashFlow: MonetaryAmount;
  readonly promoterContribution: MonetaryAmount;
  readonly loanDisbursement: MonetaryAmount;
  readonly principalRepayment: MonetaryAmount;
  readonly cashInterestPaid: MonetaryAmount;
  readonly financingCashFlow: MonetaryAmount;
  readonly netCashMovement: MonetaryAmount;
  readonly closingCash: MonetaryAmount;
  readonly cumulativeOperatingCashFlow: MonetaryAmount;
  readonly cumulativeInvestingCashFlow: MonetaryAmount;
  readonly cumulativeFinancingCashFlow: MonetaryAmount;
  readonly cumulativeNetCashMovement: MonetaryAmount;
}

export interface CashFlowCumulativeTotals {
  readonly cumulativeOperatingCashFlow: MonetaryAmount;
  readonly cumulativeInvestingCashFlow: MonetaryAmount;
  readonly cumulativeFinancingCashFlow: MonetaryAmount;
  readonly cumulativeNetCashMovement: MonetaryAmount;
  readonly endingCash: MonetaryAmount;
}

export interface CashFlowSchedule {
  readonly projectId: Identifier;
  readonly initialOpeningCash: Assumption<MonetaryAmount>;
  readonly years: readonly CashFlowYear[];
  readonly cumulativeTotals: CashFlowCumulativeTotals;
}

export interface CashFlowWorkingCapitalChangeYear {
  readonly year: ProjectionYear;
  readonly changeInNetWorkingCapital: MonetaryAmount;
}

export interface CashFlowWorkingCapitalChangeSchedule {
  readonly projectId: Identifier;
  readonly years: readonly CashFlowWorkingCapitalChangeYear[];
}

/** Balance-derived changes that retain the source-backed Year 1 opening NWC. */
export interface CashFlowDerivedWorkingCapitalChangeSchedule extends CashFlowWorkingCapitalChangeSchedule {
  readonly openingNetWorkingCapital: Assumption<MonetaryAmount>;
}

export interface CashFlowCapitalExpenditureYear {
  readonly year: ProjectionYear;
  readonly capitalExpenditure: MonetaryAmount;
  readonly depreciation?: never;
  readonly accumulatedDepreciation?: never;
  readonly closingCarryingValue?: never;
  readonly closingNetCarryingValue?: never;
}

export interface CashFlowCapitalExpenditureSchedule {
  readonly projectId: Identifier;
  readonly years: readonly CashFlowCapitalExpenditureYear[];
}

export interface CashFlowFinancingInflowYear {
  readonly year: ProjectionYear;
  readonly promoterContribution: MonetaryAmount;
  readonly loanDisbursement: MonetaryAmount;
}

export interface CashFlowFinancingInflowSchedule {
  readonly projectId: Identifier;
  readonly years: readonly CashFlowFinancingInflowYear[];
}

export interface CashFlowLoanPaymentYear {
  readonly year: ProjectionYear;
  readonly principalRepayment: MonetaryAmount;
  readonly cashInterestPaid: MonetaryAmount;
  /** Non-cash and balance fields are forbidden from this payment boundary. */
  readonly interestCharged?: never;
  readonly accruedInterest?: never;
  readonly capitalizedInterest?: never;
  readonly totalDebtService?: never;
  readonly loanDisbursement?: never;
  readonly closingPrincipal?: never;
}

export interface CashFlowLoanPaymentSchedule {
  readonly projectId: Identifier;
  readonly years: readonly CashFlowLoanPaymentYear[];
}

export const cashFlowMissingValueTreatments = [
  "ERROR",
  "USE_EXPLICIT_ZERO",
] as const;
export type CashFlowMissingValueTreatment =
  (typeof cashFlowMissingValueTreatments)[number];

export interface CashFlowCompositionPolicy {
  readonly missingWorkingCapitalChange: CashFlowMissingValueTreatment;
  readonly missingCapitalExpenditure: CashFlowMissingValueTreatment;
  readonly missingFinancingInflows: CashFlowMissingValueTreatment;
  readonly missingLoanCashPayments: CashFlowMissingValueTreatment;
}
