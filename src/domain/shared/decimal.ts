import Decimal from "decimal.js";

import type { DecimalValue, MonetaryAmount, Percentage } from "./types";

export const DECIMAL_PRECISION = 40;

export const ProjectSetuDecimal = Decimal.clone({
  precision: DECIMAL_PRECISION,
  rounding: Decimal.ROUND_HALF_EVEN,
  // Canonical persistence strings must not switch to exponential notation.
  toExpNeg: -1_000_000_000,
  toExpPos: 1_000_000_000,
});

export const decimalRoundingModes = {
  UP: Decimal.ROUND_UP,
  DOWN: Decimal.ROUND_DOWN,
  CEIL: Decimal.ROUND_CEIL,
  FLOOR: Decimal.ROUND_FLOOR,
  HALF_UP: Decimal.ROUND_HALF_UP,
  HALF_DOWN: Decimal.ROUND_HALF_DOWN,
  HALF_EVEN: Decimal.ROUND_HALF_EVEN,
  HALF_CEIL: Decimal.ROUND_HALF_CEIL,
  HALF_FLOOR: Decimal.ROUND_HALF_FLOOR,
} as const;

export type DecimalRoundingMode = Decimal.Rounding;
export type DecimalInstance = Decimal;

const plainDecimalPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

export class InvalidDecimalValueError extends Error {
  constructor() {
    super("Expected a finite plain-decimal string.");
    this.name = "InvalidDecimalValueError";
  }
}

function normalizeDecimal(input: unknown): string {
  if (typeof input !== "string" || !plainDecimalPattern.test(input)) {
    throw new InvalidDecimalValueError();
  }

  const value = new ProjectSetuDecimal(input);

  if (!value.isFinite()) {
    throw new InvalidDecimalValueError();
  }

  return value.isZero() ? "0" : value.toFixed();
}

export function decimalValue(input: unknown): DecimalValue {
  return normalizeDecimal(input) as DecimalValue;
}

export function monetaryAmount(input: unknown): MonetaryAmount {
  return normalizeDecimal(input) as MonetaryAmount;
}

export function percentage(input: unknown): Percentage {
  return normalizeDecimal(input) as Percentage;
}

export function toDecimal(value: DecimalValue): DecimalInstance {
  return new ProjectSetuDecimal(value);
}

export function toDecimalValue(value: DecimalInstance): DecimalValue {
  if (!value.isFinite()) {
    throw new InvalidDecimalValueError();
  }

  return decimalValue(value.toFixed());
}

export function toMonetaryAmount(value: DecimalInstance): MonetaryAmount {
  if (!value.isFinite()) {
    throw new InvalidDecimalValueError();
  }

  return monetaryAmount(value.toFixed());
}

export function percentageToFactor(value: Percentage): DecimalInstance {
  return toDecimal(value).dividedBy("100");
}

export function roundDecimal(
  value: DecimalInstance,
  decimalPlaces: number,
  roundingMode: DecimalRoundingMode,
): DecimalInstance {
  if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0) {
    throw new RangeError("Decimal places must be a non-negative integer.");
  }

  return value.toDecimalPlaces(decimalPlaces, roundingMode);
}
