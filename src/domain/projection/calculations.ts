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
import type {
  DecimalValue,
  MonetaryAmount,
  Percentage,
  ProjectionYear,
} from "../shared/types";
import type {
  FixedOperatingExpenseProjectionAssumption,
  FixedOperatingExpenseYearOverride,
  OperatingExpenseProjection,
  OperatingExpenseProjectionAssumption,
  OperatingExpenseProjectionLine,
  OperatingExpenseProjectionYear,
  PercentageOperatingExpenseProjectionAssumption,
  PercentageOperatingExpenseYearOverride,
  RevenueAndOperatingExpenseProjection,
  RevenueAndOperatingExpenseProjectionInput,
  RevenueProjection,
  RevenueProjectionAssumption,
  RevenueProjectionLine,
  RevenueProjectionYear,
  RevenueProjectionYearOverride,
} from "./projection";

const zeroAmount = monetaryAmount("0");
const decimalOne = decimalValue("1");
const negativeOneHundred = decimalValue("-100");
const percentageUpperBound = decimalValue("100");

function validateProjectionPeriod(
  projectionPeriodYears: number,
): readonly CalculationError[] {
  if (!Number.isInteger(projectionPeriodYears) || projectionPeriodYears <= 0) {
    return [
      {
        code: "INVALID_PROJECTION_PERIOD",
        message: "Projection period years must be a positive integer.",
        path: "projectionPeriodYears",
      },
    ];
  }

  return [];
}

function validateNonNegativeDecimal(
  value: DecimalValue,
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

function validateGrowthOrEscalationRate(
  value: Percentage,
  path: string,
  code: string,
  label: string,
): CalculationError | undefined {
  if (toDecimal(value).lessThan(negativeOneHundred)) {
    return {
      code,
      message: label + " must not be below -100 percent points.",
      path,
    };
  }
}

function validatePercentageRange(
  value: Percentage,
  path: string,
  code: string,
  label: string,
): CalculationError | undefined {
  const percentage = toDecimal(value);

  if (percentage.isNegative() || percentage.greaterThan(percentageUpperBound)) {
    return {
      code,
      message: label + " must be between 0 and 100 percent points.",
      path,
    };
  }
}

function validateOverrideYears(
  overrides: readonly { readonly year: ProjectionYear }[] | undefined,
  projectionPeriodYears: number,
  path: string,
): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  const seenYears = new Set<number>();

  for (const [index, override] of (overrides ?? []).entries()) {
    const overridePath = path + "." + index + ".year";

    if (
      !Number.isInteger(override.year) ||
      override.year <= 0 ||
      override.year > projectionPeriodYears
    ) {
      errors.push({
        code: "INVALID_PROJECTION_OVERRIDE_YEAR",
        message:
          "Override year must be a positive integer within the projection period.",
        path: overridePath,
      });
      continue;
    }

    if (seenYears.has(override.year)) {
      errors.push({
        code: "DUPLICATE_PROJECTION_OVERRIDE_YEAR",
        message: "Only one override is allowed for each projection year.",
        path: overridePath,
      });
    }

    seenYears.add(override.year);
  }

  return errors;
}

function pushError(
  errors: CalculationError[],
  error: CalculationError | undefined,
): void {
  if (error) {
    errors.push(error);
  }
}

