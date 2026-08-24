import { monetaryAmount, toDecimal } from "../shared/decimal";
import type { ISODate } from "../shared/types";
import type {
  CostAssistanceAllocation,
  ProgramCompatibilityResult,
  ProgramConvergenceRule,
  ProgramEvaluationResult,
  ProgramEvaluationSnapshot,
  ProgramStackConflict,
  SchemeCostItem,
} from "./program";

function sameSnapshot(
  left: ProgramEvaluationResult,
  right: ProgramCompatibilityResult["programA"],
): boolean {
  return (
    left.snapshot.programId === right.programId &&
    left.snapshot.programVersionId === right.programVersionId
  );
}

export function validateBenefitCompatibility(input: {
  readonly evaluations: readonly ProgramEvaluationResult[];
  readonly compatibilityResults: readonly ProgramCompatibilityResult[];
}): readonly ProgramStackConflict[] {
  const conflicts: ProgramStackConflict[] = [];
  for (const compatibility of input.compatibilityResults) {
    const left = input.evaluations.find((evaluation) =>
      sameSnapshot(evaluation, compatibility.programA),
    );
    const right = input.evaluations.find((evaluation) =>
      sameSnapshot(evaluation, compatibility.programB),
    );
    if (!left || !right) continue;
    const benefits = [...left.benefits, ...right.benefits].filter(
      (benefit) => benefit.status === "CALCULATED",
    );
    const incompatible = benefits.filter(
      (benefit) =>
        compatibility.prohibitedBenefitTypes?.includes(benefit.benefitKind) ||
        (compatibility.allowedBenefitTypes !== undefined &&
          !compatibility.allowedBenefitTypes.includes(benefit.benefitKind)),
    );
    if (incompatible.length > 0) {
      conflicts.push({
        code: "INCOMPATIBLE_BENEFITS",
        programIds: [
          compatibility.programA.programId,
          compatibility.programB.programId,
        ],
        benefitIds: incompatible.map((benefit) => benefit.benefitId),
        message:
          "The convergence rule does not permit one or more calculated benefit types.",
      });
    }
  }
  return conflicts;
}

function appliesToSnapshot(
  constraint: ProgramConvergenceRule["programA"],
  snapshot: ProgramEvaluationSnapshot,
): boolean {
  return (
    constraint.programId === snapshot.programId &&
    (constraint.versionIds === undefined ||
      constraint.versionIds.includes(snapshot.programVersionId))
  );
}

function matchesPair(
  rule: ProgramConvergenceRule,
  left: ProgramEvaluationSnapshot,
  right: ProgramEvaluationSnapshot,
): boolean {
  return (
    (appliesToSnapshot(rule.programA, left) &&
      appliesToSnapshot(rule.programB, right)) ||
    (appliesToSnapshot(rule.programA, right) &&
      appliesToSnapshot(rule.programB, left))
  );
}

export function evaluateProgramCompatibility(input: {
  readonly programA: ProgramEvaluationSnapshot;
  readonly programB: ProgramEvaluationSnapshot;
  readonly asOfDate: ISODate;
  readonly rules: readonly ProgramConvergenceRule[];
}): ProgramCompatibilityResult {
  const matches = input.rules
    .filter(
      (rule) =>
        matchesPair(rule, input.programA, input.programB) &&
        rule.effectiveFrom <= input.asOfDate &&
        (rule.effectiveTo === undefined || rule.effectiveTo >= input.asOfDate),
    )
    .sort((left, right) =>
      right.effectiveFrom.localeCompare(left.effectiveFrom),
    );

  const rule = matches[0];
  if (!rule) {
    return {
      programA: input.programA,
      programB: input.programB,
      status: "UNKNOWN",
      sameCostItemPolicy: "MANUAL_REVIEW",
      conditions: [],
      sourceReferences: [],
    };
  }
  if (matches.length > 1 && matches[1]!.effectiveFrom === rule.effectiveFrom) {
    return {
      programA: input.programA,
      programB: input.programB,
      status: "REQUIRES_MANUAL_REVIEW",
      sameCostItemPolicy: "MANUAL_REVIEW",
      conditions: ["AMBIGUOUS_CONVERGENCE_RULE_VERSION"],
      sourceReferences: [
        ...rule.sourceReferences,
        ...matches[1]!.sourceReferences,
      ],
    };
  }
  return {
    programA: input.programA,
    programB: input.programB,
    status: rule.compatibilityStatus,
    sameCostItemPolicy: rule.sameCostItemPolicy,
    ...(rule.allowedBenefitTypes
      ? { allowedBenefitTypes: rule.allowedBenefitTypes }
      : {}),
    ...(rule.prohibitedBenefitTypes
      ? { prohibitedBenefitTypes: rule.prohibitedBenefitTypes }
      : {}),
    convergenceRuleId: rule.convergenceRuleId,
    conditions: rule.conditions ?? [],
    sourceReferences: rule.sourceReferences,
  };
}

function compatibilityFor(
  results: readonly ProgramCompatibilityResult[],
  left: CostAssistanceAllocation,
  right: CostAssistanceAllocation,
): ProgramCompatibilityResult | undefined {
  return results.find(
    (result) =>
      (result.programA.programId === left.programId &&
        result.programB.programId === right.programId) ||
      (result.programA.programId === right.programId &&
        result.programB.programId === left.programId),
  );
}

function conflictKey(conflict: ProgramStackConflict): string {
  return [
    conflict.code,
    [...conflict.programIds].sort().join("|"),
    conflict.costItemId ?? "",
    [...(conflict.benefitIds ?? [])].sort().join("|"),
  ].join("::");
}

