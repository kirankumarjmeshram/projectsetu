import type {
  CalculationError,
  CalculationResult,
} from "../shared/calculation";
import { calculationFailure, calculationSuccess } from "../shared/calculation";
import {
  decimalValue,
  monetaryAmount,
  percentage,
  toDecimal,
  toDecimalValue,
  toMonetaryAmount,
} from "../shared/decimal";
import type {
  DecimalValue,
  MonetaryAmount,
  Percentage,
  ProjectionYear,
} from "../shared/types";
import type {
  AverageDscrResult,
  BankabilityMetricsProjectionInput,
  BankabilityMetricsSchedule,
  BankabilityMetricsYearInput,
  BankabilityMetricsYearResult,
  BreakEvenYearInput,
  BreakEvenYearResult,
  CurrentRatioYearInput,
  CurrentRatioYearResult,
  DebtEquityYearInput,
  DebtEquityYearResult,
  DscrYearInput,
  DscrYearResult,
  InterestCoverageYearInput,
  InterestCoverageYearResult,
  MetricResult,
  ProfitabilityMarginYearInput,
  ProfitabilityMarginYearResult,
  RoceYearInput,
  RoceYearResult,
  RoiYearInput,
  RoiYearResult,
  UndefinedMetricStatus,
} from "./metrics";

const zeroAmount = monetaryAmount("0");
const oneHundred = decimalValue("100");

function defined<TValue extends DecimalValue>(
  value: TValue,
): MetricResult<TValue> {
  return { status: "DEFINED", value };
}

function undefinedMetric<TValue extends DecimalValue = DecimalValue>(
  status: UndefinedMetricStatus,
): MetricResult<TValue> {
  return { status };
}

function requiredAmountError(
  value: MonetaryAmount,
  path: string,
  label: string,
): CalculationError | undefined {
  if (typeof value !== "string") {
    return {
      code: "MISSING_METRIC_INPUT",
      message: label + " is required.",
      path,
    };
  }
}

function nonNegativeAmountError(
  value: MonetaryAmount,
  path: string,
  code: string,
  label: string,
): CalculationError | undefined {
  const missing = requiredAmountError(value, path, label);
  if (missing) return missing;

  if (toDecimal(value).isNegative()) {
    return { code, message: label + " must not be negative.", path };
  }
}

function validYearError(
  year: ProjectionYear,
  path = "year",
): CalculationError | undefined {
  if (!Number.isInteger(year) || year <= 0) {
    return {
      code: "INVALID_METRIC_YEAR",
      message: "Projection year must be a positive integer.",
      path,
    };
  }
}

function pushError(
  errors: CalculationError[],
  error: CalculationError | undefined,
): void {
  if (error) errors.push(error);
}

function validateRequiredSignedFields(
  fields: readonly (readonly [MonetaryAmount, string, string])[],
): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  for (const [value, path, label] of fields) {
    pushError(errors, requiredAmountError(value, path, label));
  }
  return errors;
}

function validateNonNegativeFields(
  fields: readonly (readonly [MonetaryAmount, string, string, string])[],
): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  for (const [value, path, code, label] of fields) {
    pushError(errors, nonNegativeAmountError(value, path, code, label));
  }
  return errors;
}

function validateDscr(input: DscrYearInput): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  pushError(errors, validYearError(input.year));
  errors.push(
    ...validateRequiredSignedFields([
      [input.profitAfterTax, "profitAfterTax", "Profit after tax"],
    ]),
    ...validateNonNegativeFields([
      [
        input.depreciation,
        "depreciation",
        "NEGATIVE_DSCR_DEPRECIATION",
        "Depreciation",
      ],
      [
        input.interestExpense,
        "interestExpense",
        "NEGATIVE_DSCR_INTEREST_EXPENSE",
        "Interest expense",
      ],
      [
        input.principalRepayment,
        "principalRepayment",
        "NEGATIVE_DSCR_PRINCIPAL_REPAYMENT",
        "Principal repayment",
      ],
    ]),
  );
  return errors;
}

function calculateDscrUnchecked(input: DscrYearInput): DscrYearResult {
  const cashAvailableForDebtService = toMonetaryAmount(
    toDecimal(input.profitAfterTax)
      .plus(toDecimal(input.depreciation))
      .plus(toDecimal(input.interestExpense)),
  );
  const debtService = toMonetaryAmount(
    toDecimal(input.principalRepayment).plus(toDecimal(input.interestExpense)),
  );
  const dscr = toDecimal(debtService).isZero()
    ? undefinedMetric("UNDEFINED_ZERO_DENOMINATOR")
    : defined(
        toDecimalValue(
          toDecimal(cashAvailableForDebtService).dividedBy(
            toDecimal(debtService),
          ),
        ),
      );

  return { ...input, cashAvailableForDebtService, debtService, dscr };
}