function validateRevenueAssumption(
  assumption: RevenueProjectionAssumption,
  projectionPeriodYears: number,
  inputIndex: number,
): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  const basePath = "revenueAssumptions." + inputIndex;

  pushError(
    errors,
    validateNonNegativeDecimal(
      assumption.quantity.value,
      basePath + ".quantity.value",
      "INVALID_REVENUE_QUANTITY",
      "Revenue quantity",
    ),
  );
  pushError(
    errors,
    validateNonNegativeDecimal(
      assumption.unitPrice.value,
      basePath + ".unitPrice.value",
      "INVALID_REVENUE_UNIT_PRICE",
      "Revenue unit price",
    ),
  );
  pushError(
    errors,
    validatePercentageRange(
      assumption.capacityUtilisation.value,
      basePath + ".capacityUtilisation.value",
      "INVALID_CAPACITY_UTILISATION",
      "Capacity utilisation",
    ),
  );
  pushError(
    errors,
    validateGrowthOrEscalationRate(
      assumption.quantityGrowth.value,
      basePath + ".quantityGrowth.value",
      "INVALID_QUANTITY_GROWTH",
      "Quantity growth",
    ),
  );
  pushError(
    errors,
    validateGrowthOrEscalationRate(
      assumption.sellingPriceEscalation.value,
      basePath + ".sellingPriceEscalation.value",
      "INVALID_SELLING_PRICE_ESCALATION",
      "Selling-price escalation",
    ),
  );
  errors.push(
    ...validateOverrideYears(
      assumption.yearlyOverrides,
      projectionPeriodYears,
      basePath + ".yearlyOverrides",
    ),
  );

  for (const [overrideIndex, override] of (
    assumption.yearlyOverrides ?? []
  ).entries()) {
    const overridePath = basePath + ".yearlyOverrides." + overrideIndex;

    if (override.quantity) {
      pushError(
        errors,
        validateNonNegativeDecimal(
          override.quantity.value,
          overridePath + ".quantity.value",
          "INVALID_REVENUE_QUANTITY",
          "Revenue quantity",
        ),
      );
    }

    if (override.unitPrice) {
      pushError(
        errors,
        validateNonNegativeDecimal(
          override.unitPrice.value,
          overridePath + ".unitPrice.value",
          "INVALID_REVENUE_UNIT_PRICE",
          "Revenue unit price",
        ),
      );
    }

    if (override.capacityUtilisation) {
      pushError(
        errors,
        validatePercentageRange(
          override.capacityUtilisation.value,
          overridePath + ".capacityUtilisation.value",
          "INVALID_CAPACITY_UTILISATION",
          "Capacity utilisation",
        ),
      );
    }

    if (override.quantityGrowth) {
      pushError(
        errors,
        validateGrowthOrEscalationRate(
          override.quantityGrowth.value,
          overridePath + ".quantityGrowth.value",
          "INVALID_QUANTITY_GROWTH",
          "Quantity growth",
        ),
      );
    }

    if (override.sellingPriceEscalation) {
      pushError(
        errors,
        validateGrowthOrEscalationRate(
          override.sellingPriceEscalation.value,
          overridePath + ".sellingPriceEscalation.value",
          "INVALID_SELLING_PRICE_ESCALATION",
          "Selling-price escalation",
        ),
      );
    }
  }

  return errors;
}

function validateFixedExpense(
  assumption: FixedOperatingExpenseProjectionAssumption,
  projectionPeriodYears: number,
  inputIndex: number,
): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  const basePath = "operatingExpenseAssumptions." + inputIndex;

  pushError(
    errors,
    validateNonNegativeDecimal(
      assumption.annualAmount.value,
      basePath + ".annualAmount.value",
      "INVALID_OPERATING_EXPENSE_AMOUNT",
      "Operating expense amount",
    ),
  );
  pushError(
    errors,
    validateGrowthOrEscalationRate(
      assumption.annualEscalation.value,
      basePath + ".annualEscalation.value",
      "INVALID_OPERATING_EXPENSE_ESCALATION",
      "Operating expense escalation",
    ),
  );
  errors.push(
    ...validateOverrideYears(
      assumption.yearlyOverrides,
      projectionPeriodYears,
      basePath + ".yearlyOverrides",
    ),
  );

  for (const [overrideIndex, override] of (
    assumption.yearlyOverrides ?? []
  ).entries()) {
    const overridePath = basePath + ".yearlyOverrides." + overrideIndex;

    if (override.annualAmount) {
      pushError(
        errors,
        validateNonNegativeDecimal(
          override.annualAmount.value,
          overridePath + ".annualAmount.value",
          "INVALID_OPERATING_EXPENSE_AMOUNT",
          "Operating expense amount",
        ),
      );
    }

    if (override.annualEscalation) {
      pushError(
        errors,
        validateGrowthOrEscalationRate(
          override.annualEscalation.value,
          overridePath + ".annualEscalation.value",
          "INVALID_OPERATING_EXPENSE_ESCALATION",
          "Operating expense escalation",
        ),
      );
    }
  }

  return errors;
}

