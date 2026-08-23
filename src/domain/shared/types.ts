declare const decimalValueBrand: unique symbol;
declare const monetaryAmountBrand: unique symbol;
declare const percentageBrand: unique symbol;

/** Canonical, unformatted, plain-decimal text created by the decimal constructor. */
export type DecimalValue = string & {
  readonly [decimalValueBrand]: "DecimalValue";
};

/** Currency-neutral monetary decimal text created by the money constructor. */
export type MonetaryAmount = DecimalValue & {
  readonly [monetaryAmountBrand]: "MonetaryAmount";
};

/**
 * A percentage expressed in percent points and created by the percentage constructor.
 * For example, 10% is represented by the canonical value "10".
 */
export type Percentage = DecimalValue & {
  readonly [percentageBrand]: "Percentage";
};

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
