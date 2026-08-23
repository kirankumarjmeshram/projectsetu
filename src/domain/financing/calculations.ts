import { monetaryAmount, toDecimal, toMonetaryAmount } from "../shared/decimal";
import type { MonetaryAmount } from "../shared/types";
import type {
  FinanceSource,
  FinanceSourceType,
  MeansOfFinance,
} from "./financing";

export interface FinanceSourceTypeTotal {
  readonly type: FinanceSourceType;
  readonly total: MonetaryAmount;
}

export interface MeansOfFinanceSummary {
  readonly projectId: MeansOfFinance["projectId"];
  readonly sources: readonly FinanceSource[];
  readonly sourceTypeTotals: readonly FinanceSourceTypeTotal[];
  readonly totalMeansOfFinance: MonetaryAmount;
  readonly statedTotal: MonetaryAmount;
  readonly differenceFromStatedTotal: MonetaryAmount;
}

export const financeReconciliationStatuses = [
  "BALANCED",
  "SHORTFALL",
  "EXCESS",
] as const;
export type FinanceReconciliationStatus =
  (typeof financeReconciliationStatuses)[number];

export interface FinanceReconciliationResult {
  readonly projectCost: MonetaryAmount;
  readonly totalFinance: MonetaryAmount;
  /** Signed as total finance minus project cost. */
  readonly difference: MonetaryAmount;
  readonly absoluteDifference: MonetaryAmount;
  readonly balanced: boolean;
  readonly status: FinanceReconciliationStatus;
}

const zeroAmount = monetaryAmount("0");

export function calculateMeansOfFinance(
  meansOfFinance: MeansOfFinance,
): MeansOfFinanceSummary {
  const sourceTypeAmounts = new Map<
    FinanceSourceType,
    ReturnType<typeof toDecimal>
  >();
  let total = toDecimal(zeroAmount);

  for (const source of meansOfFinance.sources) {
    const amount = toDecimal(source.amount);
    total = total.plus(amount);
    sourceTypeAmounts.set(
      source.type,
      (sourceTypeAmounts.get(source.type) ?? toDecimal(zeroAmount)).plus(
        amount,
      ),
    );
  }

  const totalMeansOfFinance = toMonetaryAmount(total);

  return {
    projectId: meansOfFinance.projectId,
    sources: meansOfFinance.sources,
    sourceTypeTotals: Array.from(sourceTypeAmounts, ([type, amount]) => ({
      type,
      total: toMonetaryAmount(amount),
    })),
    totalMeansOfFinance,
    statedTotal: meansOfFinance.statedTotal,
    differenceFromStatedTotal: toMonetaryAmount(
      toDecimal(totalMeansOfFinance).minus(
        toDecimal(meansOfFinance.statedTotal),
      ),
    ),
  };
}

export function reconcileMeansOfFinance(
  projectCost: MonetaryAmount,
  totalFinance: MonetaryAmount,
): FinanceReconciliationResult {
  const differenceValue = toDecimal(totalFinance).minus(toDecimal(projectCost));
  const difference = toMonetaryAmount(differenceValue);
  const balanced = differenceValue.isZero();

  return {
    projectCost,
    totalFinance,
    difference,
    absoluteDifference: toMonetaryAmount(differenceValue.abs()),
    balanced,
    status: balanced
      ? "BALANCED"
      : differenceValue.isNegative()
        ? "SHORTFALL"
        : "EXCESS",
  };
}
