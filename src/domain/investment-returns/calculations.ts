import type {
  CalculationError,
  CalculationResult,
} from "../shared/calculation";
import { calculationFailure, calculationSuccess } from "../shared/calculation";
import {
  decimalValue,
  monetaryAmount,
  percentage,
  percentageToFactor,
  toDecimal,
  toDecimalValue,
  toMonetaryAmount,
} from "../shared/decimal";
import type { DecimalValue, MonetaryAmount, Percentage } from "../shared/types";
import type {
  DiscountedCashFlowRow,
  DiscountedPaybackResult,
  InternalRateOfReturnResult,
  InvestmentCashFlowPeriod,
  InvestmentCashFlowSeries,
  InvestmentReturnMetric,
  InvestmentReturnsAnalysis,
  InvestmentReturnsAnalysisInput,
  IrrSearchPolicy,
  NetPresentValueResult,
  PaybackCashFlowRow,
  ProfitabilityIndexResult,
  SimplePaybackResult,
  UndefinedInvestmentReturnMetricStatus,
} from "./investment-returns";

const zeroAmount = monetaryAmount("0");
const zeroDecimal = decimalValue("0");
const oneDecimal = decimalValue("1");
const oneHundred = decimalValue("100");
const irrLowerBound = decimalValue("-0.999999999999999999999999999999");

export const defaultIrrSearchPolicy: IrrSearchPolicy = {
  maximumIterations: 256,
  maximumBracketExpansions: 64,
  rateTolerance: decimalValue("0.000000000000000000000000000001"),
  npvTolerance: monetaryAmount("0.000000000000000000000001"),
};

function defined<TValue extends DecimalValue>(
  value: TValue,
): InvestmentReturnMetric<TValue> {
  return { status: "DEFINED", value };
}

function undefinedMetric<TValue extends DecimalValue = DecimalValue>(
  status: UndefinedInvestmentReturnMetricStatus,
): InvestmentReturnMetric<TValue> {
  return { status };
}

function canonicalAmountError(
  value: unknown,
  path: string,
): CalculationError | undefined {
  try {
    monetaryAmount(value);
  } catch {
    return {
      code: "INVALID_INVESTMENT_CASH_FLOW",
      message: "Cash flow must be a finite canonical plain-decimal string.",
      path,
    };
  }
}

export function validateInvestmentCashFlowSeries(
  series: InvestmentCashFlowSeries,
): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  const seenPeriods = new Set<number>();

  if (
    series.perspective !== "PROJECT_RETURN" &&
    series.perspective !== "EQUITY_RETURN"
  ) {
    errors.push({
      code: "INVALID_INVESTMENT_RETURN_PERSPECTIVE",
      message: "Perspective must be PROJECT_RETURN or EQUITY_RETURN.",
      path: "perspective",
    });
  }

  if (series.periods.length === 0) {
    errors.push({
      code: "EMPTY_INVESTMENT_CASH_FLOW_SERIES",
      message: "Investment cash-flow series must contain period 0.",
      path: "periods",
    });
  }

  for (const [index, period] of series.periods.entries()) {
    const path = "periods." + index;
    if (!Number.isInteger(period.periodIndex) || period.periodIndex < 0) {
      errors.push({
        code: "INVALID_INVESTMENT_CASH_FLOW_PERIOD",
        message: "Period index must be a non-negative integer.",
        path: path + ".periodIndex",
      });
    }
    if (seenPeriods.has(period.periodIndex)) {
      errors.push({
        code: "DUPLICATE_INVESTMENT_CASH_FLOW_PERIOD",
        message: "Each period index must be unique.",
        path: path + ".periodIndex",
      });
    } else {
      seenPeriods.add(period.periodIndex);
    }
    if (period.periodIndex !== index) {
      errors.push({
        code: "INVALID_INVESTMENT_CASH_FLOW_PERIOD_SEQUENCE",
        message: "Periods must be ordered sequentially from 0 through N.",
        path: path + ".periodIndex",
      });
    }
    const amountError = canonicalAmountError(
      period.cashFlow,
      path + ".cashFlow",
    );
    if (amountError) errors.push(amountError);
  }

  if (series.periods.length > 0 && series.periods[0]?.periodIndex !== 0) {
    errors.push({
      code: "MISSING_INVESTMENT_CASH_FLOW_PERIOD_ZERO",
      message: "Investment-return calculations require explicit period 0.",
      path: "periods.0.periodIndex",
    });
  }

  return errors;
}

