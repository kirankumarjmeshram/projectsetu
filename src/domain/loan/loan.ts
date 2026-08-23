import type { Assumption } from "../shared/assumptions";
import type {
  DecimalValue,
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
  "YEARLY",
] as const;
export type RepaymentFrequency = (typeof repaymentFrequencies)[number];

export const repaymentMethods = ["EQUAL_PRINCIPAL", "EMI"] as const;
export type RepaymentMethod = (typeof repaymentMethods)[number];

export const moratoriumTypes = ["PRINCIPAL_ONLY", "FULL_PAYMENT"] as const;
export type MoratoriumType = (typeof moratoriumTypes)[number];

export const moratoriumInterestTreatments = [
  "PAY_CURRENT",
  "ACCRUE",
  "CAPITALIZE",
] as const;
export type MoratoriumInterestTreatment =
  (typeof moratoriumInterestTreatments)[number];

export interface LoanMoratorium {
  readonly type: MoratoriumType;
  /** Whole schedule periods at the configured repayment frequency. */
  readonly periods: number;
  readonly interestTreatment: MoratoriumInterestTreatment;
}

export interface LoanTerms {
  readonly id: Identifier;
  readonly type: LoanType;
  readonly principal: Assumption<MonetaryAmount>;
  readonly annualInterestRate: Assumption<Percentage>;
  /** Total schedule periods, including any moratorium periods. */
  readonly repaymentPeriods: number;
  readonly repaymentFrequency: RepaymentFrequency;
  readonly repaymentMethod: RepaymentMethod;
  readonly moratorium?: LoanMoratorium;
  readonly workingCapitalInterestRate?: Assumption<Percentage>;
  readonly termLoanInterestRate?: Assumption<Percentage>;
  readonly notes?: string;
}

export const loanRepaymentPhases = ["MORATORIUM", "AMORTIZATION"] as const;
export type LoanRepaymentPhase = (typeof loanRepaymentPhases)[number];

export interface LoanRepaymentPeriod {
  readonly sequence: number;
  readonly projectionYear: ProjectionYear;
  readonly phase: LoanRepaymentPhase;
  readonly openingPrincipal: MonetaryAmount;
  /** Decimal factor for the schedule period; for example, 1% is `"0.01"`. */
  readonly periodicInterestRate: DecimalValue;
  readonly interestCharged: MonetaryAmount;
  readonly principalRepayment: MonetaryAmount;
  readonly interestPayment: MonetaryAmount;
  readonly totalPayment: MonetaryAmount;
  readonly capitalizedInterest: MonetaryAmount;
  readonly openingAccruedInterest: MonetaryAmount;
  readonly accruedInterestAdded: MonetaryAmount;
  readonly closingAccruedInterest: MonetaryAmount;
  readonly closingPrincipal: MonetaryAmount;
}

export interface LoanRepaymentSummary {
  readonly originalPrincipal: MonetaryAmount;
  readonly totalPrincipalRepaid: MonetaryAmount;
  readonly totalInterestCharged: MonetaryAmount;
  readonly totalInterestPaid: MonetaryAmount;
  readonly totalRepayments: MonetaryAmount;
  readonly totalCapitalizedInterest: MonetaryAmount;
  readonly endingPrincipal: MonetaryAmount;
  readonly endingAccruedInterest: MonetaryAmount;
  readonly numberOfSchedulePeriods: number;
  readonly numberOfAmortizationPeriods: number;
}

export interface AnnualLoanRepaymentSummary {
  readonly projectionYear: ProjectionYear;
  readonly openingPrincipal: MonetaryAmount;
  readonly principalRepaid: MonetaryAmount;
  readonly interestCharged: MonetaryAmount;
  readonly interestPaid: MonetaryAmount;
  readonly totalDebtService: MonetaryAmount;
  readonly closingPrincipal: MonetaryAmount;
  readonly openingAccruedInterest: MonetaryAmount;
  readonly closingAccruedInterest: MonetaryAmount;
}

export interface LoanRepaymentSchedule {
  readonly loanId: Identifier;
  readonly repaymentMethod: RepaymentMethod;
  readonly repaymentFrequency: RepaymentFrequency;
  readonly periodicInterestRate: DecimalValue;
  readonly periods: readonly LoanRepaymentPeriod[];
  readonly summary: LoanRepaymentSummary;
  readonly annualSummaries: readonly AnnualLoanRepaymentSummary[];
}
