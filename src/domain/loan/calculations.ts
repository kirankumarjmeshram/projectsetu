import type {
  CalculationError,
  CalculationResult,
} from "../shared/calculation";
import { calculationFailure, calculationSuccess } from "../shared/calculation";
import {
  decimalValue,
  monetaryAmount,
  percentageToFactor,
  toDecimal,
  toDecimalValue,
  toMonetaryAmount,
} from "../shared/decimal";
import type { DecimalValue, MonetaryAmount, Percentage } from "../shared/types";
import type {
  AnnualLoanRepaymentSummary,
  LoanMoratorium,
  LoanRepaymentPeriod,
  LoanRepaymentSchedule,
  LoanRepaymentSummary,
  LoanTerms,
  RepaymentFrequency,
} from "./loan";

const zeroAmount = monetaryAmount("0");
const one = decimalValue("1");

interface FrequencyConvention {
  readonly periodsPerYear: number;
  readonly decimalPeriodsPerYear: DecimalValue;
}

function getFrequencyConvention(
  frequency: RepaymentFrequency,
): FrequencyConvention | undefined {
  switch (frequency) {
    case "MONTHLY":
      return { periodsPerYear: 12, decimalPeriodsPerYear: decimalValue("12") };
    case "QUARTERLY":
      return { periodsPerYear: 4, decimalPeriodsPerYear: decimalValue("4") };
    case "HALF_YEARLY":
      return { periodsPerYear: 2, decimalPeriodsPerYear: decimalValue("2") };
    case "YEARLY":
      return { periodsPerYear: 1, decimalPeriodsPerYear: decimalValue("1") };
  }
}

function getProjectionYear(sequence: number, periodsPerYear: number): number {
  let projectionYear = 1;
  let periodsRemaining = sequence;

  while (periodsRemaining > periodsPerYear) {
    periodsRemaining -= periodsPerYear;
    projectionYear += 1;
  }

  return projectionYear;
}

export function calculatePeriodicInterestRate(
  annualInterestRate: Percentage,
  repaymentFrequency: RepaymentFrequency,
): CalculationResult<DecimalValue> {
  const convention = getFrequencyConvention(repaymentFrequency);

  if (!convention) {
    return calculationFailure({
      code: "UNSUPPORTED_REPAYMENT_FREQUENCY",
      message: "The repayment frequency is not supported by the loan engine.",
      path: "repaymentFrequency",
    });
  }

  return calculationSuccess(
    toDecimalValue(
      percentageToFactor(annualInterestRate).dividedBy(
        toDecimal(convention.decimalPeriodsPerYear),
      ),
    ),
  );
}

export function calculatePeriodInterest(
  openingPrincipal: MonetaryAmount,
  periodicInterestRate: DecimalValue,
): MonetaryAmount {
  return toMonetaryAmount(
    toDecimal(openingPrincipal).times(toDecimal(periodicInterestRate)),
  );
}

function validatePositivePeriodCount(
  periods: number,
  path: string,
): CalculationError | undefined {
  if (!Number.isInteger(periods) || periods <= 0) {
    return {
      code: "INVALID_REPAYMENT_PERIODS",
      message: "Repayment periods must be a positive integer.",
      path,
    };
  }
}

function validateNonNegativePrincipal(
  principal: MonetaryAmount,
): CalculationError | undefined {
  if (toDecimal(principal).isNegative()) {
    return {
      code: "INVALID_LOAN_PRINCIPAL",
      message: "Loan principal must not be negative.",
      path: "principal",
    };
  }
}

export function calculateEqualPrincipalAmount(
  principal: MonetaryAmount,
  repaymentPeriods: number,
): CalculationResult<MonetaryAmount> {
  const periodError = validatePositivePeriodCount(
    repaymentPeriods,
    "repaymentPeriods",
  );
  const principalError = validateNonNegativePrincipal(principal);

  if (periodError || principalError) {
    return calculationFailure(
      ...[periodError, principalError].filter(
        (error): error is CalculationError => error !== undefined,
      ),
    );
  }

  return calculationSuccess(
    toMonetaryAmount(
      toDecimal(principal).dividedBy(decimalValue(String(repaymentPeriods))),
    ),
  );
}