function validateDiscountRate(
  discountRate: InvestmentReturnsAnalysisInput["discountRate"],
): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  if (!discountRate?.source) {
    errors.push({
      code: "MISSING_INVESTMENT_RETURN_DISCOUNT_RATE_SOURCE",
      message: "Discount rate must be explicitly source-backed.",
      path: "discountRate",
    });
  }
  try {
    const rate = percentage(discountRate?.value);
    if (toDecimal(rate).isNegative()) {
      errors.push({
        code: "NEGATIVE_INVESTMENT_RETURN_DISCOUNT_RATE",
        message: "Task 012 discount rate must be zero or positive.",
        path: "discountRate.value",
      });
    }
  } catch {
    errors.push({
      code: "INVALID_INVESTMENT_RETURN_DISCOUNT_RATE",
      message: "Discount rate must be a finite plain-decimal percentage.",
      path: "discountRate.value",
    });
  }
  return errors;
}

function discountedRowsUnchecked(
  series: InvestmentCashFlowSeries,
  discountRate: Percentage,
): readonly DiscountedCashFlowRow[] {
  const periodicRate = percentageToFactor(discountRate);
  const discountBase = toDecimal(oneDecimal).plus(periodicRate);
  let cumulativePresentValue = toDecimal(zeroAmount);

  return series.periods.map((period) => {
    const divisor = discountBase.pow(period.periodIndex);
    const discountFactor = toDecimal(oneDecimal).dividedBy(divisor);
    const presentValue = toDecimal(period.cashFlow).times(discountFactor);
    cumulativePresentValue = cumulativePresentValue.plus(presentValue);
    return {
      periodIndex: period.periodIndex,
      cashFlow: period.cashFlow,
      discountRate,
      discountFactor: toDecimalValue(discountFactor),
      presentValue: toMonetaryAmount(presentValue),
      cumulativePresentValue: toMonetaryAmount(cumulativePresentValue),
    };
  });
}

export function calculateNetPresentValue(
  series: InvestmentCashFlowSeries,
  discountRate: InvestmentReturnsAnalysisInput["discountRate"],
): CalculationResult<NetPresentValueResult> {
  const errors = [
    ...validateInvestmentCashFlowSeries(series),
    ...validateDiscountRate(discountRate),
  ];
  if (errors.length > 0) return calculationFailure(...errors);

  const rows = discountedRowsUnchecked(series, discountRate.value);
  return calculationSuccess({
    projectId: series.projectId,
    perspective: series.perspective,
    discountRate: discountRate.value,
    rows,
    npv: rows.at(-1)?.cumulativePresentValue ?? zeroAmount,
  });
}

function npvAtRateFactor(
  periods: readonly InvestmentCashFlowPeriod[],
  rateFactor: DecimalValue | ReturnType<typeof toDecimal>,
): ReturnType<typeof toDecimal> {
  const rate =
    typeof rateFactor === "string" ? toDecimal(rateFactor) : rateFactor;
  const base = toDecimal(oneDecimal).plus(rate);
  let npv = toDecimal(zeroAmount);
  for (const period of periods) {
    npv = npv.plus(
      toDecimal(period.cashFlow).dividedBy(base.pow(period.periodIndex)),
    );
  }
  return npv;
}

function countCashFlowSignChanges(
  periods: readonly InvestmentCashFlowPeriod[],
): number {
  const nonZero = periods
    .map((period) => toDecimal(period.cashFlow))
    .filter((cashFlow) => !cashFlow.isZero());
  let changes = 0;
  for (let index = 1; index < nonZero.length; index += 1) {
    if (nonZero[index]!.isNegative() !== nonZero[index - 1]!.isNegative()) {
      changes += 1;
    }
  }
  return changes;
}

