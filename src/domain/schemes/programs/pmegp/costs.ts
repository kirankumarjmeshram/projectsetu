import type {
  CalculationError,
  CalculationResult,
} from "../../../shared/calculation";
import {
  calculationFailure,
  calculationSuccess,
} from "../../../shared/calculation";
import {
  decimalValue,
  monetaryAmount,
  percentage,
  percentageToFactor,
  toDecimal,
  toMonetaryAmount,
} from "../../../shared/decimal";
import type { MonetaryAmount, Percentage } from "../../../shared/types";
import type {
  PmegpCostItem,
  PmegpCostLineResult,
  PmegpCostRuleTrace,
  PmegpNewEnterpriseCostResult,
  PmegpSector,
  PmegpUpgradationCostResult,
} from "./contracts";
import {
  pmegpBankFinanceSource,
  pmegpLevelsOfSupportSource,
  pmegpNewEligibilitySource,
} from "./sources";

export const PMEGP_COST_TAGS = {
  LAND: "LAND",
  CAPITAL: "CAPITAL",
  WORKING_CAPITAL: "WORKING_CAPITAL",
  READY_BUILT_SHED: "READY_BUILT_SHED",
  RENTED_WORKSHED: "RENTED_WORKSHED",
  LEASED_WORKSHED: "LEASED_WORKSHED",
} as const;

function hasTag(item: PmegpCostItem, tag: string): boolean {
  return item.tags.some((value) => value === tag);
}

function lineStatus(
  amount: MonetaryAmount,
  eligibleAmount: MonetaryAmount,
): PmegpCostLineResult["status"] {
  const eligible = toDecimal(eligibleAmount);
  return eligible.isZero()
    ? "INELIGIBLE"
    : eligible.equals(toDecimal(amount))
      ? "ELIGIBLE"
      : "PARTIALLY_ELIGIBLE";
}

function validateItems(
  items: readonly PmegpCostItem[],
): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  const ids = new Set<string>();
  for (const [index, item] of items.entries()) {
    if (ids.has(item.costItemId)) {
      errors.push({
        code: "DUPLICATE_PMEGP_COST_ITEM",
        message: "PMEGP cost item ids must be unique.",
        path: `costItems.${index}.costItemId`,
      });
    }
    ids.add(item.costItemId);
    try {
      if (toDecimal(monetaryAmount(item.amount)).isNegative())
        throw new Error();
    } catch {
      errors.push({
        code: "INVALID_PMEGP_COST_ITEM_AMOUNT",
        message:
          "PMEGP cost item amount must be a non-negative monetary value.",
        path: `costItems.${index}.amount`,
      });
    }
  }
  return errors;
}

function workshedEligibleAmount(item: PmegpCostItem): CalculationResult<{
  readonly amount: MonetaryAmount;
  readonly trace: PmegpCostRuleTrace;
}> {
  if (!item.annualAmount || !item.durationYears) {
    return calculationFailure({
      code: "MISSING_PMEGP_WORKSHED_ASSUMPTION",
      message:
        "Ready-built, rented, or leased workshed cost requires source-backed annual amount and duration.",
      path: `costItems.${item.costItemId}`,
    });
  }
  try {
    const annual = toDecimal(monetaryAmount(item.annualAmount.value));
    const duration = toDecimal(decimalValue(item.durationYears.value));
    if (annual.isNegative() || !duration.greaterThan(0)) throw new Error();
    const suppliedTotal = annual.times(duration);
    if (!suppliedTotal.equals(toDecimal(item.amount))) {
      return calculationFailure({
        code: "PMEGP_WORKSHED_TOTAL_MISMATCH",
        message:
          "Workshed amount must exactly equal annual amount multiplied by supplied duration.",
        path: `costItems.${item.costItemId}.amount`,
      });
    }
    const eligible = annual.times(duration.greaterThan("3") ? "3" : duration);
    return calculationSuccess({
      amount: toMonetaryAmount(eligible),
      trace: {
        ruleId: "PMEGP.NEW.WORKSHED.MAX-3-YEARS",
        status: eligible.lessThan(suppliedTotal) ? "CAPPED" : "PASS",
        amountBefore: item.amount,
        amountAfter: toMonetaryAmount(eligible),
        sourceReferences: [pmegpNewEligibilitySource],
      },
    });
  } catch {
    return calculationFailure({
      code: "INVALID_PMEGP_WORKSHED_ASSUMPTION",
      message:
        "Workshed annual amount and duration must be valid non-negative/positive decimals.",
      path: `costItems.${item.costItemId}`,
    });
  }
}

