import { monetaryAmount, toDecimal } from "../../../shared/decimal";
import type { MonetaryAmount } from "../../../shared/types";
import type { MudraCategory } from "./contracts";

export const MUDRA_CATEGORY_LIMITS: Readonly<
  Record<
    MudraCategory,
    {
      readonly minimumExclusive?: MonetaryAmount;
      readonly minimumInclusive?: MonetaryAmount;
      readonly maximum: MonetaryAmount;
    }
  >
> = {
  SHISHU: {
    minimumInclusive: monetaryAmount("0"),
    maximum: monetaryAmount("50000"),
  },
  KISHORE: {
    minimumExclusive: monetaryAmount("50000"),
    maximum: monetaryAmount("500000"),
  },
  TARUN: {
    minimumExclusive: monetaryAmount("500000"),
    maximum: monetaryAmount("1000000"),
  },
  TARUN_PLUS: {
    minimumExclusive: monetaryAmount("1000000"),
    maximum: monetaryAmount("2000000"),
  },
};

export function resolveMudraCategory(amount: MonetaryAmount):
  | {
      readonly category: MudraCategory;
      readonly minimum: MonetaryAmount;
      readonly maximum: MonetaryAmount;
    }
  | undefined {
  const value = toDecimal(amount);
  if (value.lessThanOrEqualTo("50000")) {
    return {
      category: "SHISHU",
      minimum: monetaryAmount("0"),
      maximum: monetaryAmount("50000"),
    };
  }
  if (value.lessThanOrEqualTo("500000")) {
    return {
      category: "KISHORE",
      minimum: monetaryAmount("50000"),
      maximum: monetaryAmount("500000"),
    };
  }
  if (value.lessThanOrEqualTo("1000000")) {
    return {
      category: "TARUN",
      minimum: monetaryAmount("500000"),
      maximum: monetaryAmount("1000000"),
    };
  }
  if (value.lessThanOrEqualTo("2000000")) {
    return {
      category: "TARUN_PLUS",
      minimum: monetaryAmount("1000000"),
      maximum: monetaryAmount("2000000"),
    };
  }
  return undefined;
}
