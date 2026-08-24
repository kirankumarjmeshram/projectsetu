import type {
  EligibilityRule,
  EligibilityRuleGroup,
  ProgramEligibilityResult,
  ProgramEvaluationFacts,
  RuleEvaluationResult,
  RuleEvaluationStatus,
} from "./program";
import {
  evaluateEligibilityRule,
  type ProgramRuleHandlerRegistry,
} from "./rules";

function isRuleGroup(
  rule: EligibilityRule | EligibilityRuleGroup,
): rule is EligibilityRuleGroup {
  return "operator" in rule;
}

function combineStatuses(
  operator: EligibilityRuleGroup["operator"],
  statuses: readonly RuleEvaluationStatus[],
): RuleEvaluationStatus {
  if (operator === "ALL") {
    if (statuses.includes("FAIL")) return "FAIL";
    if (statuses.includes("MANUAL_REVIEW")) return "MANUAL_REVIEW";
    if (statuses.includes("UNKNOWN")) return "UNKNOWN";
    if (statuses.includes("CONDITIONAL_PASS")) return "CONDITIONAL_PASS";
    return "PASS";
  }
  if (operator === "ANY") {
    if (statuses.includes("PASS")) return "PASS";
    if (statuses.includes("CONDITIONAL_PASS")) return "CONDITIONAL_PASS";
    if (statuses.includes("MANUAL_REVIEW")) return "MANUAL_REVIEW";
    if (statuses.includes("UNKNOWN")) return "UNKNOWN";
    return "FAIL";
  }

  if (statuses.includes("PASS") || statuses.includes("CONDITIONAL_PASS")) {
    return "FAIL";
  }
  if (statuses.includes("MANUAL_REVIEW")) return "MANUAL_REVIEW";
  if (statuses.includes("UNKNOWN")) return "UNKNOWN";
  return "PASS";
}

export function evaluateEligibilityRuleGroup(
  group: EligibilityRuleGroup,
  facts: ProgramEvaluationFacts,
  handlers?: ProgramRuleHandlerRegistry,
): RuleEvaluationResult {
  const children = group.rules.map((rule) =>
    isRuleGroup(rule)
      ? evaluateEligibilityRuleGroup(rule, facts, handlers)
      : evaluateEligibilityRule(rule, facts, handlers),
  );
  return {
    ruleId: group.groupId,
    ruleType: "GROUP",
    status: combineStatuses(
      group.operator,
      children.map((child) => child.status),
    ),
    explanationCode: `COMPOSITE_${group.operator}`,
    sourceReferences: [],
    children,
  };
}

function flattenRuleResults(
  result: RuleEvaluationResult,
): readonly RuleEvaluationResult[] {
  return [
    result,
    ...(result.children?.flatMap((child) => flattenRuleResults(child)) ?? []),
  ];
}

export function evaluateProgramEligibility(
  rules: EligibilityRuleGroup,
  facts: ProgramEvaluationFacts,
  handlers?: ProgramRuleHandlerRegistry,
): ProgramEligibilityResult {
  const rootRuleResult = evaluateEligibilityRuleGroup(rules, facts, handlers);
  const status =
    rootRuleResult.status === "PASS"
      ? "ELIGIBLE"
      : rootRuleResult.status === "CONDITIONAL_PASS"
        ? "CONDITIONALLY_ELIGIBLE"
        : rootRuleResult.status === "FAIL"
          ? "INELIGIBLE"
          : rootRuleResult.status === "UNKNOWN"
            ? "INSUFFICIENT_INFORMATION"
            : "MANUAL_REVIEW_REQUIRED";
  return {
    status,
    rootRuleResult,
    ruleResults: flattenRuleResults(rootRuleResult),
  };
}