function validatePercentageExpense(
  assumption: PercentageOperatingExpenseProjectionAssumption,
  projectionPeriodYears: number,
  inputIndex: number,
): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  const basePath = "operatingExpenseAssumptions." + inputIndex;

  pushError(
    errors,
    validatePercentageRange(
      assumption.percentageOfRevenue.value,
      basePath + ".percentageOfRevenue.value",
      "INVALID_OPERATING_EXPENSE_PERCENTAGE",
      "Operating expense percentage",
    ),
  );
  pushError(
    errors,
    validateGrowthOrEscalationRate(
      assumption.annualEscalation.value,
      basePath + ".annualEscalation.value",
      "INVALID_OPERATING_EXPENSE_ESCALATION",
      "Operating expense escalation",
    ),
  );
  errors.push(
    ...validateOverrideYears(
      assumption.yearlyOverrides,
      projectionPeriodYears,
      basePath + ".yearlyOverrides",
    ),
  );

  for (const [overrideIndex, override] of (
    assumption.yearlyOverrides ?? []
  ).entries()) {
    const overridePath = basePath + ".yearlyOverrides." + overrideIndex;

    if (override.percentageOfRevenue) {
      pushError(
        errors,
        validatePercentageRange(
          override.percentageOfRevenue.value,
          overridePath + ".percentageOfRevenue.value",
          "INVALID_OPERATING_EXPENSE_PERCENTAGE",
          "Operating expense percentage",
        ),
      );
    }

    if (override.annualEscalation) {
      pushError(
        errors,
        validateGrowthOrEscalationRate(
          override.annualEscalation.value,
          overridePath + ".annualEscalation.value",
          "INVALID_OPERATING_EXPENSE_ESCALATION",
          "Operating expense escalation",
        ),
      );
    }
  }

  return errors;
}

function validateOperatingExpenseAssumption(
  assumption: OperatingExpenseProjectionAssumption,
  projectionPeriodYears: number,
  inputIndex: number,
): readonly CalculationError[] {
  if (assumption.calculationMethod === "FIXED_ANNUAL_AMOUNT") {
    return validateFixedExpense(assumption, projectionPeriodYears, inputIndex);
  }

  if (assumption.calculationMethod === "PERCENTAGE_OF_REVENUE") {
    return validatePercentageExpense(
      assumption,
      projectionPeriodYears,
      inputIndex,
    );
  }

  return [
    {
      code: "UNSUPPORTED_OPERATING_EXPENSE_METHOD",
      message: "The operating expense calculation method is not supported.",
      path: "operatingExpenseAssumptions." + inputIndex + ".calculationMethod",
    },
  ];
}

function growthFactor(rate: Percentage): ReturnType<typeof toDecimal> {
  return toDecimal(decimalOne).plus(percentageToFactor(rate));
}

function toProjectionYear(year: number): ProjectionYear {
  return year;
}

