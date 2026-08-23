import {
  calculationFailure,
  calculationSuccess,
  type CalculationError,
  type CalculationResult,
} from "../shared/calculation";
import {
  monetaryAmount,
  percentageToFactor,
  toDecimal,
  toMonetaryAmount,
} from "../shared/decimal";
import type {
  DecimalValue,
  MonetaryAmount,
  Percentage,
  ProjectionYear,
} from "../shared/types";
import type {
  HoldingPeriodAssumptions,
  WorkingCapitalAssessmentInput,
  WorkingCapitalLine,
} from "./working-capital";

export type WorkingCapitalLineMethod = "STATED_AMOUNT" | "HOLDING_PERIOD";

export interface HoldingPeriodRequirement {
  readonly annualAmount: MonetaryAmount;
  readonly holdingPeriodDays: DecimalValue;
  readonly dayBase: DecimalValue;
  readonly requirement: MonetaryAmount;
}

export interface WorkingCapitalLineResult {
  readonly input: WorkingCapitalLine;
  readonly method: WorkingCapitalLineMethod;
  readonly annualBaseAmount: MonetaryAmount;
  readonly holdingPeriod?: HoldingPeriodRequirement;
  readonly amount: MonetaryAmount;
}

export interface WorkingCapitalSummary {
  readonly projectId: WorkingCapitalAssessmentInput["projectId"];
  readonly projectionYear: ProjectionYear;
  readonly lines: readonly WorkingCapitalLineResult[];
  readonly totalCurrentAssets: MonetaryAmount;
  readonly totalCurrentLiabilities: MonetaryAmount;
  readonly workingCapitalGap: MonetaryAmount;
  readonly borrowerMargin?: Percentage;
  readonly borrowerContribution?: MonetaryAmount;
  readonly bankFinanceRequired?: MonetaryAmount;
}

const zeroAmount = monetaryAmount("0");

export function calculateHoldingPeriodRequirement(
  annualAmount: MonetaryAmount,
  holdingPeriodDays: DecimalValue,
  dayBase: DecimalValue,
): CalculationResult<HoldingPeriodRequirement> {
  const days = toDecimal(holdingPeriodDays);
  const base = toDecimal(dayBase);
  const errors: CalculationError[] = [];

  if (days.isNegative()) {
    errors.push({
      code: "NEGATIVE_HOLDING_PERIOD",
      message: "Holding-period days cannot be negative.",
      path: "holdingPeriodDays",
    });
  }

  if (base.isZero() || base.isNegative()) {
    errors.push({
      code: "INVALID_DAY_BASE",
      message: "The explicit day base must be greater than zero.",
      path: "dayBase",
    });
  }

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  return calculationSuccess({
    annualAmount,
    holdingPeriodDays,
    dayBase,
    requirement: toMonetaryAmount(
      toDecimal(annualAmount).times(days).dividedBy(base),
    ),
  });
}

function getDefaultHoldingPeriod(
  line: WorkingCapitalLine,
  assumptions: HoldingPeriodAssumptions | undefined,
): DecimalValue | undefined {
  if (
    line.side === "CURRENT_ASSET" &&
    line.category === "RAW_MATERIAL_INVENTORY"
  ) {
    return assumptions?.inventoryDays?.value;
  }

  if (line.side === "CURRENT_ASSET" && line.category === "RECEIVABLES") {
    return assumptions?.receivableDays?.value;
  }

  if (
    line.side === "CURRENT_LIABILITY" &&
    line.category === "SUPPLIER_CREDIT"
  ) {
    return assumptions?.creditorDays?.value;
  }

  return undefined;
}

export function calculateWorkingCapitalLine(
  line: WorkingCapitalLine,
  dayBase?: DecimalValue,
  defaultHoldingPeriodDays?: DecimalValue,
): CalculationResult<WorkingCapitalLineResult> {
  if (!line.annualBaseAmount) {
    return calculationFailure({
      code: "MISSING_WORKING_CAPITAL_BASE_AMOUNT",
      message:
        "A working-capital line requires an annual base or stated amount.",
      path: "annualBaseAmount",
    });
  }

  const annualBaseAmount = line.annualBaseAmount.value;
  const holdingPeriodDays =
    line.holdingPeriodDays?.value ?? defaultHoldingPeriodDays;

  if (holdingPeriodDays === undefined) {
    return calculationSuccess({
      input: line,
      method: "STATED_AMOUNT",
      annualBaseAmount,
      amount: annualBaseAmount,
    });
  }

  if (dayBase === undefined) {
    return calculationFailure({
      code: "MISSING_WORKING_CAPITAL_DAY_BASE",
      message: "A day base is required when a holding period is supplied.",
      path: "dayBase",
    });
  }

  const holdingResult = calculateHoldingPeriodRequirement(
    annualBaseAmount,
    holdingPeriodDays,
    dayBase,
  );

  if (!holdingResult.ok) {
    return holdingResult;
  }

  return calculationSuccess({
    input: line,
    method: "HOLDING_PERIOD",
    annualBaseAmount,
    holdingPeriod: holdingResult.value,
    amount: holdingResult.value.requirement,
  });
}

export function calculateWorkingCapital(
  input: WorkingCapitalAssessmentInput,
  dayBase?: DecimalValue,
): CalculationResult<WorkingCapitalSummary> {
  const lines: WorkingCapitalLineResult[] = [];
  const errors: CalculationError[] = [];

  for (const line of input.lines) {
    const result = calculateWorkingCapitalLine(
      line,
      dayBase,
      getDefaultHoldingPeriod(line, input.holdingPeriods),
    );

    if (result.ok) {
      lines.push(result.value);
    } else {
      errors.push(...result.errors);
    }
  }

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  let currentAssets = toDecimal(zeroAmount);
  let currentLiabilities = toDecimal(zeroAmount);

  for (const line of lines) {
    if (line.input.side === "CURRENT_ASSET") {
      currentAssets = currentAssets.plus(toDecimal(line.amount));
    } else {
      currentLiabilities = currentLiabilities.plus(toDecimal(line.amount));
    }
  }

  const gap = currentAssets.minus(currentLiabilities);
  const totalCurrentAssets = toMonetaryAmount(currentAssets);
  const totalCurrentLiabilities = toMonetaryAmount(currentLiabilities);
  const workingCapitalGap = toMonetaryAmount(gap);
  const borrowerContribution = input.borrowerMargin
    ? toMonetaryAmount(
        gap.times(percentageToFactor(input.borrowerMargin.value)),
      )
    : undefined;
  const bankFinanceRequired = borrowerContribution
    ? toMonetaryAmount(gap.minus(toDecimal(borrowerContribution)))
    : undefined;

  return calculationSuccess({
    projectId: input.projectId,
    projectionYear: input.projectionYear,
    lines,
    totalCurrentAssets,
    totalCurrentLiabilities,
    workingCapitalGap,
    borrowerMargin: input.borrowerMargin?.value,
    borrowerContribution,
    bankFinanceRequired,
  });
}
