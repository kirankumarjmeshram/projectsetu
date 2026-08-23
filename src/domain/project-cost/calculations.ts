import {
  calculationFailure,
  calculationSuccess,
  type CalculationError,
  type CalculationResult,
} from "../shared/calculation";
import { monetaryAmount, toDecimal, toMonetaryAmount } from "../shared/decimal";
import type { DecimalValue, MonetaryAmount } from "../shared/types";
import type {
  ProjectCost,
  ProjectCostCategory,
  ProjectCostItem,
} from "./project-cost";

export type ProjectCostBaseMethod = "QUANTITY_TIMES_RATE" | "STATED_AMOUNT";

export interface ProjectCostAdditionBreakdown {
  readonly tax: MonetaryAmount;
  readonly freight: MonetaryAmount;
  readonly installation: MonetaryAmount;
  readonly totalAdditions: MonetaryAmount;
}

export interface ProjectCostLineResult {
  readonly input: ProjectCostItem;
  readonly baseMethod: ProjectCostBaseMethod;
  readonly quantity?: DecimalValue;
  readonly unitRate?: MonetaryAmount;
  readonly statedAmount: MonetaryAmount;
  readonly baseAmount: MonetaryAmount;
  readonly baseDifferenceFromStatedAmount: MonetaryAmount;
  readonly additions: ProjectCostAdditionBreakdown;
  readonly finalAmount: MonetaryAmount;
}

export interface ProjectCostCategoryTotal {
  readonly category: ProjectCostCategory;
  readonly total: MonetaryAmount;
}

export interface ProjectCostSummary {
  readonly projectId: ProjectCost["projectId"];
  readonly lines: readonly ProjectCostLineResult[];
  readonly categoryTotals: readonly ProjectCostCategoryTotal[];
  readonly totalProjectCost: MonetaryAmount;
  readonly statedTotal: MonetaryAmount;
  readonly differenceFromStatedTotal: MonetaryAmount;
}

const zeroAmount = monetaryAmount("0");

export function calculateProjectCostLine(
  item: ProjectCostItem,
): CalculationResult<ProjectCostLineResult> {
  const hasQuantity = item.quantity !== undefined;
  const hasRate = item.rate !== undefined;

  if (hasQuantity !== hasRate) {
    return calculationFailure({
      code: hasQuantity
        ? "MISSING_PROJECT_COST_RATE"
        : "MISSING_PROJECT_COST_QUANTITY",
      message: "Project-cost quantity and rate must be supplied together.",
      path: hasQuantity ? "rate" : "quantity",
    });
  }

  const statedAmount = item.amount.value;
  const baseAmount =
    hasQuantity && item.quantity && item.rate
      ? toMonetaryAmount(
          toDecimal(item.quantity).times(toDecimal(item.rate.value)),
        )
      : statedAmount;
  const tax = item.tax?.value ?? zeroAmount;
  const freight = item.freight?.value ?? zeroAmount;
  const installation = item.installation?.value ?? zeroAmount;
  const totalAdditions = toMonetaryAmount(
    toDecimal(tax).plus(toDecimal(freight)).plus(toDecimal(installation)),
  );
  const finalAmount = toMonetaryAmount(
    toDecimal(baseAmount).plus(toDecimal(totalAdditions)),
  );

  return calculationSuccess({
    input: item,
    baseMethod: hasQuantity ? "QUANTITY_TIMES_RATE" : "STATED_AMOUNT",
    quantity: item.quantity,
    unitRate: item.rate?.value,
    statedAmount,
    baseAmount,
    baseDifferenceFromStatedAmount: toMonetaryAmount(
      toDecimal(baseAmount).minus(toDecimal(statedAmount)),
    ),
    additions: {
      tax,
      freight,
      installation,
      totalAdditions,
    },
    finalAmount,
  });
}

export function calculateProjectCost(
  projectCost: ProjectCost,
): CalculationResult<ProjectCostSummary> {
  const lines: ProjectCostLineResult[] = [];
  const errors: CalculationError[] = [];

  for (const item of projectCost.items) {
    const result = calculateProjectCostLine(item);

    if (result.ok) {
      lines.push(result.value);
    } else {
      errors.push(...result.errors);
    }
  }

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  const categoryAmounts = new Map<
    ProjectCostCategory,
    ReturnType<typeof toDecimal>
  >();
  let total = toDecimal(zeroAmount);

  for (const line of lines) {
    const lineAmount = toDecimal(line.finalAmount);
    total = total.plus(lineAmount);
    categoryAmounts.set(
      line.input.category,
      (categoryAmounts.get(line.input.category) ?? toDecimal(zeroAmount)).plus(
        lineAmount,
      ),
    );
  }

  const totalProjectCost = toMonetaryAmount(total);

  return calculationSuccess({
    projectId: projectCost.projectId,
    lines,
    categoryTotals: Array.from(categoryAmounts, ([category, amount]) => ({
      category,
      total: toMonetaryAmount(amount),
    })),
    totalProjectCost,
    statedTotal: projectCost.statedTotal,
    differenceFromStatedTotal: toMonetaryAmount(
      toDecimal(totalProjectCost).minus(toDecimal(projectCost.statedTotal)),
    ),
  });
}
