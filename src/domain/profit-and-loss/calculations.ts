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
  toMonetaryAmount,
} from "../shared/decimal";
import type {
  MonetaryAmount,
  Percentage,
  ProjectionYear,
} from "../shared/types";
import type { DepreciationSchedule } from "../depreciation/depreciation";
import type { RevenueAndOperatingExpenseProjection } from "../projection/projection";
import type {
  PercentageOfPositiveProfitBeforeTaxConfiguration,
  ProfitAndLossCompositionPolicy,
  ProfitAndLossCumulativeTotals,
  ProfitAndLossInterestExpenseSchedule,
  ProfitAndLossProjectionInput,
  ProfitAndLossSchedule,
  ProfitAndLossTaxConfiguration,
  ProfitAndLossYear,
  ProfitAndLossYearInput,
} from "./profit-and-loss";

const zeroAmount = monetaryAmount("0");
const percentageUpperBound = decimalValue("100");
const strictCompositionPolicy: ProfitAndLossCompositionPolicy = {
  missingDepreciation: "ERROR",
  missingInterestExpense: "ERROR",
};

function pushError(
  errors: CalculationError[],
  error: CalculationError | undefined,
): void {
  if (error) {
    errors.push(error);
  }
}

function validateNonNegativeAmount(
  value: MonetaryAmount,
  path: string,
  code: string,
  label: string,
): CalculationError | undefined {
  if (toDecimal(value).isNegative()) {
    return {
      code,
      message: label + " must not be negative.",
      path,
    };
  }
}

function validateTaxRate(
  rate: Percentage,
  path: string,
): CalculationError | undefined {
  const decimalRate = toDecimal(rate);

  if (
    decimalRate.isNegative() ||
    decimalRate.greaterThan(percentageUpperBound)
  ) {
    return {
      code: "INVALID_PROFIT_AND_LOSS_TAX_RATE",
      message: "P&L tax rate must be between 0 and 100 percent points.",
      path,
    };
  }
}

function validateYearCollection(
  years: readonly { readonly year: ProjectionYear }[],
  path: string,
  invalidYearCode: string,
  duplicateYearCode: string,
): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  const seenYears = new Set<number>();

  for (const [index, row] of years.entries()) {
    if (!Number.isInteger(row.year) || row.year <= 0) {
      errors.push({
        code: invalidYearCode,
        message: "Year must be a positive integer.",
        path: path + "." + index + ".year",
      });
    }

    if (seenYears.has(row.year)) {
      errors.push({
        code: duplicateYearCode,
        message: "Each year must appear at most once.",
        path: path + "." + index + ".year",
      });
    } else {
      seenYears.add(row.year);
    }
  }

  return errors;
}

function validateProfitAndLossYears(
  years: readonly ProfitAndLossYearInput[],
): readonly CalculationError[] {
  const errors: CalculationError[] = [
    ...validateYearCollection(
      years,
      "years",
      "INVALID_PROFIT_AND_LOSS_YEAR",
      "DUPLICATE_PROFIT_AND_LOSS_YEAR",
    ),
  ];

  if (years.length === 0) {
    errors.push({
      code: "EMPTY_PROFIT_AND_LOSS_SCHEDULE",
      message: "P&L schedule must contain at least one projection year.",
      path: "years",
    });
  }

  for (const [index, year] of years.entries()) {
    if (year.year !== index + 1) {
      errors.push({
        code: "INVALID_PROFIT_AND_LOSS_YEAR_SEQUENCE",
        message: "P&L years must be sequential and start at year 1.",
        path: "years." + index + ".year",
      });
    }

    pushError(
      errors,
      validateNonNegativeAmount(
        year.revenue,
        "years." + index + ".revenue",
        "NEGATIVE_PROFIT_AND_LOSS_REVENUE",
        "P&L revenue",
      ),
    );
    pushError(
      errors,
      validateNonNegativeAmount(
        year.operatingExpenses,
        "years." + index + ".operatingExpenses",
        "NEGATIVE_PROFIT_AND_LOSS_OPERATING_EXPENSES",
        "P&L operating expenses",
      ),
    );
    pushError(
      errors,
      validateNonNegativeAmount(
        year.depreciation,
        "years." + index + ".depreciation",
        "NEGATIVE_PROFIT_AND_LOSS_DEPRECIATION",
        "P&L depreciation",
      ),
    );
    pushError(
      errors,
      validateNonNegativeAmount(
        year.interestExpense,
        "years." + index + ".interestExpense",
        "NEGATIVE_PROFIT_AND_LOSS_INTEREST_EXPENSE",
        "P&L interest expense",
      ),
    );
  }

  return errors;
}