export function calculateDscr(
  input: DscrYearInput,
): CalculationResult<DscrYearResult> {
  const errors = validateDscr(input);
  return errors.length > 0
    ? calculationFailure(...errors)
    : calculationSuccess(calculateDscrUnchecked(input));
}

function validateYearSeries(
  years: readonly { readonly year: ProjectionYear }[],
): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  const seenYears = new Set<number>();

  if (years.length === 0) {
    errors.push({
      code: "EMPTY_METRICS_SCHEDULE",
      message: "Metrics schedule must contain at least one projection year.",
      path: "years",
    });
  }

  for (const [index, row] of years.entries()) {
    const path = "years." + index + ".year";
    pushError(errors, validYearError(row.year, path));
    if (seenYears.has(row.year)) {
      errors.push({
        code: "DUPLICATE_METRIC_YEAR",
        message: "Projection years must be unique.",
        path,
      });
    } else {
      seenYears.add(row.year);
    }
    if (row.year !== index + 1) {
      errors.push({
        code: "INVALID_METRIC_YEAR_SEQUENCE",
        message: "Projection years must be sequential and start at year 1.",
        path,
      });
    }
  }

  return errors;
}

export function calculateAverageDscr(
  inputs: readonly DscrYearInput[],
): CalculationResult<AverageDscrResult> {
  const errors = [
    ...validateYearSeries(inputs),
    ...inputs.flatMap((input, index) =>
      validateDscr(input).map((error) => ({
        ...error,
        path: "years." + index + (error.path ? "." + error.path : ""),
      })),
    ),
  ];
  if (errors.length > 0) return calculationFailure(...errors);

  let totalCads = toDecimal(zeroAmount);
  let totalDebtService = toDecimal(zeroAmount);
  for (const input of inputs) {
    const result = calculateDscrUnchecked(input);
    if (toDecimal(result.debtService).isZero()) continue;
    totalCads = totalCads.plus(toDecimal(result.cashAvailableForDebtService));
    totalDebtService = totalDebtService.plus(toDecimal(result.debtService));
  }

  const totalCashAvailableForDebtService = toMonetaryAmount(totalCads);
  const authoritativeTotalDebtService = toMonetaryAmount(totalDebtService);
  const averageDscr = totalDebtService.isZero()
    ? undefinedMetric("UNDEFINED_ZERO_DENOMINATOR")
    : defined(toDecimalValue(totalCads.dividedBy(totalDebtService)));

  return calculationSuccess({
    totalCashAvailableForDebtService,
    totalDebtService: authoritativeTotalDebtService,
    averageDscr,
  });
}

function calculateRatio(
  numerator: MonetaryAmount,
  denominator: MonetaryAmount,
): MetricResult {
  return toDecimal(denominator).isZero()
    ? undefinedMetric("UNDEFINED_ZERO_DENOMINATOR")
    : defined(
        toDecimalValue(toDecimal(numerator).dividedBy(toDecimal(denominator))),
      );
}

function calculatePercentageMetric(
  numerator: MonetaryAmount,
  denominator: MonetaryAmount,
): MetricResult<Percentage> {
  return toDecimal(denominator).isZero()
    ? undefinedMetric("UNDEFINED_ZERO_DENOMINATOR")
    : defined(
        percentage(
          toDecimalValue(
            toDecimal(numerator)
              .dividedBy(toDecimal(denominator))
              .times(toDecimal(oneHundred)),
          ),
        ),
      );
}

function calculateInterestCoverageUnchecked(
  input: InterestCoverageYearInput,
): InterestCoverageYearResult {
  return {
    ...input,
    interestCoverageRatio: calculateRatio(input.ebit, input.interestExpense),
  };
}

export function calculateInterestCoverageRatio(
  input: InterestCoverageYearInput,
): CalculationResult<InterestCoverageYearResult> {
  const errors: CalculationError[] = [];
  pushError(errors, validYearError(input.year));
  errors.push(
    ...validateRequiredSignedFields([[input.ebit, "ebit", "EBIT"]]),
    ...validateNonNegativeFields([
      [
        input.interestExpense,
        "interestExpense",
        "NEGATIVE_INTEREST_COVERAGE_INTEREST",
        "Interest expense",
      ],
    ]),
  );
  if (errors.length > 0) return calculationFailure(...errors);

  return calculationSuccess(calculateInterestCoverageUnchecked(input));
}