function projectRevenueAssumption(
  assumption: RevenueProjectionAssumption,
  projectionPeriodYears: number,
): readonly RevenueProjectionLine[] {
  const overrides = new Map<number, RevenueProjectionYearOverride>(
    (assumption.yearlyOverrides ?? []).map((override) => [
      override.year,
      override,
    ]),
  );
  const lines: RevenueProjectionLine[] = [];
  let currentQuantity = assumption.quantity.value;
  let currentUnitPrice = assumption.unitPrice.value;

  for (let year = 1; year <= projectionPeriodYears; year += 1) {
    const override = overrides.get(year);
    const quantity = override?.quantity?.value ?? currentQuantity;
    const unitPrice = override?.unitPrice?.value ?? currentUnitPrice;
    const capacityUtilisation =
      override?.capacityUtilisation?.value ??
      assumption.capacityUtilisation.value;
    const quantityGrowth =
      override?.quantityGrowth?.value ?? assumption.quantityGrowth.value;
    const sellingPriceEscalation =
      override?.sellingPriceEscalation?.value ??
      assumption.sellingPriceEscalation.value;
    const effectiveQuantity = toDecimalValue(
      toDecimal(quantity).times(percentageToFactor(capacityUtilisation)),
    );
    const revenue = toMonetaryAmount(
      toDecimal(effectiveQuantity).times(toDecimal(unitPrice)),
    );

    lines.push({
      input: assumption,
      year: toProjectionYear(year),
      quantity,
      capacityUtilisation,
      effectiveQuantity,
      unitPrice,
      quantityGrowthForNextYear: quantityGrowth,
      sellingPriceEscalationForNextYear: sellingPriceEscalation,
      revenue,
    });

    currentQuantity = toDecimalValue(
      toDecimal(quantity).times(growthFactor(quantityGrowth)),
    );
    currentUnitPrice = toMonetaryAmount(
      toDecimal(unitPrice).times(growthFactor(sellingPriceEscalation)),
    );
  }

  return lines;
}

export function calculateRevenueProjection(
  assumptions: readonly RevenueProjectionAssumption[],
  projectionPeriodYears: number,
): CalculationResult<RevenueProjection> {
  const errors: CalculationError[] = [
    ...validateProjectionPeriod(projectionPeriodYears),
  ];

  if (errors.length === 0) {
    for (const [index, assumption] of assumptions.entries()) {
      errors.push(
        ...validateRevenueAssumption(assumption, projectionPeriodYears, index),
      );
    }
  }

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  const projectedLines = assumptions.map((assumption) =>
    projectRevenueAssumption(assumption, projectionPeriodYears),
  );
  const years: RevenueProjectionYear[] = [];

  for (let year = 1; year <= projectionPeriodYears; year += 1) {
    const projectionYear = toProjectionYear(year);
    const lines = projectedLines.flatMap((productLines) =>
      productLines.filter((line) => line.year === projectionYear),
    );
    let totalRevenue = toDecimal(zeroAmount);

    for (const line of lines) {
      totalRevenue = totalRevenue.plus(toDecimal(line.revenue));
    }

    years.push({
      year: projectionYear,
      lines,
      totalRevenue: toMonetaryAmount(totalRevenue),
    });
  }

  return calculationSuccess({ projectionPeriodYears, years });
}

function getFixedOverride(
  assumption: FixedOperatingExpenseProjectionAssumption,
  year: ProjectionYear,
): FixedOperatingExpenseYearOverride | undefined {
  return assumption.yearlyOverrides?.find((override) => override.year === year);
}

function getPercentageOverride(
  assumption: PercentageOperatingExpenseProjectionAssumption,
  year: ProjectionYear,
): PercentageOperatingExpenseYearOverride | undefined {
  return assumption.yearlyOverrides?.find((override) => override.year === year);
}

function addExpenseToCategoryTotals(
  line: OperatingExpenseProjectionLine,
  totals: {
    rawMaterialAndVariableCosts: ReturnType<typeof toDecimal>;
    wages: ReturnType<typeof toDecimal>;
    salaries: ReturnType<typeof toDecimal>;
    utilities: ReturnType<typeof toDecimal>;
    repairsAndMaintenance: ReturnType<typeof toDecimal>;
    administrativeAndOtherOperatingCosts: ReturnType<typeof toDecimal>;
  },
): void {
  const amount = toDecimal(line.amount);

  switch (line.input.category) {
    case "WAGES":
      totals.wages = totals.wages.plus(amount);
      return;
    case "SALARIES":
      totals.salaries = totals.salaries.plus(amount);
      return;
    case "POWER_AND_ELECTRICITY":
    case "FUEL":
      totals.utilities = totals.utilities.plus(amount);
      return;
    case "REPAIRS_AND_MAINTENANCE":
      totals.repairsAndMaintenance = totals.repairsAndMaintenance.plus(amount);
      return;
    case "RAW_MATERIALS":
      totals.rawMaterialAndVariableCosts =
        totals.rawMaterialAndVariableCosts.plus(amount);
      return;
    default:
      if (line.calculationMethod === "PERCENTAGE_OF_REVENUE") {
        totals.rawMaterialAndVariableCosts =
          totals.rawMaterialAndVariableCosts.plus(amount);
      } else {
        totals.administrativeAndOtherOperatingCosts =
          totals.administrativeAndOtherOperatingCosts.plus(amount);
      }
  }
}