function validateIrrSearchPolicy(
  policy: IrrSearchPolicy,
): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  if (
    !Number.isInteger(policy.maximumIterations) ||
    policy.maximumIterations <= 0
  ) {
    errors.push({
      code: "INVALID_IRR_MAXIMUM_ITERATIONS",
      message: "IRR maximum iterations must be a positive integer.",
      path: "searchPolicy.maximumIterations",
    });
  }
  if (
    !Number.isInteger(policy.maximumBracketExpansions) ||
    policy.maximumBracketExpansions < 0
  ) {
    errors.push({
      code: "INVALID_IRR_BRACKET_EXPANSIONS",
      message: "IRR bracket expansions must be a non-negative integer.",
      path: "searchPolicy.maximumBracketExpansions",
    });
  }
  try {
    if (
      toDecimal(decimalValue(policy.rateTolerance)).lessThanOrEqualTo(
        zeroDecimal,
      )
    ) {
      errors.push({
        code: "INVALID_IRR_RATE_TOLERANCE",
        message: "IRR rate tolerance must be positive.",
        path: "searchPolicy.rateTolerance",
      });
    }
  } catch {
    errors.push({
      code: "INVALID_IRR_RATE_TOLERANCE",
      message: "IRR rate tolerance must be a finite decimal.",
      path: "searchPolicy.rateTolerance",
    });
  }
  try {
    if (toDecimal(monetaryAmount(policy.npvTolerance)).isNegative()) {
      errors.push({
        code: "INVALID_IRR_NPV_TOLERANCE",
        message: "IRR NPV tolerance must not be negative.",
        path: "searchPolicy.npvTolerance",
      });
    }
  } catch {
    errors.push({
      code: "INVALID_IRR_NPV_TOLERANCE",
      message: "IRR NPV tolerance must be a finite decimal.",
      path: "searchPolicy.npvTolerance",
    });
  }
  return errors;
}

function hasSameNonZeroSign(
  left: ReturnType<typeof toDecimal>,
  right: ReturnType<typeof toDecimal>,
): boolean {
  return left.isNegative() === right.isNegative();
}

function definedIrrResult(
  series: InvestmentCashFlowSeries,
  signChangeCount: number,
  iterations: number,
  rateFactor: ReturnType<typeof toDecimal>,
  residualNpv: ReturnType<typeof toDecimal>,
): InternalRateOfReturnResult {
  return {
    projectId: series.projectId,
    perspective: series.perspective,
    signChangeCount,
    iterations,
    irr: defined(
      percentage(toDecimalValue(rateFactor.times(toDecimal(oneHundred)))),
    ),
    residualNpv: toMonetaryAmount(residualNpv),
  };
}

export function calculateInternalRateOfReturn(
  series: InvestmentCashFlowSeries,
  searchPolicy: IrrSearchPolicy = defaultIrrSearchPolicy,
): CalculationResult<InternalRateOfReturnResult> {
  const errors = [
    ...validateInvestmentCashFlowSeries(series),
    ...validateIrrSearchPolicy(searchPolicy),
  ];
  if (errors.length > 0) return calculationFailure(...errors);

  const signChangeCount = countCashFlowSignChanges(series.periods);
  if (signChangeCount === 0) {
    return calculationSuccess({
      projectId: series.projectId,
      perspective: series.perspective,
      signChangeCount,
      iterations: 0,
      irr: undefinedMetric("UNDEFINED_NO_SIGN_CHANGE"),
    });
  }
  if (signChangeCount > 1) {
    return calculationSuccess({
      projectId: series.projectId,
      perspective: series.perspective,
      signChangeCount,
      iterations: 0,
      irr: undefinedMetric("AMBIGUOUS_MULTIPLE_IRR_POSSIBLE"),
    });
  }

  const zeroRateNpv = npvAtRateFactor(series.periods, zeroDecimal);
  if (zeroRateNpv.isZero()) {
    return calculationSuccess(
      definedIrrResult(
        series,
        signChangeCount,
        0,
        toDecimal(zeroDecimal),
        zeroRateNpv,
      ),
    );
  }

  let lower = toDecimal(irrLowerBound);
  let upper = toDecimal(oneDecimal);
  let lowerNpv = npvAtRateFactor(series.periods, lower);
  let upperNpv = npvAtRateFactor(series.periods, upper);

  if (lowerNpv.isZero()) {
    return calculationSuccess(
      definedIrrResult(series, signChangeCount, 0, lower, lowerNpv),
    );
  }
  if (upperNpv.isZero()) {
    return calculationSuccess(
      definedIrrResult(series, signChangeCount, 0, upper, upperNpv),
    );
  }

  let expansions = 0;
  while (
    hasSameNonZeroSign(lowerNpv, upperNpv) &&
    expansions < searchPolicy.maximumBracketExpansions
  ) {
    upper = upper.times("2").plus(oneDecimal);
    upperNpv = npvAtRateFactor(series.periods, upper);
    expansions += 1;
    if (upperNpv.isZero()) {
      return calculationSuccess(
        definedIrrResult(series, signChangeCount, 0, upper, upperNpv),
      );
    }
  }

  if (hasSameNonZeroSign(lowerNpv, upperNpv)) {
    return calculationSuccess({
      projectId: series.projectId,
      perspective: series.perspective,
      signChangeCount,
      iterations: 0,
      irr: undefinedMetric("NUMERICAL_CONVERGENCE_FAILURE"),
    });
  }

  const rateTolerance = toDecimal(searchPolicy.rateTolerance);
  const npvTolerance = toDecimal(searchPolicy.npvTolerance);
  for (
    let iteration = 1;
    iteration <= searchPolicy.maximumIterations;
    iteration += 1
  ) {
    const midpoint = lower.plus(upper).dividedBy("2");
    const midpointNpv = npvAtRateFactor(series.periods, midpoint);
    if (midpointNpv.abs().lessThanOrEqualTo(npvTolerance)) {
      return calculationSuccess(
        definedIrrResult(
          series,
          signChangeCount,
          iteration,
          midpoint,
          midpointNpv,
        ),
      );
    }
    if (
      upper.minus(lower).abs().lessThanOrEqualTo(rateTolerance) ||
      midpoint.equals(lower) ||
      midpoint.equals(upper)
    ) {
      return calculationSuccess({
        projectId: series.projectId,
        perspective: series.perspective,
        signChangeCount,
        iterations: iteration,
        irr: undefinedMetric("NUMERICAL_CONVERGENCE_FAILURE"),
      });
    }

    if (hasSameNonZeroSign(lowerNpv, midpointNpv)) {
      lower = midpoint;
      lowerNpv = midpointNpv;
    } else {
      upper = midpoint;
      upperNpv = midpointNpv;
    }
  }

  return calculationSuccess({
    projectId: series.projectId,
    perspective: series.perspective,
    signChangeCount,
    iterations: searchPolicy.maximumIterations,
    irr: undefinedMetric("NUMERICAL_CONVERGENCE_FAILURE"),
  });
}