export function validateAssistanceAllocations(input: {
  readonly allocations: readonly CostAssistanceAllocation[];
  readonly costItems: readonly SchemeCostItem[];
  readonly compatibilityResults: readonly ProgramCompatibilityResult[];
}): readonly ProgramStackConflict[] {
  const conflicts: ProgramStackConflict[] = [];
  const costById = new Map(
    input.costItems.map((item) => [item.costItemId, item] as const),
  );

  for (const compatibility of input.compatibilityResults) {
    if (compatibility.status === "PROHIBITED") {
      conflicts.push({
        code: "PROGRAM_CONFLICT",
        programIds: [
          compatibility.programA.programId,
          compatibility.programB.programId,
        ],
        message: "The selected program versions are explicitly prohibited.",
      });
    } else if (compatibility.status === "UNKNOWN") {
      conflicts.push({
        code: "MISSING_CONVERGENCE_RULE",
        programIds: [
          compatibility.programA.programId,
          compatibility.programB.programId,
        ],
        message:
          "No compatibility rule exists; the combination requires manual review.",
      });
    }
  }

  const byCost = new Map<string, CostAssistanceAllocation[]>();
  for (const allocation of input.allocations) {
    const existing = byCost.get(allocation.costItemId) ?? [];
    existing.push(allocation);
    byCost.set(allocation.costItemId, existing);
  }

  for (const [costItemId, allocations] of byCost) {
    for (let leftIndex = 0; leftIndex < allocations.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < allocations.length;
        rightIndex += 1
      ) {
        const left = allocations[leftIndex]!;
        const right = allocations[rightIndex]!;
        if (left.programId === right.programId) continue;
        const compatibility = compatibilityFor(
          input.compatibilityResults,
          left,
          right,
        );
        const policy = compatibility?.sameCostItemPolicy ?? "MANUAL_REVIEW";
        const programIds = [left.programId, right.programId];
        const benefitIds = [left.benefitId, right.benefitId];

        if (
          policy === "NO_DOUBLE_ASSISTANCE" ||
          compatibility?.status === "ALLOWED_FOR_DISTINCT_COSTS"
        ) {
          conflicts.push({
            code: "DOUBLE_FUNDING_CONFLICT",
            programIds,
            costItemId,
            benefitIds,
            message: "Two programs allocate assistance to the same cost item.",
          });
        } else if (
          policy === "ALLOW_DIFFERENT_BENEFIT_TYPES" &&
          left.benefitKind === right.benefitKind
        ) {
          conflicts.push({
            code: "INCOMPATIBLE_BENEFITS",
            programIds,
            costItemId,
            benefitIds,
            message:
              "The same-cost rule allows only distinct benefit types for this item.",
          });
        } else if (policy === "DISTINCT_COST_PORTIONS_ONLY") {
          const distinct =
            left.allocationType === "DISTINCT_PORTION" &&
            right.allocationType === "DISTINCT_PORTION" &&
            left.portionId !== undefined &&
            right.portionId !== undefined &&
            left.portionId !== right.portionId;
          if (!distinct) {
            conflicts.push({
              code: "OVERLAPPING_COST_BASIS",
              programIds,
              costItemId,
              benefitIds,
              message:
                "Distinct-cost-portions policy requires explicit non-overlapping portion identities.",
            });
          }
        } else if (policy === "MANUAL_REVIEW") {
          conflicts.push({
            code: "OVERLAPPING_COST_BASIS",
            programIds,
            costItemId,
            benefitIds,
            message: "Same-cost assistance requires manual convergence review.",
          });
        }
      }
    }

    const cost = costById.get(costItemId);
    const allowsUpToCost = allocations.some((left) =>
      allocations.some((right) => {
        if (left === right || left.programId === right.programId) return false;
        return (
          compatibilityFor(input.compatibilityResults, left, right)
            ?.sameCostItemPolicy === "ALLOW_UP_TO_COST"
        );
      }),
    );
    if (cost && allowsUpToCost) {
      const totalAssistance = allocations.reduce(
        (total, allocation) => total.plus(toDecimal(allocation.benefitAmount)),
        toDecimal(monetaryAmount("0")),
      );
      if (totalAssistance.greaterThan(toDecimal(cost.amount))) {
        conflicts.push({
          code: "DOUBLE_FUNDING_CONFLICT",
          programIds: [...new Set(allocations.map((item) => item.programId))],
          costItemId,
          benefitIds: allocations.map((item) => item.benefitId),
          message: "Combined assistance exceeds the cost item amount.",
        });
      }
    }

    const requiresDistinctPortions = allocations.some((left) =>
      allocations.some((right) => {
        if (left === right || left.programId === right.programId) return false;
        return (
          compatibilityFor(input.compatibilityResults, left, right)
            ?.sameCostItemPolicy === "DISTINCT_COST_PORTIONS_ONLY"
        );
      }),
    );
    if (cost && requiresDistinctPortions) {
      const allocatedBasis = allocations.reduce(
        (total, allocation) =>
          total.plus(toDecimal(allocation.eligibleBasisAmount)),
        toDecimal(monetaryAmount("0")),
      );
      if (allocatedBasis.greaterThan(toDecimal(cost.amount))) {
        conflicts.push({
          code: "OVERLAPPING_COST_BASIS",
          programIds: [...new Set(allocations.map((item) => item.programId))],
          costItemId,
          benefitIds: allocations.map((item) => item.benefitId),
          message:
            "Explicit distinct portions allocate more basis than the cost item amount.",
        });
      }
    }
  }

  const unique = new Map<string, ProgramStackConflict>();
  for (const conflict of conflicts) unique.set(conflictKey(conflict), conflict);
  return [...unique.values()];
}