function newCategoryTotals(): {
  rawMaterialAndVariableCosts: ReturnType<typeof toDecimal>;
  wages: ReturnType<typeof toDecimal>;
  salaries: ReturnType<typeof toDecimal>;
  utilities: ReturnType<typeof toDecimal>;
  repairsAndMaintenance: ReturnType<typeof toDecimal>;
  administrativeAndOtherOperatingCosts: ReturnType<typeof toDecimal>;
} {
  return {
    rawMaterialAndVariableCosts: toDecimal(zeroAmount),
    wages: toDecimal(zeroAmount),
    salaries: toDecimal(zeroAmount),
    utilities: toDecimal(zeroAmount),
    repairsAndMaintenance: toDecimal(zeroAmount),
    administrativeAndOtherOperatingCosts: toDecimal(zeroAmount),
  };
}

export function calculateOperatingExpenseProjection(
  assumptions: readonly OperatingExpenseProjectionAssumption[],
  revenueProjection: RevenueProjection,
): CalculationResult<OperatingExpenseProjection> {
  const projectionPeriodYears = revenueProjection.projectionPeriodYears;
  const errors: CalculationError[] = [
    ...validateProjectionPeriod(projectionPeriodYears),
  ];

  if (revenueProjection.years.length !== projectionPeriodYears) {
    errors.push({
      code: "INCOMPLETE_REVENUE_PROJECTION",
      message:
        "Revenue projection must contain one row for every projection year.",
      path: "revenueProjection.years",
    });
  }

  for (const [index, year] of revenueProjection.years.entries()) {
    if (year.year !== index + 1) {
      errors.push({
        code: "INVALID_REVENUE_PROJECTION_YEAR",
        message:
          "Revenue projection years must be unique and sequential from year 1.",
        path: "revenueProjection.years." + index + ".year",
      });
    }
  }

  for (const [index, assumption] of assumptions.entries()) {
    errors.push(
      ...validateOperatingExpenseAssumption(
        assumption,
        projectionPeriodYears,
        index,
      ),
    );
  }

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  const fixedAmounts = new Map<
    OperatingExpenseProjectionAssumption,
    MonetaryAmount
  >();
  const percentageRates = new Map<
    OperatingExpenseProjectionAssumption,
    Percentage
  >();
  const years: OperatingExpenseProjectionYear[] = [];

  for (const assumption of assumptions) {
    if (assumption.calculationMethod === "FIXED_ANNUAL_AMOUNT") {
      fixedAmounts.set(assumption, assumption.annualAmount.value);
    } else {
      percentageRates.set(assumption, assumption.percentageOfRevenue.value);
    }
  }

  for (const revenueYear of revenueProjection.years) {
    const lines: OperatingExpenseProjectionLine[] = [];

    for (const assumption of assumptions) {
      if (assumption.calculationMethod === "FIXED_ANNUAL_AMOUNT") {
        const override = getFixedOverride(assumption, revenueYear.year);
        const annualAmount =
          override?.annualAmount?.value ??
          fixedAmounts.get(assumption) ??
          zeroAmount;
        const annualEscalation =
          override?.annualEscalation?.value ??
          assumption.annualEscalation.value;

        lines.push({
          input: assumption,
          year: revenueYear.year,
          calculationMethod: assumption.calculationMethod,
          annualAmount,
          annualEscalationForNextYear: annualEscalation,
          amount: annualAmount,
        });
        fixedAmounts.set(
          assumption,
          toMonetaryAmount(
            toDecimal(annualAmount).times(growthFactor(annualEscalation)),
          ),
        );
        continue;
      }

      const override = getPercentageOverride(assumption, revenueYear.year);
      const percentageOfRevenue =
        override?.percentageOfRevenue?.value ??
        percentageRates.get(assumption) ??
        assumption.percentageOfRevenue.value;
      const annualEscalation =
        override?.annualEscalation?.value ?? assumption.annualEscalation.value;

      if (toDecimal(percentageOfRevenue).greaterThan(percentageUpperBound)) {
        return calculationFailure({
          code: "PROJECTED_OPERATING_EXPENSE_PERCENTAGE_EXCEEDS_100",
          message:
            "Escalated operating expense percentage must not exceed 100 percent points.",
          path:
            "operatingExpenseAssumptions." +
            assumption.id +
            ".year." +
            revenueYear.year,
        });
      }

      lines.push({
        input: assumption,
        year: revenueYear.year,
        calculationMethod: assumption.calculationMethod,
        percentageOfRevenue,
        annualEscalationForNextYear: annualEscalation,
        amount: toMonetaryAmount(
          toDecimal(revenueYear.totalRevenue).times(
            percentageToFactor(percentageOfRevenue),
          ),
        ),
      });
      percentageRates.set(
        assumption,
        percentage(
          toDecimalValue(
            toDecimal(percentageOfRevenue).times(
              growthFactor(annualEscalation),
            ),
          ),
        ),
      );
    }

    const totals = newCategoryTotals();
    let totalOperatingExpenses = toDecimal(zeroAmount);

    for (const line of lines) {
      addExpenseToCategoryTotals(line, totals);
      totalOperatingExpenses = totalOperatingExpenses.plus(
        toDecimal(line.amount),
      );
    }

    years.push({
      year: revenueYear.year,
      lines,
      rawMaterialAndVariableCosts: toMonetaryAmount(
        totals.rawMaterialAndVariableCosts,
      ),
      wages: toMonetaryAmount(totals.wages),
      salaries: toMonetaryAmount(totals.salaries),
      utilities: toMonetaryAmount(totals.utilities),
      repairsAndMaintenance: toMonetaryAmount(totals.repairsAndMaintenance),
      administrativeAndOtherOperatingCosts: toMonetaryAmount(
        totals.administrativeAndOtherOperatingCosts,
      ),
      totalOperatingExpenses: toMonetaryAmount(totalOperatingExpenses),
    });
  }

  return calculationSuccess({ projectionPeriodYears, years });
}