export function calculateEmiPayment(
  principal: MonetaryAmount,
  periodicInterestRate: DecimalValue,
  repaymentPeriods: number,
): CalculationResult<MonetaryAmount> {
  const periodError = validatePositivePeriodCount(
    repaymentPeriods,
    "repaymentPeriods",
  );
  const principalError = validateNonNegativePrincipal(principal);

  if (periodError || principalError) {
    return calculationFailure(
      ...[periodError, principalError].filter(
        (error): error is CalculationError => error !== undefined,
      ),
    );
  }

  const principalValue = toDecimal(principal);
  const rate = toDecimal(periodicInterestRate);

  if (rate.isNegative()) {
    return calculationFailure({
      code: "INVALID_PERIODIC_INTEREST_RATE",
      message: "Periodic interest rate must not be negative.",
      path: "periodicInterestRate",
    });
  }

  if (principalValue.isZero()) {
    return calculationSuccess(zeroAmount);
  }

  const periodCount = decimalValue(String(repaymentPeriods));

  if (rate.isZero()) {
    return calculationSuccess(
      toMonetaryAmount(principalValue.dividedBy(toDecimal(periodCount))),
    );
  }

  const compoundFactor = toDecimal(one).plus(rate).pow(repaymentPeriods);
  const payment = principalValue
    .times(rate)
    .times(compoundFactor)
    .dividedBy(compoundFactor.minus(toDecimal(one)));

  return calculationSuccess(toMonetaryAmount(payment));
}

function validateMoratorium(
  moratorium: LoanMoratorium | undefined,
  totalPeriods: number,
): readonly CalculationError[] {
  if (!moratorium) {
    return [];
  }

  const errors: CalculationError[] = [];

  if (!Number.isInteger(moratorium.periods) || moratorium.periods < 0) {
    errors.push({
      code: "INVALID_MORATORIUM_PERIODS",
      message: "Moratorium periods must be a non-negative integer.",
      path: "moratorium.periods",
    });
  } else if (moratorium.periods > totalPeriods) {
    errors.push({
      code: "MORATORIUM_EXCEEDS_SCHEDULE",
      message: "Moratorium periods must not exceed total schedule periods.",
      path: "moratorium.periods",
    });
  }

  const supportedCombination =
    (moratorium.type === "PRINCIPAL_ONLY" &&
      moratorium.interestTreatment === "PAY_CURRENT") ||
    (moratorium.type === "FULL_PAYMENT" &&
      (moratorium.interestTreatment === "ACCRUE" ||
        moratorium.interestTreatment === "CAPITALIZE"));

  if (!supportedCombination) {
    errors.push({
      code: "UNSUPPORTED_MORATORIUM_CONFIGURATION",
      message:
        "Principal-only moratorium requires current interest payment; full-payment moratorium requires accrual or capitalization.",
      path: "moratorium",
    });
  }

  return errors;
}

function validateLoanTerms(terms: LoanTerms): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  const principal = toDecimal(terms.principal.value);
  const annualRate = toDecimal(terms.annualInterestRate.value);

  if (principal.isNegative()) {
    errors.push({
      code: "INVALID_LOAN_PRINCIPAL",
      message: "Loan principal must not be negative.",
      path: "principal.value",
    });
  }

  if (annualRate.isNegative()) {
    errors.push({
      code: "INVALID_ANNUAL_INTEREST_RATE",
      message: "Annual interest rate must not be negative.",
      path: "annualInterestRate.value",
    });
  }

  const validPeriodCount =
    Number.isInteger(terms.repaymentPeriods) &&
    (principal.isZero()
      ? terms.repaymentPeriods >= 0
      : terms.repaymentPeriods > 0);

  if (!validPeriodCount) {
    errors.push({
      code: "INVALID_REPAYMENT_PERIODS",
      message:
        "Repayment periods must be a positive integer when principal is outstanding; zero is allowed only for zero principal.",
      path: "repaymentPeriods",
    });
  }

  errors.push(...validateMoratorium(terms.moratorium, terms.repaymentPeriods));

  if (
    !principal.isZero() &&
    terms.moratorium?.periods === terms.repaymentPeriods
  ) {
    errors.push({
      code: "NO_AMORTIZATION_PERIODS",
      message:
        "At least one schedule period must remain after moratorium to repay principal.",
      path: "moratorium.periods",
    });
  }

  if (
    terms.repaymentMethod !== "EQUAL_PRINCIPAL" &&
    terms.repaymentMethod !== "EMI"
  ) {
    errors.push({
      code: "UNSUPPORTED_REPAYMENT_METHOD",
      message: "The repayment method is not supported by the loan engine.",
      path: "repaymentMethod",
    });
  }

  return errors;
}

