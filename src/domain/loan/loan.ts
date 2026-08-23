import type { Assumption } from "../shared/assumptions";
import type {
  Identifier,
  MonetaryAmount,
  Percentage,
  ProjectionYear,
} from "../shared/types";

export const loanTypes = [
  "TERM_LOAN",
  "WORKING_CAPITAL",
  "BRIDGE_FINANCE",
  "OTHER",
] as const;
export type LoanType = (typeof loanTypes)[number];

export const repaymentFrequencies = [
  "MONTHLY",
  "QUARTERLY",
  "HALF_YEARLY",
  "ANNUALLY",
  "CUSTOM",
] as const;
export type RepaymentFrequency = (typeof repaymentFrequencies)[number];

export interface LoanTerms {
  readonly id: Identifier;
  readonly type: LoanType;
  readonly principal: Assumption<MonetaryAmount>;
  readonly annualInterestRate: Assumption<Percentage>;
  readonly moratoriumPeriods?: number;
  readonly repaymentPeriods: number;
  readonly repaymentFrequency: RepaymentFrequency;
  readonly workingCapitalInterestRate?: Assumption<Percentage>;
  readonly termLoanInterestRate?: Assumption<Percentage>;
  readonly notes?: string;
}

export interface LoanRepaymentScheduleRow {
  readonly period: number;
  readonly projectionYear?: ProjectionYear;
  readonly openingBalance: MonetaryAmount;
  readonly principalRepayment: MonetaryAmount;
  readonly interest: MonetaryAmount;
  readonly closingBalance: MonetaryAmount;
}

export interface LoanRepaymentSchedule {
  readonly loanId: Identifier;
  readonly rows: readonly LoanRepaymentScheduleRow[];
}