export function calculateRevenueAndOperatingExpenseProjection(
  input: RevenueAndOperatingExpenseProjectionInput,
): CalculationResult<RevenueAndOperatingExpenseProjection> {
  const revenueResult = calculateRevenueProjection(
    input.revenueAssumptions,
    input.projectionPeriodYears,
  );

  if (!revenueResult.ok) {
    return revenueResult;
  }

  const expenseResult = calculateOperatingExpenseProjection(
    input.operatingExpenseAssumptions,
    revenueResult.value,
  );

  if (!expenseResult.ok) {
    return expenseResult;
  }

  const years: RevenueAndOperatingExpenseProjection["years"][number][] = [];

  for (const [index, revenueYear] of revenueResult.value.years.entries()) {
    const expenseYear = expenseResult.value.years[index];

    if (!expenseYear) {
      return calculationFailure({
        code: "INCOMPLETE_OPERATING_EXPENSE_PROJECTION",
        message:
          "Operating expense projection must contain one row for every revenue projection year.",
        path: "operatingExpenseProjection.years",
      });
    }

    years.push({
      ...expenseYear,
      revenueLines: revenueYear.lines,
      totalRevenue: revenueYear.totalRevenue,
      operatingSurplusBeforeDepreciationInterestAndTax: toMonetaryAmount(
        toDecimal(revenueYear.totalRevenue).minus(
          toDecimal(expenseYear.totalOperatingExpenses),
        ),
      ),
    });
  }

  return calculationSuccess({
    projectId: input.projectId,
    projectionPeriodYears: input.projectionPeriodYears,
    years,
  });
}
