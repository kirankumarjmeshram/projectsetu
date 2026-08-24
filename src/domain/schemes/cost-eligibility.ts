import type {
  CalculationError,
  CalculationResult,
} from "../shared/calculation";
import { calculationFailure, calculationSuccess } from "../shared/calculation";
import {
  decimalValue,
  monetaryAmount,
  percentage,
  percentageToFactor,
  toDecimal,
  toMonetaryAmount,
} from "../shared/decimal";
import type {
  CostEligibilityLineResult,
  CostEligibilityRule,
  CostEligibilityRuleResult,
  ProgramEvaluationFacts,
  ProjectCostEligibilityResult,
  SchemeCostItem,
} from "./program";
import { getFact, type ProgramRuleHandlerRegistry } from "./rules";

function validateCostItems(
  items: readonly SchemeCostItem[],
): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  const ids = new Set<string>();
  for (const [index, item] of items.entries()) {
    if (ids.has(item.costItemId)) {
      errors.push({
        code: "DUPLICATE_SCHEME_COST_ITEM",
        message: "Scheme cost item ids must be unique.",
        path: `costItems.${index}.costItemId`,
      });
    }
    ids.add(item.costItemId);
    try {
      if (toDecimal(monetaryAmount(item.amount)).isNegative()) {
        errors.push({
          code: "NEGATIVE_SCHEME_COST_ITEM_AMOUNT",
          message: "Scheme cost item amount must not be negative.",
          path: `costItems.${index}.amount`,
        });
      }
    } catch {
      errors.push({
        code: "INVALID_SCHEME_COST_ITEM_AMOUNT",
        message: "Scheme cost item amount must be a canonical monetary value.",
        path: `costItems.${index}.amount`,
      });
    }
  }
  return errors;
}

function validateRules(
  rules: readonly CostEligibilityRule[],
): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  const ids = new Set<string>();
  for (const [index, rule] of rules.entries()) {
    if (ids.has(rule.ruleId)) {
      errors.push({
        code: "DUPLICATE_COST_ELIGIBILITY_RULE",
        message: "Cost eligibility rule ids must be unique.",
        path: `costEligibilityRules.${index}.ruleId`,
      });
    }
    ids.add(rule.ruleId);
    try {
      if (rule.type === "PERCENTAGE_CAP") {
        const rate = toDecimal(percentage(rule.percentage));
        if (rate.isNegative() || rate.greaterThan("100")) {
          errors.push({
            code: "INVALID_COST_ELIGIBILITY_PERCENTAGE",
            message: "Cost eligibility percentage must be between 0 and 100.",
            path: `costEligibilityRules.${index}.percentage`,
          });
        }
      }
      if (
        (rule.type === "ABSOLUTE_CAP" ||
          rule.type === "MAXIMUM_ELIGIBLE_AMOUNT") &&
        toDecimal(monetaryAmount(rule.amount)).isNegative()
      ) {
        errors.push({
          code: "NEGATIVE_COST_ELIGIBILITY_CAP",
          message: "Cost eligibility cap must not be negative.",
          path: `costEligibilityRules.${index}.amount`,
        });
      }
      if (
        rule.type === "DURATION_CAP" &&
        !toDecimal(decimalValue(rule.maximumDuration)).isPositive()
      ) {
        errors.push({
          code: "INVALID_COST_ELIGIBILITY_DURATION_CAP",
          message: "Maximum eligible duration must be greater than zero.",
          path: `costEligibilityRules.${index}.maximumDuration`,
        });
      }
      if (
        rule.type === "PER_UNIT_CAP" &&
        toDecimal(monetaryAmount(rule.maximumAmountPerUnit)).isNegative()
      ) {
        errors.push({
          code: "NEGATIVE_COST_ELIGIBILITY_PER_UNIT_CAP",
          message: "Maximum eligible amount per unit must not be negative.",
          path: `costEligibilityRules.${index}.maximumAmountPerUnit`,
        });
      }
    } catch {
      errors.push({
        code: "INVALID_COST_ELIGIBILITY_RULE_VALUE",
        message: "Cost eligibility rule contains an invalid decimal value.",
        path: `costEligibilityRules.${index}`,
      });
    }
  }
  return errors;
}

function sharesAny(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return actual.some((value) => expected.includes(value));
}