type RuntimeTaxConfiguration = ProfitAndLossTaxConfiguration & {
  readonly taxRate?: PercentageOfPositiveProfitBeforeTaxConfiguration["taxRate"];
  readonly yearlyOverrides?: PercentageOfPositiveProfitBeforeTaxConfiguration["yearlyOverrides"];
};

function validateTaxConfiguration(
  taxConfiguration: ProfitAndLossTaxConfiguration,
  validYears: ReadonlySet<number>,
): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  const runtimeConfiguration = taxConfiguration as RuntimeTaxConfiguration;

  if (taxConfiguration.mode === "NO_TAX") {
    if (
      runtimeConfiguration.taxRate !== undefined ||
      runtimeConfiguration.yearlyOverrides !== undefined
    ) {
      errors.push({
        code: "INCOMPATIBLE_PROFIT_AND_LOSS_TAX_CONFIGURATION",
        message: "NO_TAX must not include a tax rate or yearly overrides.",
        path: "taxConfiguration",
      });
    }

    return errors;
  }

  if (taxConfiguration.mode === "PERCENTAGE_OF_POSITIVE_PBT") {
    if (!runtimeConfiguration.taxRate) {
      errors.push({
        code: "MISSING_PROFIT_AND_LOSS_TAX_RATE",
        message: "Percentage tax requires a source-backed tax rate.",
        path: "taxConfiguration.taxRate",
      });
    } else {
      pushError(
        errors,
        validateTaxRate(
          runtimeConfiguration.taxRate.value,
          "taxConfiguration.taxRate.value",
        ),
      );
    }

    const seenOverrideYears = new Set<number>();

    for (const [index, override] of (
      runtimeConfiguration.yearlyOverrides ?? []
    ).entries()) {
      const path = "taxConfiguration.yearlyOverrides." + index;

      if (!Number.isInteger(override.year) || !validYears.has(override.year)) {
        errors.push({
          code: "TAX_OVERRIDE_OUTSIDE_PROFIT_AND_LOSS_YEARS",
          message: "Tax override year must identify a P&L projection year.",
          path: path + ".year",
        });
      }

      if (seenOverrideYears.has(override.year)) {
        errors.push({
          code: "DUPLICATE_PROFIT_AND_LOSS_TAX_OVERRIDE_YEAR",
          message: "Each tax override year must be unique.",
          path: path + ".year",
        });
      } else {
        seenOverrideYears.add(override.year);
      }

      pushError(
        errors,
        validateTaxRate(override.taxRate.value, path + ".taxRate.value"),
      );
    }

    return errors;
  }

  errors.push({
    code: "UNSUPPORTED_PROFIT_AND_LOSS_TAX_MODE",
    message: "The P&L tax mode is not supported.",
    path: "taxConfiguration.mode",
  });

  return errors;
}

function calculatePercentageTaxUnchecked(
  profitBeforeTax: MonetaryAmount,
  taxRate: Percentage,
): MonetaryAmount {
  const pbt = toDecimal(profitBeforeTax);

  if (pbt.isNegative() || pbt.isZero()) {
    return zeroAmount;
  }

  return toMonetaryAmount(pbt.times(percentageToFactor(taxRate)));
}

export function calculatePercentageOfPositiveProfitBeforeTax(
  profitBeforeTax: MonetaryAmount,
  taxRate: Percentage,
): CalculationResult<MonetaryAmount> {
  const rateError = validateTaxRate(taxRate, "taxRate");

  if (rateError) {
    return calculationFailure(rateError);
  }

  return calculationSuccess(
    calculatePercentageTaxUnchecked(profitBeforeTax, taxRate),
  );
}

function taxRateForYear(
  configuration: PercentageOfPositiveProfitBeforeTaxConfiguration,
  year: ProjectionYear,
): Percentage {
  return (
    configuration.yearlyOverrides?.find((override) => override.year === year)
      ?.taxRate.value ?? configuration.taxRate.value
  );
}

