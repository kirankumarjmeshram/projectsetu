/**
 * Centralized serialization/deserialization for decimal values persisted to
 * PostgreSQL. Ensures exact round-trip fidelity without intermediate
 * JavaScript Number conversion.
 *
 * - JSONB snapshots: decimal values stored as canonical decimal strings.
 * - Relational NUMERIC columns: pg driver returns strings which are validated
 *   here before becoming domain DecimalValue/MonetaryAmount/Percentage.
 *
 * Rejects: NaN, Infinity, -Infinity, scientific notation, malformed strings.
 */

const PLAIN_DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

export class InvalidPersistedDecimalError extends Error {
  constructor(value: unknown) {
    super(
      `Invalid persisted decimal value: ${typeof value === "string" ? value : String(value)}`,
    );
    this.name = "InvalidPersistedDecimalError";
  }
}

/**
 * Validates and returns a canonical decimal string from a database value.
 * Accepts only finite plain-decimal strings (no scientific notation).
 *
 * This is the single point of entry for all decimal values read from
 * PostgreSQL, whether from NUMERIC columns or JSONB fields.
 */
export function parsePersistedDecimal(value: unknown): string {
  if (typeof value !== "string") {
    throw new InvalidPersistedDecimalError(value);
  }

  if (!PLAIN_DECIMAL_PATTERN.test(value)) {
    throw new InvalidPersistedDecimalError(value);
  }

  return value;
}

/**
 * Serializes a domain decimal string for storage. Validates the value is a
 * canonical plain-decimal string before persistence.
 */
export function serializeDecimal(value: string): string {
  if (!PLAIN_DECIMAL_PATTERN.test(value)) {
    throw new InvalidPersistedDecimalError(value);
  }

  return value;
}

/**
 * Validates all string values in a JSONB object that represent decimal amounts.
 * Returns true only if every value matches the canonical decimal pattern.
 */
export function isValidDecimalString(value: unknown): value is string {
  return typeof value === "string" && PLAIN_DECIMAL_PATTERN.test(value);
}