function emptySummary(originalPrincipal: MonetaryAmount): LoanRepaymentSummary {
  return {
    originalPrincipal,
    totalPrincipalRepaid: zeroAmount,
    totalInterestCharged: zeroAmount,
    totalInterestPaid: zeroAmount,
    totalRepayments: zeroAmount,
    totalCapitalizedInterest: zeroAmount,
    endingPrincipal: zeroAmount,
    endingAccruedInterest: zeroAmount,
    numberOfSchedulePeriods: 0,
    numberOfAmortizationPeriods: 0,
  };
}

export function summarizeLoanScheduleByYear(
  periods: readonly LoanRepaymentPeriod[],
): readonly AnnualLoanRepaymentSummary[] {
  const summaries = new Map<
    number,
    {
      openingPrincipal: MonetaryAmount;
      principalRepaid: ReturnType<typeof toDecimal>;
      interestCharged: ReturnType<typeof toDecimal>;
      interestPaid: ReturnType<typeof toDecimal>;
      totalDebtService: ReturnType<typeof toDecimal>;
      closingPrincipal: MonetaryAmount;
      openingAccruedInterest: MonetaryAmount;
      closingAccruedInterest: MonetaryAmount;
    }
  >();

  for (const period of periods) {
    const existing = summaries.get(period.projectionYear);

    if (!existing) {
      summaries.set(period.projectionYear, {
        openingPrincipal: period.openingPrincipal,
        principalRepaid: toDecimal(period.principalRepayment),
        interestCharged: toDecimal(period.interestCharged),
        interestPaid: toDecimal(period.interestPayment),
        totalDebtService: toDecimal(period.totalPayment),
        closingPrincipal: period.closingPrincipal,
        openingAccruedInterest: period.openingAccruedInterest,
        closingAccruedInterest: period.closingAccruedInterest,
      });
      continue;
    }

    existing.principalRepaid = existing.principalRepaid.plus(
      toDecimal(period.principalRepayment),
    );
    existing.interestCharged = existing.interestCharged.plus(
      toDecimal(period.interestCharged),
    );
    existing.interestPaid = existing.interestPaid.plus(
      toDecimal(period.interestPayment),
    );
    existing.totalDebtService = existing.totalDebtService.plus(
      toDecimal(period.totalPayment),
    );
    existing.closingPrincipal = period.closingPrincipal;
    existing.closingAccruedInterest = period.closingAccruedInterest;
  }

  const annualSummaries = Array.from(
    summaries,
    ([projectionYear, summary]) => ({
      projectionYear,
      openingPrincipal: summary.openingPrincipal,
      principalRepaid: toMonetaryAmount(summary.principalRepaid),
      interestCharged: toMonetaryAmount(summary.interestCharged),
      interestPaid: toMonetaryAmount(summary.interestPaid),
      totalDebtService: toMonetaryAmount(summary.totalDebtService),
      closingPrincipal: summary.closingPrincipal,
      openingAccruedInterest: summary.openingAccruedInterest,
      closingAccruedInterest: summary.closingAccruedInterest,
    }),
  );
  const finalAnnualSummary = annualSummaries.at(-1);
  const firstPeriod = periods[0];
  const finalPeriod = periods.at(-1);

  if (!finalAnnualSummary || !firstPeriod || !finalPeriod) {
    return annualSummaries;
  }

  let totalCapitalizedInterest = toDecimal(zeroAmount);
  let totalInterestCharged = toDecimal(zeroAmount);
  let totalInterestPaid = toDecimal(zeroAmount);

  for (const period of periods) {
    totalCapitalizedInterest = totalCapitalizedInterest.plus(
      toDecimal(period.capitalizedInterest),
    );
    totalInterestCharged = totalInterestCharged.plus(
      toDecimal(period.interestCharged),
    );
    totalInterestPaid = totalInterestPaid.plus(
      toDecimal(period.interestPayment),
    );
  }

  const totalPrincipalRepaid = toDecimal(firstPeriod.openingPrincipal)
    .plus(totalCapitalizedInterest)
    .minus(toDecimal(finalPeriod.closingPrincipal));
  const totalDebtService = totalPrincipalRepaid.plus(totalInterestPaid);
  let precedingPrincipal = toDecimal(zeroAmount);
  let precedingInterestCharged = toDecimal(zeroAmount);
  let precedingInterestPaid = toDecimal(zeroAmount);
  let precedingDebtService = toDecimal(zeroAmount);

  for (const summary of annualSummaries.slice(0, -1)) {
    precedingPrincipal = precedingPrincipal.plus(
      toDecimal(summary.principalRepaid),
    );
    precedingInterestCharged = precedingInterestCharged.plus(
      toDecimal(summary.interestCharged),
    );
    precedingInterestPaid = precedingInterestPaid.plus(
      toDecimal(summary.interestPaid),
    );
    precedingDebtService = precedingDebtService.plus(
      toDecimal(summary.totalDebtService),
    );
  }

  annualSummaries[annualSummaries.length - 1] = {
    ...finalAnnualSummary,
    principalRepaid: toMonetaryAmount(
      totalPrincipalRepaid.minus(precedingPrincipal),
    ),
    interestCharged: toMonetaryAmount(
      totalInterestCharged.minus(precedingInterestCharged),
    ),
    interestPaid: toMonetaryAmount(
      totalInterestPaid.minus(precedingInterestPaid),
    ),
    totalDebtService: toMonetaryAmount(
      totalDebtService.minus(precedingDebtService),
    ),
  };

  return annualSummaries;
}

