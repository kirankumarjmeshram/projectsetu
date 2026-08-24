import type { CalculationResult } from "../shared/calculation";
import { calculationFailure, calculationSuccess } from "../shared/calculation";
import { decimalValue, toDecimal } from "../shared/decimal";
import type { Identifier, MonetaryAmount } from "../shared/types";
import type {
  CostEligibilityRule,
  EligibilityRule,
  FactPath,
  FactValue,
  FinancialBenefitDefinition,
  ProgramEvaluationFacts,
  ProjectCostEligibilityResult,
  RuleEvaluationResult,
  RuleEvaluationStatus,
  SchemeCostItem,
} from "./program";

export interface CustomEligibilityEvaluation {
  readonly status: RuleEvaluationStatus;
  readonly explanationCode: string;
}

export type CustomEligibilityHandler = (input: {
  readonly rule: Extract<
    EligibilityRule,
    { readonly type: "CUSTOM_PREDICATE" }
  >;
  readonly facts: ProgramEvaluationFacts;
}) => CustomEligibilityEvaluation;

export type CustomCostEligibilityHandler = (input: {
  readonly rule: Extract<CostEligibilityRule, { readonly type: "CUSTOM_RULE" }>;
  readonly costItem: SchemeCostItem;
  readonly currentEligibleAmount: MonetaryAmount;
  readonly facts: ProgramEvaluationFacts;
}) => {
  readonly eligibleAmount: MonetaryAmount;
  readonly manualReview?: boolean;
};

export type CustomBenefitHandler = (input: {
  readonly definition: Extract<
    FinancialBenefitDefinition,
    { readonly calculation: "CUSTOM" }
  >;
  readonly facts: ProgramEvaluationFacts;
  readonly costEligibility: ProjectCostEligibilityResult;
  readonly actualBeneficiaryContribution?: MonetaryAmount;
  readonly actualBankFinance?: MonetaryAmount;
}) => MonetaryAmount;

/** Explicit pure-function extension registry; it never evaluates code strings. */
export class ProgramRuleHandlerRegistry {
  readonly #eligibilityHandlers = new Map<
    Identifier,
    CustomEligibilityHandler
  >();
  readonly #costHandlers = new Map<Identifier, CustomCostEligibilityHandler>();
  readonly #benefitHandlers = new Map<Identifier, CustomBenefitHandler>();

