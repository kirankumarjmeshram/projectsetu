import {
  calculationFailure,
  calculationSuccess,
  type CalculationError,
  type CalculationResult,
} from "../shared/calculation";
import { monetaryAmount, toDecimal, toMonetaryAmount } from "../shared/decimal";
import type {
  DecimalValue,
  MonetaryAmount,
  ProjectionYear,
} from "../shared/types";
import type {
  OperatingExpense,
  OperatingInput,
  ProductOrService,
  YearlyAssumption,
} from "./operations";

export interface RevenueLineResult {
  readonly input: ProductOrService;
  readonly year: ProjectionYear;
  readonly quantity: DecimalValue;
  readonly sellingRate: MonetaryAmount;
  readonly lineRevenue: MonetaryAmount;
}

export interface RevenueSummary {
  readonly year: ProjectionYear;
  readonly lines: readonly RevenueLineResult[];
  readonly totalRevenue: MonetaryAmount;
}

export interface OperatingInputLineResult {
  readonly input: OperatingInput;
  readonly quantity: DecimalValue;
  readonly purchaseRate: MonetaryAmount;
  readonly baseCost: MonetaryAmount;
  /** Treated as an explicit line-level addition, never as a rate. */
  readonly transportCost: MonetaryAmount;
  readonly totalCost: MonetaryAmount;
}

export interface OperatingInputCostSummary {
  readonly lines: readonly OperatingInputLineResult[];
  readonly totalInputCost: MonetaryAmount;
}

export interface OperatingExpenseLineResult {
  readonly input: OperatingExpense;
  readonly year: ProjectionYear;
  readonly amount: MonetaryAmount;
}

export interface OperatingExpenseSummary {
  readonly year: ProjectionYear;
  readonly lines: readonly OperatingExpenseLineResult[];
  readonly totalOperatingExpenses: MonetaryAmount;
}

const zeroAmount = monetaryAmount("0");

function getYearlyAssumption<TValue>(
  assumptions: readonly YearlyAssumption<TValue>[] | undefined,
  year: ProjectionYear,
  field: string,
): CalculationResult<YearlyAssumption<TValue>> {
  const matches = assumptions?.filter((entry) => entry.year === year) ?? [];

  if (matches.length === 0) {
    return calculationFailure({
      code: "MISSING_YEARLY_ASSUMPTION",
      message:
        "A " +
        field +
        " assumption is required for projection year " +
        year +
        ".",
      path: field,
    });
  }

  if (matches.length > 1) {
    return calculationFailure({
      code: "DUPLICATE_YEARLY_ASSUMPTION",
      message:
        "Only one " +
        field +
        " assumption is allowed for projection year " +
        year +
        ".",
      path: field,
    });
  }

  return calculationSuccess(matches[0]);
}

export function calculateRevenueLine(
  product: ProductOrService,
  year: ProjectionYear,
): CalculationResult<RevenueLineResult> {
  const quantityResult = getYearlyAssumption(
    product.salesQuantity,
    year,
    "salesQuantity",
  );
  const rateResult = getYearlyAssumption(
    product.sellingPrice,
    year,
    "sellingPrice",
  );

  if (!quantityResult.ok || !rateResult.ok) {
    return calculationFailure(
      ...(!quantityResult.ok ? quantityResult.errors : []),
      ...(!rateResult.ok ? rateResult.errors : []),
    );
  }

  const quantity = quantityResult.value.assumption.value;
  const sellingRate = rateResult.value.assumption.value;

  return calculationSuccess({
    input: product,
    year,
    quantity,
    sellingRate,
    lineRevenue: toMonetaryAmount(
      toDecimal(quantity).times(toDecimal(sellingRate)),
    ),
  });
}

export function calculateRevenueSummary(
  products: readonly ProductOrService[],
  year: ProjectionYear,
): CalculationResult<RevenueSummary> {
  const lines: RevenueLineResult[] = [];
  const errors: CalculationError[] = [];

  for (const product of products) {
    const result = calculateRevenueLine(product, year);

    if (result.ok) {
      lines.push(result.value);
    } else {
      errors.push(...result.errors);
    }
  }

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  const total = lines.reduce(
    (sum, line) => sum.plus(toDecimal(line.lineRevenue)),
    toDecimal(zeroAmount),
  );

  return calculationSuccess({
    year,
    lines,
    totalRevenue: toMonetaryAmount(total),
  });
}

export function calculateOperatingInputLine(
  input: OperatingInput,
): CalculationResult<OperatingInputLineResult> {
  const errors: CalculationError[] = [];

  if (!input.quantity) {
    errors.push({
      code: "MISSING_OPERATING_INPUT_QUANTITY",
      message: "Operating-input quantity is required.",
      path: "quantity",
    });
  }

  if (!input.purchaseRate) {
    errors.push({
      code: "MISSING_OPERATING_INPUT_RATE",
      message: "Operating-input purchase rate is required.",
      path: "purchaseRate",
    });
  }

  if (!input.quantity || !input.purchaseRate) {
    return calculationFailure(...errors);
  }

  const quantity = input.quantity.value;
  const purchaseRate = input.purchaseRate.value;
  const baseCost = toMonetaryAmount(
    toDecimal(quantity).times(toDecimal(purchaseRate)),
  );
  const transportCost = input.transportCost?.value ?? zeroAmount;

  return calculationSuccess({
    input,
    quantity,
    purchaseRate,
    baseCost,
    transportCost,
    totalCost: toMonetaryAmount(
      toDecimal(baseCost).plus(toDecimal(transportCost)),
    ),
  });
}

export function calculateOperatingInputCostSummary(
  inputs: readonly OperatingInput[],
): CalculationResult<OperatingInputCostSummary> {
  const lines: OperatingInputLineResult[] = [];
  const errors: CalculationError[] = [];

  for (const input of inputs) {
    const result = calculateOperatingInputLine(input);

    if (result.ok) {
      lines.push(result.value);
    } else {
      errors.push(...result.errors);
    }
  }

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  const total = lines.reduce(
    (sum, line) => sum.plus(toDecimal(line.totalCost)),
    toDecimal(zeroAmount),
  );

  return calculationSuccess({
    lines,
    totalInputCost: toMonetaryAmount(total),
  });
}

export function calculateOperatingExpenseSummary(
  expenses: readonly OperatingExpense[],
  year: ProjectionYear,
): CalculationResult<OperatingExpenseSummary> {
  const lines: OperatingExpenseLineResult[] = [];
  const errors: CalculationError[] = [];

  for (const expense of expenses) {
    const amountResult = getYearlyAssumption(
      expense.yearlyAmounts,
      year,
      "yearlyAmounts",
    );

    if (amountResult.ok) {
      lines.push({
        input: expense,
        year,
        amount: amountResult.value.assumption.value,
      });
    } else {
      errors.push(...amountResult.errors);
    }
  }

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  const total = lines.reduce(
    (sum, line) => sum.plus(toDecimal(line.amount)),
    toDecimal(zeroAmount),
  );

  return calculationSuccess({
    year,
    lines,
    totalOperatingExpenses: toMonetaryAmount(total),
  });
}