function summarizeLoanSchedule(
  originalPrincipal: MonetaryAmount,
  periods: readonly LoanRepaymentPeriod[],
): LoanRepaymentSummary {
  let totalInterestCharged = toDecimal(zeroAmount);
  let totalInterestPaid = toDecimal(zeroAmount);
  let totalCapitalizedInterest = toDecimal(zeroAmount);
  let numberOfAmortizationPeriods = 0;

  for (const period of periods) {
    totalInterestCharged = totalInterestCharged.plus(
      toDecimal(period.interestCharged),
    );
    totalInterestPaid = totalInterestPaid.plus(
      toDecimal(period.interestPayment),
    );
    totalCapitalizedInterest = totalCapitalizedInterest.plus(
      toDecimal(period.capitalizedInterest),
    );

    if (period.phase === "AMORTIZATION") {
      numberOfAmortizationPeriods += 1;
    }
  }

  const finalPeriod = periods.at(-1);
  const endingPrincipal = finalPeriod?.closingPrincipal ?? zeroAmount;
  const totalPrincipalRepaid = toDecimal(originalPrincipal)
    .plus(totalCapitalizedInterest)
    .minus(toDecimal(endingPrincipal));
  const totalRepayments = totalPrincipalRepaid.plus(totalInterestPaid);

  return {
    originalPrincipal,
    totalPrincipalRepaid: toMonetaryAmount(totalPrincipalRepaid),
    totalInterestCharged: toMonetaryAmount(totalInterestCharged),
    totalInterestPaid: toMonetaryAmount(totalInterestPaid),
    totalRepayments: toMonetaryAmount(totalRepayments),
    totalCapitalizedInterest: toMonetaryAmount(totalCapitalizedInterest),
    endingPrincipal,
    endingAccruedInterest: finalPeriod?.closingAccruedInterest ?? zeroAmount,
    numberOfSchedulePeriods: periods.length,
    numberOfAmortizationPeriods,
  };
}