function calculateDebtEquityUnchecked(
  input: DebtEquityYearInput,
): DebtEquityYearResult {
  const interestBearingDebt = toMonetaryAmount(
    toDecimal(input.longTermDebt).plus(toDecimal(input.currentDebt)),
  );
  const equity = toDecimal(input.totalEquity);
  const debtEquityRatio = equity.isNegative()
    ? undefinedMetric("UNDEFINED_NEGATIVE_EQUITY")
    : calculateRatio(interestBearingDebt, input.totalEquity);

  return { ...input, interestBearingDebt, debtEquityRatio };
}

export function calculateDebtEquityRatio(
  input: DebtEquityYearInput,
): CalculationResult<DebtEquityYearResult> {
  const errors: CalculationError[] = [];
  pushError(errors, validYearError(input.year));
  errors.push(
    ...validateNonNegativeFields([
      [
        input.longTermDebt,
        "longTermDebt",
        "NEGATIVE_LONG_TERM_DEBT",
        "Long-term debt",
      ],
      [
        input.currentDebt,
        "currentDebt",
        "NEGATIVE_CURRENT_DEBT",
        "Current debt",
      ],
    ]),
    ...validateRequiredSignedFields([
      [input.totalEquity, "totalEquity", "Total equity"],
    ]),
  );
  if (errors.length > 0) return calculationFailure(...errors);

  return calculationSuccess(calculateDebtEquityUnchecked(input));
}

function calculateCurrentRatioUnchecked(
  input: CurrentRatioYearInput,
): CurrentRatioYearResult {
  return {
    ...input,
    currentRatio: calculateRatio(
      input.totalCurrentAssets,
      input.totalCurrentLiabilities,
    ),
  };
}

export function calculateCurrentRatio(
  input: CurrentRatioYearInput,
): CalculationResult<CurrentRatioYearResult> {
  const errors: CalculationError[] = [];
  pushError(errors, validYearError(input.year));
  errors.push(
    ...validateNonNegativeFields([
      [
        input.totalCurrentAssets,
        "totalCurrentAssets",
        "NEGATIVE_TOTAL_CURRENT_ASSETS",
        "Total current assets",
      ],
      [
        input.totalCurrentLiabilities,
        "totalCurrentLiabilities",
        "NEGATIVE_TOTAL_CURRENT_LIABILITIES",
        "Total current liabilities",
      ],
    ]),
  );
  if (errors.length > 0) return calculationFailure(...errors);

  return calculationSuccess(calculateCurrentRatioUnchecked(input));
}

export function calculateBreakEvenMetrics(
  input: BreakEvenYearInput,
): CalculationResult<BreakEvenYearResult> {
  const errors: CalculationError[] = [];
  pushError(errors, validYearError(input.year));
  errors.push(
    ...validateNonNegativeFields([
      [input.revenue, "revenue", "NEGATIVE_BREAK_EVEN_REVENUE", "Revenue"],
      [
        input.variableCosts,
        "variableCosts",
        "NEGATIVE_VARIABLE_COSTS",
        "Variable costs",
      ],
      [input.fixedCosts, "fixedCosts", "NEGATIVE_FIXED_COSTS", "Fixed costs"],
    ]),
  );
  if (errors.length > 0) return calculationFailure(...errors);

  const contribution = toMonetaryAmount(
    toDecimal(input.revenue).minus(toDecimal(input.variableCosts)),
  );
  if (toDecimal(input.revenue).isZero()) {
    return calculationSuccess({
      ...input,
      contribution,
      contributionMarginRatio: undefinedMetric("UNDEFINED_ZERO_DENOMINATOR"),
      breakEvenSales: undefinedMetric("UNDEFINED_ZERO_DENOMINATOR"),
      breakEvenPercentage: undefinedMetric("UNDEFINED_ZERO_DENOMINATOR"),
    });
  }

  const contributionMarginRatio = calculateRatio(contribution, input.revenue);
  if (toDecimal(contribution).lessThanOrEqualTo(zeroAmount)) {
    return calculationSuccess({
      ...input,
      contribution,
      contributionMarginRatio,
      breakEvenSales: undefinedMetric("UNDEFINED_NON_POSITIVE_CONTRIBUTION"),
      breakEvenPercentage: undefinedMetric(
        "UNDEFINED_NON_POSITIVE_CONTRIBUTION",
      ),
    });
  }

  const breakEvenSales = toMonetaryAmount(
    toDecimal(input.fixedCosts)
      .times(toDecimal(input.revenue))
      .dividedBy(toDecimal(contribution)),
  );
  return calculationSuccess({
    ...input,
    contribution,
    contributionMarginRatio,
    breakEvenSales: defined(breakEvenSales),
    breakEvenPercentage: calculatePercentageMetric(
      breakEvenSales,
      input.revenue,
    ),
  });
}