export function calculateCostEligibility(input: {
  readonly costItems: readonly SchemeCostItem[];
  readonly rules: readonly CostEligibilityRule[];
  readonly facts: ProgramEvaluationFacts;
  readonly handlers?: ProgramRuleHandlerRegistry;
}): CalculationResult<ProjectCostEligibilityResult> {
  const errors = [
    ...validateCostItems(input.costItems),
    ...validateRules(input.rules),
  ];
  if (errors.length > 0) return calculationFailure(...errors);

  const lines: CostEligibilityLineResult[] = [];
  for (const item of input.costItems) {
    const itemAmount = toDecimal(item.amount);
    let eligible = itemAmount;
    let manualReview = false;
    const ruleResults: CostEligibilityRuleResult[] = [];

    for (const rule of input.rules) {
      const before = eligible;
      let status: CostEligibilityRuleResult["status"] = "PASS";
      switch (rule.type) {
        case "INCLUDE_CATEGORIES":
          if (!rule.categories.includes(item.category)) {
            eligible = toDecimal(monetaryAmount("0"));
            status = "EXCLUDED";
          }
          break;
        case "EXCLUDE_CATEGORIES":
          if (rule.categories.includes(item.category)) {
            eligible = toDecimal(monetaryAmount("0"));
            status = "EXCLUDED";
          }
          break;
        case "INCLUDE_TAGS":
          if (!sharesAny(item.tags, rule.tags)) {
            eligible = toDecimal(monetaryAmount("0"));
            status = "EXCLUDED";
          }
          break;
        case "EXCLUDE_TAGS":
          if (sharesAny(item.tags, rule.tags)) {
            eligible = toDecimal(monetaryAmount("0"));
            status = "EXCLUDED";
          }
          break;
        case "PERCENTAGE_CAP": {
          const capped = itemAmount.times(percentageToFactor(rule.percentage));
          if (capped.lessThan(eligible)) {
            eligible = capped;
            status = "CAPPED";
          }
          break;
        }
        case "ABSOLUTE_CAP":
        case "MAXIMUM_ELIGIBLE_AMOUNT":
          if (toDecimal(rule.amount).lessThan(eligible)) {
            eligible = toDecimal(rule.amount);
            status = "CAPPED";
          }
          break;
        case "DURATION_CAP": {
          const rawDuration = getFact(input.facts, rule.durationFactPath);
          try {
            const duration = toDecimal(decimalValue(rawDuration));
            if (!duration.isPositive()) throw new Error();
            const maximumDuration = toDecimal(rule.maximumDuration);
            const capped = duration.greaterThan(maximumDuration)
              ? itemAmount.times(maximumDuration).dividedBy(duration)
              : itemAmount;
            if (capped.lessThan(eligible)) {
              eligible = capped;
              status = "CAPPED";
            }
          } catch {
            manualReview = true;
            status = "MANUAL_REVIEW";
          }
          break;
        }
        case "PER_UNIT_CAP": {
          const rawUnitCount = getFact(input.facts, rule.unitCountFactPath);
          try {
            const unitCount = toDecimal(decimalValue(rawUnitCount));
            if (unitCount.isNegative()) throw new Error();
            const capped = toDecimal(rule.maximumAmountPerUnit).times(
              unitCount,
            );
            if (capped.lessThan(eligible)) {
              eligible = capped;
              status = "CAPPED";
            }
          } catch {
            manualReview = true;
            status = "MANUAL_REVIEW";
          }
          break;
        }
        case "MANUAL_REVIEW":
          manualReview = true;
          status = "MANUAL_REVIEW";
          break;
        case "CUSTOM_RULE": {
          const handler = input.handlers?.getCostHandler(rule.handlerId);
          if (!handler) {
            manualReview = true;
            status = "MANUAL_REVIEW";
            break;
          }
          const custom = handler({
            rule,
            costItem: item,
            currentEligibleAmount: toMonetaryAmount(eligible),
            facts: input.facts,
          });
          const customAmount = toDecimal(monetaryAmount(custom.eligibleAmount));
          if (customAmount.isNegative() || customAmount.greaterThan(before)) {
            return calculationFailure({
              code: "INVALID_CUSTOM_COST_ELIGIBILITY_AMOUNT",
              message:
                "Custom cost eligibility must remain between zero and the current eligible amount.",
              path: `costItems.${item.costItemId}`,
            });
          }
          eligible = customAmount;
          manualReview ||= custom.manualReview === true;
          status = custom.manualReview
            ? "MANUAL_REVIEW"
            : eligible.lessThan(before)
              ? "CAPPED"
              : "PASS";
          break;
        }
      }
      ruleResults.push({
        ruleId: rule.ruleId,
        ruleType: rule.type,
        status,
        amountBefore: toMonetaryAmount(before),
        amountAfter: toMonetaryAmount(eligible),
        sourceReferences: rule.sourceReferences,
      });
    }

    const ineligible = itemAmount.minus(eligible);
    const status = manualReview
      ? "MANUAL_REVIEW_REQUIRED"
      : eligible.isZero()
        ? "INELIGIBLE"
        : eligible.equals(itemAmount)
          ? "ELIGIBLE"
          : "PARTIALLY_ELIGIBLE";
    lines.push({
      costItem: item,
      status,
      eligibleAmount: toMonetaryAmount(eligible),
      ineligibleAmount: toMonetaryAmount(ineligible),
      ruleResults,
    });
  }

  const totalProjectCost = lines.reduce(
    (total, line) => total.plus(toDecimal(line.costItem.amount)),
    toDecimal(monetaryAmount("0")),
  );
  const eligibleProjectCost = lines.reduce(
    (total, line) => total.plus(toDecimal(line.eligibleAmount)),
    toDecimal(monetaryAmount("0")),
  );
  return calculationSuccess({
    totalProjectCost: toMonetaryAmount(totalProjectCost),
    eligibleProjectCost: toMonetaryAmount(eligibleProjectCost),
    ineligibleProjectCost: toMonetaryAmount(
      totalProjectCost.minus(eligibleProjectCost),
    ),
    lines,
  });
}
