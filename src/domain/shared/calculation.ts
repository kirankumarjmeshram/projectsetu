import {
  decimalValue,
  percentageToFactor,
  toDecimal,
  toDecimalValue,
} from "./decimal";
import type { DecimalValue, Percentage } from "./types";

export interface CalculationError {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
}

export type CalculationResult<TValue> =
  | {
      readonly ok: true;
      readonly value: TValue;
    }
  | {
      readonly ok: false;
      readonly errors: readonly CalculationError[];
    };

export function calculationSuccess<TValue>(
  value: TValue,
): CalculationResult<TValue> {
  return { ok: true, value };
}

export function calculationFailure<TValue>(
  ...errors: readonly CalculationError[]
): CalculationResult<TValue> {
  return { ok: false, errors };
}

export function escalateDecimalValue<TValue extends DecimalValue>(
  baseValue: TValue,
  percentageRate: Percentage,
  periods: number,
): CalculationResult<TValue> {
  if (!Number.isInteger(periods) || periods < 0) {
    return calculationFailure({
      code: "INVALID_ESCALATION_PERIODS",
      message: "Escalation periods must be a non-negative integer.",
      path: "periods",
    });
  }

  const factor = toDecimal(decimalConstantOne).plus(
    percentageToFactor(percentageRate),
  );
  const result = toDecimal(baseValue).times(factor.pow(periods));

  return calculationSuccess(toDecimalValue(result) as TValue);
}

const decimalConstantOne = decimalValue("1");