function calculateProfitAndLossYearUnchecked(
  input: ProfitAndLossYearInput,
  taxConfiguration: ProfitAndLossTaxConfiguration,
): ProfitAndLossYear {
  const ebitda = toMonetaryAmount(
    toDecimal(input.revenue).minus(toDecimal(input.operatingExpenses)),
  );
  const ebit = toMonetaryAmount(
    toDecimal(ebitda).minus(toDecimal(input.depreciation)),
  );
  const profitBeforeTax = toMonetaryAmount(
    toDecimal(ebit).minus(toDecimal(input.interestExpense)),
  );
  const taxRateApplied =
    taxConfiguration.mode === "PERCENTAGE_OF_POSITIVE_PBT"
      ? taxRateForYear(taxConfiguration, input.year)
      : undefined;
  const taxExpense = taxRateApplied
    ? calculatePercentageTaxUnchecked(profitBeforeTax, taxRateApplied)
    : zeroAmount;
  const profitAfterTax = toMonetaryAmount(
    toDecimal(profitBeforeTax).minus(toDecimal(taxExpense)),
  );

  return {
    year: input.year,
    revenue: input.revenue,
    operatingExpenses: input.operatingExpenses,
    ebitda,
    depreciation: input.depreciation,
    ebit,
    interestExpense: input.interestExpense,
    profitBeforeTax,
    taxMode: taxConfiguration.mode,
    ...(taxRateApplied === undefined ? {} : { taxRateApplied }),
    taxExpense,
    profitAfterTax,
  };
}

function calculateCumulativeTotals(
  years: readonly ProfitAndLossYear[],
): ProfitAndLossCumulativeTotals {
  let cumulativeRevenue = toDecimal(zeroAmount);
  let cumulativeOperatingExpenses = toDecimal(zeroAmount);
  let cumulativeEbitda = toDecimal(zeroAmount);
  let cumulativeDepreciation = toDecimal(zeroAmount);
  let cumulativeEbit = toDecimal(zeroAmount);
  let cumulativeInterestExpense = toDecimal(zeroAmount);
  let cumulativeProfitBeforeTax = toDecimal(zeroAmount);
  let cumulativeTaxExpense = toDecimal(zeroAmount);
  let cumulativeProfitAfterTax = toDecimal(zeroAmount);

  for (const year of years) {
    cumulativeRevenue = cumulativeRevenue.plus(toDecimal(year.revenue));
    cumulativeOperatingExpenses = cumulativeOperatingExpenses.plus(
      toDecimal(year.operatingExpenses),
    );
    cumulativeEbitda = cumulativeEbitda.plus(toDecimal(year.ebitda));
    cumulativeDepreciation = cumulativeDepreciation.plus(
      toDecimal(year.depreciation),
    );
    cumulativeEbit = cumulativeEbit.plus(toDecimal(year.ebit));
    cumulativeInterestExpense = cumulativeInterestExpense.plus(
      toDecimal(year.interestExpense),
    );
    cumulativeProfitBeforeTax = cumulativeProfitBeforeTax.plus(
      toDecimal(year.profitBeforeTax),
    );
    cumulativeTaxExpense = cumulativeTaxExpense.plus(
      toDecimal(year.taxExpense),
    );
    cumulativeProfitAfterTax = cumulativeProfitAfterTax.plus(
      toDecimal(year.profitAfterTax),
    );
  }

  return {
    cumulativeRevenue: toMonetaryAmount(cumulativeRevenue),
    cumulativeOperatingExpenses: toMonetaryAmount(cumulativeOperatingExpenses),
    cumulativeEbitda: toMonetaryAmount(cumulativeEbitda),
    cumulativeDepreciation: toMonetaryAmount(cumulativeDepreciation),
    cumulativeEbit: toMonetaryAmount(cumulativeEbit),
    cumulativeInterestExpense: toMonetaryAmount(cumulativeInterestExpense),
    cumulativeProfitBeforeTax: toMonetaryAmount(cumulativeProfitBeforeTax),
    cumulativeTaxExpense: toMonetaryAmount(cumulativeTaxExpense),
    cumulativeProfitAfterTax: toMonetaryAmount(cumulativeProfitAfterTax),
  };
}

export function calculateProjectedProfitAndLoss(
  input: ProfitAndLossProjectionInput,
): CalculationResult<ProfitAndLossSchedule> {
  const errors = [...validateProfitAndLossYears(input.years)];
  const validYears = new Set(input.years.map((year) => year.year));

  if (!input.taxConfiguration) {
    errors.push({
      code: "MISSING_PROFIT_AND_LOSS_TAX_CONFIGURATION",
      message: "P&L calculation requires an explicit tax configuration.",
      path: "taxConfiguration",
    });
  } else {
    errors.push(
      ...validateTaxConfiguration(input.taxConfiguration, validYears),
    );
  }

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  const years = input.years.map((year) =>
    calculateProfitAndLossYearUnchecked(year, input.taxConfiguration),
  );

  return calculationSuccess({
    projectId: input.projectId,
    taxConfiguration: input.taxConfiguration,
    years,
    cumulativeTotals: calculateCumulativeTotals(years),
  });
}