function undiscountedPaybackRows(
  series: InvestmentCashFlowSeries,
): readonly PaybackCashFlowRow[] {
  let cumulative = toDecimal(zeroAmount);
  return series.periods.map((period) => {
    cumulative = cumulative.plus(toDecimal(period.cashFlow));
    return {
      ...period,
      cumulativeCashFlow: toMonetaryAmount(cumulative),
    };
  });
}

function calculatePaybackFromAmounts(
  periods: readonly {
    readonly periodIndex: number;
    readonly amount: MonetaryAmount;
  }[],
): {
  readonly paybackPeriod: InvestmentReturnMetric;
  readonly recoveryPeriodIndex?: number;
} {
  let cumulative = toDecimal(zeroAmount);
  let wasEverNegative = false;
  const cumulativeByPeriod: ReturnType<typeof toDecimal>[] = [];
  for (const period of periods) {
    cumulative = cumulative.plus(toDecimal(period.amount));
    cumulativeByPeriod.push(cumulative);
    if (cumulative.isNegative()) wasEverNegative = true;
  }

  if (!wasEverNegative) {
    return { paybackPeriod: defined(zeroDecimal), recoveryPeriodIndex: 0 };
  }

  for (let index = 1; index < periods.length; index += 1) {
    const priorCumulative = cumulativeByPeriod[index - 1]!;
    const currentCumulative = cumulativeByPeriod[index]!;
    if (priorCumulative.isNegative() && !currentCumulative.isNegative()) {
      const recoveryAmount = toDecimal(periods[index]!.amount);
      if (!recoveryAmount.isPositive()) continue;
      const completedPeriods = toDecimal(
        decimalValue(String(periods[index]!.periodIndex - 1)),
      );
      const fraction = priorCumulative.abs().dividedBy(recoveryAmount);
      return {
        paybackPeriod: defined(toDecimalValue(completedPeriods.plus(fraction))),
        recoveryPeriodIndex: periods[index]!.periodIndex,
      };
    }
  }

  return {
    paybackPeriod: undefinedMetric("NOT_RECOVERED_WITHIN_HORIZON"),
  };
}

export function calculateSimplePaybackPeriod(
  series: InvestmentCashFlowSeries,
): CalculationResult<SimplePaybackResult> {
  const errors = validateInvestmentCashFlowSeries(series);
  if (errors.length > 0) return calculationFailure(...errors);

  const rows = undiscountedPaybackRows(series);
  const payback = calculatePaybackFromAmounts(
    series.periods.map((period) => ({
      periodIndex: period.periodIndex,
      amount: period.cashFlow,
    })),
  );
  return calculationSuccess({
    projectId: series.projectId,
    perspective: series.perspective,
    rows,
    ...payback,
  });
}