export function calculateRoi(
  input: RoiYearInput,
): CalculationResult<RoiYearResult> {
  const errors: CalculationError[] = [];
  pushError(errors, validYearError(input.year));
  errors.push(
    ...validateRequiredSignedFields([
      [input.profitAfterTax, "profitAfterTax", "Profit after tax"],
    ]),
    ...validateNonNegativeFields([
      [
        input.totalProjectCost,
        "totalProjectCost",
        "NEGATIVE_TOTAL_PROJECT_COST",
        "Total project cost",
      ],
    ]),
  );
  if (errors.length > 0) return calculationFailure(...errors);

  return calculationSuccess(calculateRoiUnchecked(input));
}

function calculateRoiUnchecked(input: RoiYearInput): RoiYearResult {
  return {
    ...input,
    roi: calculatePercentageMetric(
      input.profitAfterTax,
      input.totalProjectCost,
    ),
  };
}

function calculateRoceUnchecked(input: RoceYearInput): RoceYearResult {
  const capitalEmployed = toMonetaryAmount(
    toDecimal(input.totalAssets).minus(
      toDecimal(input.totalCurrentLiabilities),
    ),
  );
  const roce = toDecimal(capitalEmployed).isNegative()
    ? undefinedMetric<Percentage>("UNDEFINED_NEGATIVE_CAPITAL_EMPLOYED")
    : calculatePercentageMetric(input.ebit, capitalEmployed);

  return { ...input, capitalEmployed, roce };
}

export function calculateRoce(
  input: RoceYearInput,
): CalculationResult<RoceYearResult> {
  const errors: CalculationError[] = [];
  pushError(errors, validYearError(input.year));
  errors.push(
    ...validateRequiredSignedFields([[input.ebit, "ebit", "EBIT"]]),
    ...validateNonNegativeFields([
      [
        input.totalAssets,
        "totalAssets",
        "NEGATIVE_TOTAL_ASSETS",
        "Total assets",
      ],
      [
        input.totalCurrentLiabilities,
        "totalCurrentLiabilities",
        "NEGATIVE_TOTAL_CURRENT_LIABILITIES",
        "Total current liabilities",
      ],
    ]),
  );
  if (errors.length > 0) return calculationFailure(...errors);

  return calculationSuccess(calculateRoceUnchecked(input));
}

function calculateProfitabilityMarginsUnchecked(
  input: ProfitabilityMarginYearInput,
): ProfitabilityMarginYearResult {
  return {
    ...input,
    ebitdaMargin: calculatePercentageMetric(input.ebitda, input.revenue),
    ebitMargin: calculatePercentageMetric(input.ebit, input.revenue),
    pbtMargin: calculatePercentageMetric(input.profitBeforeTax, input.revenue),
    patMargin: calculatePercentageMetric(input.profitAfterTax, input.revenue),
  };
}

export function calculateProfitabilityMargins(
  input: ProfitabilityMarginYearInput,
): CalculationResult<ProfitabilityMarginYearResult> {
  const errors: CalculationError[] = [];
  pushError(errors, validYearError(input.year));
  errors.push(
    ...validateNonNegativeFields([
      [input.revenue, "revenue", "NEGATIVE_MARGIN_REVENUE", "Revenue"],
    ]),
    ...validateRequiredSignedFields([
      [input.ebitda, "ebitda", "EBITDA"],
      [input.ebit, "ebit", "EBIT"],
      [input.profitBeforeTax, "profitBeforeTax", "Profit before tax"],
      [input.profitAfterTax, "profitAfterTax", "Profit after tax"],
    ]),
  );
  if (errors.length > 0) return calculationFailure(...errors);

  return calculationSuccess(calculateProfitabilityMarginsUnchecked(input));
}