function validateSourceYears(
  years: readonly { readonly year: ProjectionYear }[],
  path: string,
  label: string,
): readonly CalculationError[] {
  return validateYearCollection(
    years,
    path,
    "INVALID_" + label + "_YEAR",
    "DUPLICATE_" + label + "_YEAR",
  );
}

export function composeProfitAndLossYearInputs(
  projection: RevenueAndOperatingExpenseProjection,
  depreciation: DepreciationSchedule,
  interestExpenses: ProfitAndLossInterestExpenseSchedule,
  policy: ProfitAndLossCompositionPolicy = strictCompositionPolicy,
): CalculationResult<readonly ProfitAndLossYearInput[]> {
  const errors: CalculationError[] = [];

  if (
    projection.projectId !== depreciation.projectId ||
    projection.projectId !== interestExpenses.projectId
  ) {
    errors.push({
      code: "PROFIT_AND_LOSS_PROJECT_ID_MISMATCH",
      message:
        "Projection, depreciation, and interest must belong to one project.",
      path: "projectId",
    });
  }

  errors.push(
    ...validateSourceYears(
      projection.years,
      "projection.years",
      "PROJECTION_SOURCE",
    ),
    ...validateSourceYears(
      depreciation.yearlySummaries,
      "depreciation.yearlySummaries",
      "DEPRECIATION_SOURCE",
    ),
    ...validateSourceYears(
      interestExpenses.years,
      "interestExpenses.years",
      "INTEREST_SOURCE",
    ),
  );

  const projectionYears = new Set(projection.years.map((year) => year.year));

  for (const [index, row] of depreciation.yearlySummaries.entries()) {
    if (!projectionYears.has(row.year)) {
      errors.push({
        code: "DEPRECIATION_YEAR_NOT_IN_PROJECTION",
        message: "Depreciation contains a year absent from the projection.",
        path: "depreciation.yearlySummaries." + index + ".year",
      });
    }
  }

  for (const [index, row] of interestExpenses.years.entries()) {
    if (!projectionYears.has(row.year)) {
      errors.push({
        code: "INTEREST_YEAR_NOT_IN_PROJECTION",
        message: "Interest expense contains a year absent from the projection.",
        path: "interestExpenses.years." + index + ".year",
      });
    }
  }

  const composedYears: ProfitAndLossYearInput[] = [];

  for (const [index, projectionYear] of projection.years.entries()) {
    const depreciationYear = depreciation.yearlySummaries.find(
      (year) => year.year === projectionYear.year,
    );
    const interestYear = interestExpenses.years.find(
      (year) => year.year === projectionYear.year,
    );

    if (
      !depreciationYear &&
      policy.missingDepreciation !== "USE_EXPLICIT_ZERO"
    ) {
      errors.push({
        code: "MISSING_DEPRECIATION_FOR_PROFIT_AND_LOSS_YEAR",
        message: "Each projection year requires authoritative depreciation.",
        path: "projection.years." + index + ".year",
      });
    }

    if (
      !interestYear &&
      policy.missingInterestExpense !== "USE_EXPLICIT_ZERO"
    ) {
      errors.push({
        code: "MISSING_INTEREST_FOR_PROFIT_AND_LOSS_YEAR",
        message:
          "Each projection year requires authoritative interest expense.",
        path: "projection.years." + index + ".year",
      });
    }

    composedYears.push({
      year: projectionYear.year,
      revenue: projectionYear.totalRevenue,
      operatingExpenses: projectionYear.totalOperatingExpenses,
      depreciation: depreciationYear?.depreciation ?? zeroAmount,
      interestExpense: interestYear?.interestExpense ?? zeroAmount,
    });
  }

  errors.push(...validateProfitAndLossYears(composedYears));

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  return calculationSuccess(composedYears);
}

export function calculateProfitAndLossFromAuthoritativeSchedules(
  projection: RevenueAndOperatingExpenseProjection,
  depreciation: DepreciationSchedule,
  interestExpenses: ProfitAndLossInterestExpenseSchedule,
  taxConfiguration: ProfitAndLossTaxConfiguration,
  policy: ProfitAndLossCompositionPolicy = strictCompositionPolicy,
): CalculationResult<ProfitAndLossSchedule> {
  const composed = composeProfitAndLossYearInputs(
    projection,
    depreciation,
    interestExpenses,
    policy,
  );

  if (!composed.ok) {
    return calculationFailure(...composed.errors);
  }

  return calculateProjectedProfitAndLoss({
    projectId: projection.projectId,
    years: composed.value,
    taxConfiguration,
  });
}