  registerEligibilityHandler(
    handlerId: Identifier,
    handler: CustomEligibilityHandler,
  ): CalculationResult<Identifier> {
    return this.register(this.#eligibilityHandlers, handlerId, handler);
  }

  registerCostHandler(
    handlerId: Identifier,
    handler: CustomCostEligibilityHandler,
  ): CalculationResult<Identifier> {
    return this.register(this.#costHandlers, handlerId, handler);
  }

  registerBenefitHandler(
    handlerId: Identifier,
    handler: CustomBenefitHandler,
  ): CalculationResult<Identifier> {
    return this.register(this.#benefitHandlers, handlerId, handler);
  }

  getEligibilityHandler(
    handlerId: Identifier,
  ): CustomEligibilityHandler | undefined {
    return this.#eligibilityHandlers.get(handlerId);
  }

  getCostHandler(
    handlerId: Identifier,
  ): CustomCostEligibilityHandler | undefined {
    return this.#costHandlers.get(handlerId);
  }

  getBenefitHandler(handlerId: Identifier): CustomBenefitHandler | undefined {
    return this.#benefitHandlers.get(handlerId);
  }

  private register<THandler>(
    handlers: Map<Identifier, THandler>,
    handlerId: Identifier,
    handler: THandler,
  ): CalculationResult<Identifier> {
    if (handlerId.trim().length === 0) {
      return calculationFailure({
        code: "INVALID_PROGRAM_HANDLER_ID",
        message: "Program handler id must not be empty.",
      });
    }
    if (handlers.has(handlerId)) {
      return calculationFailure({
        code: "PROGRAM_HANDLER_ALREADY_REGISTERED",
        message: "Program handlers are immutable after registration.",
      });
    }
    handlers.set(handlerId, handler);
    return calculationSuccess(handlerId);
  }
}

export function getFact(
  facts: ProgramEvaluationFacts,
  path: FactPath,
): FactValue | undefined {
  const separatorIndex = path.indexOf(".");
  const group = path.slice(0, separatorIndex) as keyof ProgramEvaluationFacts;
  const key = path.slice(separatorIndex + 1);
  return facts[group]?.[key];
}

function containsExpected(
  actual: FactValue,
  expectedValues: readonly string[],
): boolean {
  if (Array.isArray(actual)) {
    return actual.some((value) => expectedValues.includes(value));
  }
  return typeof actual === "string" && expectedValues.includes(actual);
}

function statusForPass(rule: EligibilityRule): RuleEvaluationStatus {
  return rule.passAsConditional ? "CONDITIONAL_PASS" : "PASS";
}

function result(
  rule: EligibilityRule,
  status: RuleEvaluationStatus,
  explanationCode: string,
  actualValue?: FactValue,
): RuleEvaluationResult {
  return {
    ruleId: rule.ruleId,
    ruleType: rule.type,
    status,
    ...(rule.type === "CUSTOM_PREDICATE"
      ? {}
      : { factPath: rule.factPath, actualValue }),
    explanationCode,
    sourceReferences: rule.sourceReferences,
  };
}

export function evaluateEligibilityRule(
  rule: EligibilityRule,
  facts: ProgramEvaluationFacts,
  handlers?: ProgramRuleHandlerRegistry,
): RuleEvaluationResult {
  if (rule.type === "CUSTOM_PREDICATE") {
    const handler = handlers?.getEligibilityHandler(rule.predicateId);
    if (!handler) {
      return result(rule, "MANUAL_REVIEW", "CUSTOM_HANDLER_NOT_REGISTERED");
    }
    const evaluation = handler({ rule, facts });
    return result(rule, evaluation.status, evaluation.explanationCode);
  }

  const actual = getFact(facts, rule.factPath);
  if (actual === undefined) {
    return result(rule, "UNKNOWN", "REQUIRED_FACT_MISSING");
  }

  if (rule.type === "REQUIRED") {
    const present =
      typeof actual === "string"
        ? actual.length > 0
        : Array.isArray(actual)
          ? actual.length > 0
          : true;
    return result(
      rule,
      present ? statusForPass(rule) : "UNKNOWN",
      present ? "REQUIRED_FACT_PRESENT" : "REQUIRED_FACT_EMPTY",
      actual,
    );
  }

  let passed: boolean;
  try {
    switch (rule.type) {
      case "EQUALS":
        passed = actual === rule.expectedValue;
        break;
      case "NOT_EQUALS":
        passed = actual !== rule.expectedValue;
        break;
      case "IN":
      case "LOCATION":
      case "ENTITY_TYPE":
        passed = containsExpected(actual, rule.expectedValues);
        break;
      case "NOT_IN":
        passed = !containsExpected(actual, rule.expectedValues);
        break;
      case "MINIMUM":
        passed = toDecimal(decimalValue(actual)).greaterThanOrEqualTo(
          toDecimal(rule.minimum),
        );
        break;
      case "MAXIMUM":
        passed = toDecimal(decimalValue(actual)).lessThanOrEqualTo(
          toDecimal(rule.maximum),
        );
        break;
      case "RANGE": {
        const value = toDecimal(decimalValue(actual));
        passed =
          value.greaterThanOrEqualTo(toDecimal(rule.minimum)) &&
          value.lessThanOrEqualTo(toDecimal(rule.maximum));
        break;
      }
      case "BOOLEAN":
        passed = actual === rule.expectedValue;
        break;
      case "DATE_RANGE":
        passed =
          typeof actual === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(actual) &&
          actual >= rule.from &&
          (rule.until === undefined || actual <= rule.until);
        break;
      case "ACTIVITY_INCLUDED":
        passed = containsExpected(actual, rule.tags);
        break;
      case "ACTIVITY_EXCLUDED":
        passed = !containsExpected(actual, rule.tags);
        break;
    }
  } catch {
    return result(rule, "MANUAL_REVIEW", "FACT_VALUE_INVALID", actual);
  }

  return result(
    rule,
    passed ? statusForPass(rule) : "FAIL",
    passed ? "RULE_CONDITION_SATISFIED" : "RULE_CONDITION_NOT_SATISFIED",
    actual,
  );
}