export function generateLoanRepaymentSchedule(
  terms: LoanTerms,
): CalculationResult<LoanRepaymentSchedule> {
  const validationErrors = validateLoanTerms(terms);

  if (validationErrors.length > 0) {
    return calculationFailure(...validationErrors);
  }

  const rateResult = calculatePeriodicInterestRate(
    terms.annualInterestRate.value,
    terms.repaymentFrequency,
  );

  if (!rateResult.ok) {
    return rateResult;
  }

  const originalPrincipal = terms.principal.value;

  if (toDecimal(originalPrincipal).isZero()) {
    return calculationSuccess({
      loanId: terms.id,
      repaymentMethod: terms.repaymentMethod,
      repaymentFrequency: terms.repaymentFrequency,
      periodicInterestRate: rateResult.value,
      periods: [],
      summary: emptySummary(originalPrincipal),
      annualSummaries: [],
    });
  }

  const convention = getFrequencyConvention(terms.repaymentFrequency);

  if (!convention) {
    return calculationFailure({
      code: "UNSUPPORTED_REPAYMENT_FREQUENCY",
      message: "The repayment frequency is not supported by the loan engine.",
      path: "repaymentFrequency",
    });
  }

  const moratoriumPeriods = terms.moratorium?.periods ?? 0;
  const amortizationPeriods = terms.repaymentPeriods - moratoriumPeriods;
  const periods: LoanRepaymentPeriod[] = [];
  let outstandingPrincipal = originalPrincipal;
  let accruedInterest = zeroAmount;

  for (let periodIndex = 0; periodIndex < moratoriumPeriods; periodIndex += 1) {
    const sequence = periodIndex + 1;
    const openingPrincipal = outstandingPrincipal;
    const openingAccruedInterest = accruedInterest;
    const interestCharged = calculatePeriodInterest(
      openingPrincipal,
      rateResult.value,
    );
    const paysCurrentInterest =
      terms.moratorium?.interestTreatment === "PAY_CURRENT";
    const accruesInterest = terms.moratorium?.interestTreatment === "ACCRUE";
    const capitalizesInterest =
      terms.moratorium?.interestTreatment === "CAPITALIZE";
    const interestPayment = paysCurrentInterest ? interestCharged : zeroAmount;
    const accruedInterestAdded = accruesInterest ? interestCharged : zeroAmount;
    const capitalizedInterest = capitalizesInterest
      ? interestCharged
      : zeroAmount;

    accruedInterest = toMonetaryAmount(
      toDecimal(accruedInterest).plus(toDecimal(accruedInterestAdded)),
    );
    outstandingPrincipal = toMonetaryAmount(
      toDecimal(outstandingPrincipal).plus(toDecimal(capitalizedInterest)),
    );

    periods.push({
      sequence,
      projectionYear: getProjectionYear(sequence, convention.periodsPerYear),
      phase: "MORATORIUM",
      openingPrincipal,
      periodicInterestRate: rateResult.value,
      interestCharged,
      principalRepayment: zeroAmount,
      interestPayment,
      totalPayment: interestPayment,
      capitalizedInterest,
      openingAccruedInterest,
      accruedInterestAdded,
      closingAccruedInterest: accruedInterest,
      closingPrincipal: outstandingPrincipal,
    });
  }

  const paymentResult =
    terms.repaymentMethod === "EMI"
      ? calculateEmiPayment(
          outstandingPrincipal,
          rateResult.value,
          amortizationPeriods,
        )
      : calculateEqualPrincipalAmount(
          outstandingPrincipal,
          amortizationPeriods,
        );

  if (!paymentResult.ok) {
    return paymentResult;
  }

  for (
    let amortizationIndex = 0;
    amortizationIndex < amortizationPeriods;
    amortizationIndex += 1
  ) {
    const sequence = moratoriumPeriods + amortizationIndex + 1;
    const isFinalPeriod = amortizationIndex === amortizationPeriods - 1;
    const openingPrincipal = outstandingPrincipal;
    const interestCharged = calculatePeriodInterest(
      openingPrincipal,
      rateResult.value,
    );
    const scheduledPrincipal =
      terms.repaymentMethod === "EMI"
        ? toMonetaryAmount(
            toDecimal(paymentResult.value).minus(toDecimal(interestCharged)),
          )
        : paymentResult.value;
    const principalRepayment = isFinalPeriod
      ? openingPrincipal
      : scheduledPrincipal;
    const interestPayment = interestCharged;
    const totalPayment = toMonetaryAmount(
      toDecimal(principalRepayment).plus(toDecimal(interestPayment)),
    );

    outstandingPrincipal = isFinalPeriod
      ? zeroAmount
      : toMonetaryAmount(
          toDecimal(openingPrincipal).minus(toDecimal(principalRepayment)),
        );

    periods.push({
      sequence,
      projectionYear: getProjectionYear(sequence, convention.periodsPerYear),
      phase: "AMORTIZATION",
      openingPrincipal,
      periodicInterestRate: rateResult.value,
      interestCharged,
      principalRepayment,
      interestPayment,
      totalPayment,
      capitalizedInterest: zeroAmount,
      openingAccruedInterest: accruedInterest,
      accruedInterestAdded: zeroAmount,
      closingAccruedInterest: accruedInterest,
      closingPrincipal: outstandingPrincipal,
    });
  }

  const summary = summarizeLoanSchedule(originalPrincipal, periods);

  return calculationSuccess({
    loanId: terms.id,
    repaymentMethod: terms.repaymentMethod,
    repaymentFrequency: terms.repaymentFrequency,
    periodicInterestRate: rateResult.value,
    periods,
    summary,
    annualSummaries: summarizeLoanScheduleByYear(periods),
  });
}