function validateBankabilityYear(
  input: BankabilityMetricsYearInput,
): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  pushError(errors, validYearError(input.year));
  errors.push(
    ...validateRequiredSignedFields([
      [input.ebitda, "ebitda", "EBITDA"],
      [input.ebit, "ebit", "EBIT"],
      [input.profitBeforeTax, "profitBeforeTax", "Profit before tax"],
      [input.profitAfterTax, "profitAfterTax", "Profit after tax"],
      [input.totalEquity, "totalEquity", "Total equity"],
    ]),
    ...validateNonNegativeFields([
      [input.revenue, "revenue", "NEGATIVE_METRIC_REVENUE", "Revenue"],
      [
        input.variableCosts,
        "variableCosts",
        "NEGATIVE_VARIABLE_COSTS",
        "Variable costs",
      ],
      [input.fixedCosts, "fixedCosts", "NEGATIVE_FIXED_COSTS", "Fixed costs"],
      [
        input.depreciation,
        "depreciation",
        "NEGATIVE_DSCR_DEPRECIATION",
        "Depreciation",
      ],
      [
        input.interestExpense,
        "interestExpense",
        "NEGATIVE_DSCR_INTEREST_EXPENSE",
        "Interest expense",
      ],
      [
        input.principalRepayment,
        "principalRepayment",
        "NEGATIVE_DSCR_PRINCIPAL_REPAYMENT",
        "Principal repayment",
      ],
      [
        input.longTermDebt,
        "longTermDebt",
        "NEGATIVE_LONG_TERM_DEBT",
        "Long-term debt",
      ],
      [
        input.currentDebt,
        "currentDebt",
        "NEGATIVE_CURRENT_DEBT",
        "Current debt",
      ],
      [
        input.totalCurrentAssets,
        "totalCurrentAssets",
        "NEGATIVE_TOTAL_CURRENT_ASSETS",
        "Total current assets",
      ],
      [
        input.totalCurrentLiabilities,
        "totalCurrentLiabilities",
        "NEGATIVE_TOTAL_CURRENT_LIABILITIES",
        "Total current liabilities",
      ],
      [
        input.totalAssets,
        "totalAssets",
        "NEGATIVE_TOTAL_ASSETS",
        "Total assets",
      ],
      [
        input.totalProjectCost,
        "totalProjectCost",
        "NEGATIVE_TOTAL_PROJECT_COST",
        "Total project cost",
      ],
    ]),
  );
  return errors;
}

function calculateBankabilityYearUnchecked(
  input: BankabilityMetricsYearInput,
): BankabilityMetricsYearResult {
  const dscr = calculateDscrUnchecked(input);
  const interestCoverage = calculateInterestCoverageUnchecked(input);
  const debtEquity = calculateDebtEquityUnchecked(input);
  const currentRatio = calculateCurrentRatioUnchecked(input);
  const breakEven = calculateBreakEvenMetrics(input);
  const roi = calculateRoiUnchecked(input);
  const roce = calculateRoceUnchecked(input);
  const margins = calculateProfitabilityMarginsUnchecked(input);

  if (!breakEven.ok) {
    throw new Error("Validated break-even input unexpectedly failed.");
  }

  return {
    ...input,
    cashAvailableForDebtService: dscr.cashAvailableForDebtService,
    debtService: dscr.debtService,
    dscr: dscr.dscr,
    interestCoverageRatio: interestCoverage.interestCoverageRatio,
    interestBearingDebt: debtEquity.interestBearingDebt,
    debtEquityRatio: debtEquity.debtEquityRatio,
    currentRatio: currentRatio.currentRatio,
    contribution: breakEven.value.contribution,
    contributionMarginRatio: breakEven.value.contributionMarginRatio,
    breakEvenSales: breakEven.value.breakEvenSales,
    breakEvenPercentage: breakEven.value.breakEvenPercentage,
    roi: roi.roi,
    capitalEmployed: roce.capitalEmployed,
    roce: roce.roce,
    ebitdaMargin: margins.ebitdaMargin,
    ebitMargin: margins.ebitMargin,
    pbtMargin: margins.pbtMargin,
    patMargin: margins.patMargin,
  };
}

export function validateBankabilityMetricsYearInputs(
  years: readonly BankabilityMetricsYearInput[],
): readonly CalculationError[] {
  return [
    ...validateYearSeries(years),
    ...years.flatMap((year, index) =>
      validateBankabilityYear(year).map((error) => ({
        ...error,
        path: "years." + index + (error.path ? "." + error.path : ""),
      })),
    ),
  ];
}

export function calculateBankabilityMetricsSchedule(
  input: BankabilityMetricsProjectionInput,
): CalculationResult<BankabilityMetricsSchedule> {
  const errors = validateBankabilityMetricsYearInputs(input.years);
  if (errors.length > 0) return calculationFailure(...errors);

  const years = input.years.map(calculateBankabilityYearUnchecked);
  const averageDscr = calculateAverageDscr(input.years);
  if (!averageDscr.ok) return calculationFailure(...averageDscr.errors);

  return calculationSuccess({
    projectId: input.projectId,
    years,
    averageDscr: averageDscr.value,
  });
}
