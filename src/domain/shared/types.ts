/**
 * The arithmetic representation for money is unresolved by ADR 0001.
 * This lossless decimal-text alias is a temporary contract boundary only;
 * domain code must not perform arithmetic on it.
 */
export type MonetaryAmount = string;

/**
 * Percentages remain explicit decimal text until the decimal strategy and
 * rounding policies are decided. No implicit 0-1 or 0-100 scale is assumed.
 */
export type Percentage = string;

export type Identifier = string;
export type ISODate = string;
export type ISODateTime = string;
export type ProjectionYear = number;

export interface DateRange {
  readonly from: ISODate;
  readonly until?: ISODate;
}

export interface AuditMetadata {
  readonly createdAt: ISODateTime;
  readonly updatedAt: ISODateTime;
}

export function isProjectionYear(value: number): value is ProjectionYear {
  return Number.isInteger(value) && value > 0;
}