export function calculateDiscountedPaybackPeriod(
  series: InvestmentCashFlowSeries,
  discountRate: InvestmentReturnsAnalysisInput["discountRate"],
): CalculationResult<DiscountedPaybackResult> {
  const npv = calculateNetPresentValue(series, discountRate);
  if (!npv.ok) return calculationFailure(...npv.errors);

  const payback = calculatePaybackFromAmounts(
    npv.value.rows.map((row) => ({
      periodIndex: row.periodIndex,
      amount: row.presentValue,
    })),
  );
  return calculationSuccess({
    projectId: series.projectId,
    perspective: series.perspective,
    discountRate: discountRate.value,
    rows: npv.value.rows,
    ...payback,
  });
}

export function calculateProfitabilityIndex(
  series: InvestmentCashFlowSeries,
  discountRate: InvestmentReturnsAnalysisInput["discountRate"],
): CalculationResult<ProfitabilityIndexResult> {
  const npv = calculateNetPresentValue(series, discountRate);
  if (!npv.ok) return calculationFailure(...npv.errors);

  const initialCashFlow = toDecimal(series.periods[0]!.cashFlow);
  const initialInvestment = toMonetaryAmount(initialCashFlow.abs());
  let futurePositivePresentValue = toDecimal(zeroAmount);
  for (const row of npv.value.rows.slice(1)) {
    if (toDecimal(row.cashFlow).isPositive()) {
      futurePositivePresentValue = futurePositivePresentValue.plus(
        toDecimal(row.presentValue),
      );
    }
  }
  const presentValueOfFuturePositiveCashFlows = toMonetaryAmount(
    futurePositivePresentValue,
  );

  if (initialCashFlow.isZero()) {
    return calculationSuccess({
      projectId: series.projectId,
      perspective: series.perspective,
      discountRate: discountRate.value,
      initialInvestment,
      presentValueOfFuturePositiveCashFlows,
      profitabilityIndex: undefinedMetric("UNDEFINED_ZERO_INITIAL_INVESTMENT"),
    });
  }

  const hasLaterNegativeCashFlow = series.periods
    .slice(1)
    .some((period) => toDecimal(period.cashFlow).isNegative());
  if (initialCashFlow.isPositive() || hasLaterNegativeCashFlow) {
    return calculationSuccess({
      projectId: series.projectId,
      perspective: series.perspective,
      discountRate: discountRate.value,
      initialInvestment,
      presentValueOfFuturePositiveCashFlows,
      profitabilityIndex: undefinedMetric("INVALID_CASH_FLOW_PATTERN"),
    });
  }

  return calculationSuccess({
    projectId: series.projectId,
    perspective: series.perspective,
    discountRate: discountRate.value,
    initialInvestment,
    presentValueOfFuturePositiveCashFlows,
    profitabilityIndex: defined(
      toDecimalValue(
        futurePositivePresentValue.dividedBy(toDecimal(initialInvestment)),
      ),
    ),
  });
}

export function calculateInvestmentReturns(
  input: InvestmentReturnsAnalysisInput,
  irrSearchPolicy: IrrSearchPolicy = defaultIrrSearchPolicy,
): CalculationResult<InvestmentReturnsAnalysis> {
  const netPresentValue = calculateNetPresentValue(
    input.series,
    input.discountRate,
  );
  const internalRateOfReturn = calculateInternalRateOfReturn(
    input.series,
    irrSearchPolicy,
  );
  const simplePayback = calculateSimplePaybackPeriod(input.series);
  const discountedPayback = calculateDiscountedPaybackPeriod(
    input.series,
    input.discountRate,
  );
  const profitabilityIndex = calculateProfitabilityIndex(
    input.series,
    input.discountRate,
  );

  const errors: CalculationError[] = [];
  for (const result of [
    netPresentValue,
    internalRateOfReturn,
    simplePayback,
    discountedPayback,
    profitabilityIndex,
  ]) {
    if (!result.ok) errors.push(...result.errors);
  }
  if (errors.length > 0) return calculationFailure(...errors);
  if (
    !netPresentValue.ok ||
    !internalRateOfReturn.ok ||
    !simplePayback.ok ||
    !discountedPayback.ok ||
    !profitabilityIndex.ok
  ) {
    return calculationFailure({
      code: "INVESTMENT_RETURN_COMPOSITION_FAILURE",
      message: "Investment-return calculations could not be composed.",
    });
  }

  return calculationSuccess({
    projectId: input.series.projectId,
    perspective: input.series.perspective,
    series: input.series,
    discountRate: input.discountRate,
    netPresentValue: netPresentValue.value,
    internalRateOfReturn: internalRateOfReturn.value,
    simplePayback: simplePayback.value,
    discountedPayback: discountedPayback.value,
    profitabilityIndex: profitabilityIndex.value,
  });
}