function sectorCeiling(
  sector: PmegpSector,
  upgradation: boolean,
): MonetaryAmount {
  if (upgradation) {
    return monetaryAmount(sector === "MANUFACTURING" ? "10000000" : "2500000");
  }
  return monetaryAmount(sector === "MANUFACTURING" ? "5000000" : "2000000");
}

function workingCapitalPercentage(sector: PmegpSector): Percentage {
  return percentage(sector === "MANUFACTURING" ? "40" : "60");
}

interface MutableCostLine {
  readonly costItem: PmegpCostItem;
  eligible: ReturnType<typeof toDecimal>;
  readonly traces: PmegpCostRuleTrace[];
}

export function calculatePmegpNewEnterpriseCost(input: {
  readonly sector: PmegpSector;
  readonly costItems: readonly PmegpCostItem[];
}): CalculationResult<PmegpNewEnterpriseCostResult> {
  const errors = validateItems(input.costItems);
  if (errors.length > 0) return calculationFailure(...errors);

  const mutableLines: MutableCostLine[] = [];
  for (const item of input.costItems) {
    let eligible = toDecimal(item.amount);
    const traces: PmegpCostRuleTrace[] = [];
    if (hasTag(item, PMEGP_COST_TAGS.LAND)) {
      eligible = toDecimal(monetaryAmount("0"));
      traces.push({
        ruleId: "PMEGP.NEW.LAND.EXCLUDED",
        status: "EXCLUDED",
        amountBefore: item.amount,
        amountAfter: monetaryAmount("0"),
        sourceReferences: [pmegpNewEligibilitySource],
      });
    } else if (
      hasTag(item, PMEGP_COST_TAGS.READY_BUILT_SHED) ||
      hasTag(item, PMEGP_COST_TAGS.RENTED_WORKSHED) ||
      hasTag(item, PMEGP_COST_TAGS.LEASED_WORKSHED)
    ) {
      const workshed = workshedEligibleAmount(item);
      if (!workshed.ok) return workshed;
      eligible = toDecimal(workshed.value.amount);
      traces.push(workshed.value.trace);
    }
    mutableLines.push({ costItem: item, eligible, traces });
  }

  const workingLines = mutableLines.filter((line) =>
    hasTag(line.costItem, PMEGP_COST_TAGS.WORKING_CAPITAL),
  );
  const nonWorkingCapital = mutableLines
    .filter((line) => !hasTag(line.costItem, PMEGP_COST_TAGS.WORKING_CAPITAL))
    .reduce(
      (total, line) => total.plus(line.eligible),
      toDecimal(monetaryAmount("0")),
    );
  const actualWorkingCapital = workingLines.reduce(
    (total, line) => total.plus(toDecimal(line.costItem.amount)),
    toDecimal(monetaryAmount("0")),
  );
  const capRate = workingCapitalPercentage(input.sector);
  const capFactor = percentageToFactor(capRate);
  const maximumWorkingCapital = nonWorkingCapital
    .times(capFactor)
    .dividedBy(toDecimal(decimalValue("1")).minus(capFactor));
  const eligibleWorkingCapital = actualWorkingCapital.lessThan(
    maximumWorkingCapital,
  )
    ? actualWorkingCapital
    : maximumWorkingCapital;

  let allocatedWorkingCapital = toDecimal(monetaryAmount("0"));
  for (const [index, line] of workingLines.entries()) {
    const before = line.eligible;
    const allocation = actualWorkingCapital.isZero()
      ? toDecimal(monetaryAmount("0"))
      : index === workingLines.length - 1
        ? eligibleWorkingCapital.minus(allocatedWorkingCapital)
        : eligibleWorkingCapital
            .times(toDecimal(line.costItem.amount))
            .dividedBy(actualWorkingCapital);
    allocatedWorkingCapital = allocatedWorkingCapital.plus(allocation);
    line.eligible = allocation;
    line.traces.push({
      ruleId: `PMEGP.NEW.WORKING-CAPITAL.${capRate}-PERCENT`,
      status: allocation.lessThan(before) ? "CAPPED" : "PASS",
      amountBefore: toMonetaryAmount(before),
      amountAfter: toMonetaryAmount(allocation),
      sourceReferences: [pmegpBankFinanceSource],
    });
  }

  const lines: PmegpCostLineResult[] = mutableLines.map((line) => ({
    costItem: line.costItem,
    status: lineStatus(line.costItem.amount, toMonetaryAmount(line.eligible)),
    eligibleAmount: toMonetaryAmount(line.eligible),
    ineligibleAmount: toMonetaryAmount(
      toDecimal(line.costItem.amount).minus(line.eligible),
    ),
    ruleTraces: line.traces,
  }));
  const actualProjectCost = lines.reduce(
    (total, line) => total.plus(toDecimal(line.costItem.amount)),
    toDecimal(monetaryAmount("0")),
  );
  const financeable = lines.reduce(
    (total, line) => total.plus(toDecimal(line.eligibleAmount)),
    toDecimal(monetaryAmount("0")),
  );
  const ceiling = sectorCeiling(input.sector, false);
  const admissible = financeable.lessThan(toDecimal(ceiling))
    ? financeable
    : toDecimal(ceiling);
  const capital = lines
    .filter((line) => hasTag(line.costItem, PMEGP_COST_TAGS.CAPITAL))
    .reduce(
      (total, line) => total.plus(toDecimal(line.eligibleAmount)),
      toDecimal(monetaryAmount("0")),
    );
  const excessWorkingCapital = actualWorkingCapital.minus(
    eligibleWorkingCapital,
  );
  return calculationSuccess({
    actualProjectCost: toMonetaryAmount(actualProjectCost),
    pmegpFinanceableProjectCost: toMonetaryAmount(financeable),
    pmegpAdmissibleProjectCost: toMonetaryAmount(admissible),
    excessProjectCostOutsideSubsidy: toMonetaryAmount(
      actualProjectCost.minus(admissible),
    ),
    eligibleCapitalExpenditure: toMonetaryAmount(capital),
    excludedCost: toMonetaryAmount(actualProjectCost.minus(financeable)),
    projectCostCeiling: ceiling,
    workingCapital: {
      actualWorkingCapital: toMonetaryAmount(actualWorkingCapital),
      maximumPmegpEligibleWorkingCapital: toMonetaryAmount(
        maximumWorkingCapital,
      ),
      eligibleWorkingCapital: toMonetaryAmount(eligibleWorkingCapital),
      excessWorkingCapital: toMonetaryAmount(excessWorkingCapital),
      capPercentage: capRate,
      complianceResult: excessWorkingCapital.greaterThan(0)
        ? "EXCEEDS_LIMIT"
        : actualWorkingCapital.equals(maximumWorkingCapital)
          ? "AT_LIMIT"
          : "WITHIN_LIMIT",
      sourceReferences: [pmegpBankFinanceSource],
    },
    lines,
    sourceReferences: [
      pmegpLevelsOfSupportSource,
      pmegpNewEligibilitySource,
      pmegpBankFinanceSource,
    ],
  });
}

export function calculatePmegpUpgradationCost(input: {
  readonly sector: PmegpSector;
  readonly costItems: readonly PmegpCostItem[];
}): CalculationResult<PmegpUpgradationCostResult> {
  const errors = validateItems(input.costItems);
  if (errors.length > 0) return calculationFailure(...errors);
  const actual = input.costItems.reduce(
    (total, item) => total.plus(toDecimal(item.amount)),
    toDecimal(monetaryAmount("0")),
  );
  const ceiling = sectorCeiling(input.sector, true);
  const admissible = actual.lessThan(toDecimal(ceiling))
    ? actual
    : toDecimal(ceiling);
  return calculationSuccess({
    actualProjectCost: toMonetaryAmount(actual),
    pmegpAdmissibleProjectCost: toMonetaryAmount(admissible),
    excessProjectCostOutsideSubsidy: toMonetaryAmount(actual.minus(admissible)),
    projectCostCeiling: ceiling,
    sourceReferences: [pmegpLevelsOfSupportSource],
  });
}
