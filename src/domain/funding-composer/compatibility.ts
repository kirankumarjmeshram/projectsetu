import type { ISODate } from "../shared/types";
import { evaluateProgramCompatibility } from "../schemes/compatibility";
import type {
  ProgramConvergenceRule,
  ProgramEvaluationResult,
  ProgramEvaluationSnapshot,
} from "../schemes/program";
import type {
  BenefitCompatibilityEvaluation,
  FundingCompatibilityStatus,
  PairwiseCompatibilityEvaluation,
} from "./contracts";

function snapshotKey(snapshot: ProgramEvaluationSnapshot): string {
  return `${snapshot.programId}::${snapshot.programVersionId}`;
}

function canonicalPair(
  left: ProgramEvaluationResult,
  right: ProgramEvaluationResult,
): readonly [ProgramEvaluationResult, ProgramEvaluationResult] {
  return snapshotKey(left.snapshot).localeCompare(
    snapshotKey(right.snapshot),
  ) <= 0
    ? [left, right]
    : [right, left];
}

function mapStatus(
  status: ReturnType<typeof evaluateProgramCompatibility>["status"],
): FundingCompatibilityStatus {
  switch (status) {
    case "ALLOWED":
    case "OFFICIAL_CONVERGENCE_SUPPORTED":
      return "COMPATIBLE";
    case "PROHIBITED":
      return "INCOMPATIBLE";
    case "ALLOWED_WITH_CONDITIONS":
    case "ALLOWED_FOR_DISTINCT_COSTS":
    case "ALLOWED_FOR_DISTINCT_BENEFIT_TYPES":
      return "CONDITIONALLY_COMPATIBLE";
    case "REQUIRES_MANUAL_REVIEW":
      return "MANUAL_REVIEW_REQUIRED";
    case "UNKNOWN":
      return "UNKNOWN";
  }
}

function compatibilityReason(
  status: ReturnType<typeof evaluateProgramCompatibility>["status"],
): string {
  return `PROGRAM_COMPATIBILITY_${status}`;
}

export function evaluatePairwiseCompatibility(input: {
  readonly evaluations: readonly ProgramEvaluationResult[];
  readonly evaluationAsOfDate: ISODate;
  readonly compatibilityRules: readonly ProgramConvergenceRule[];
}): readonly PairwiseCompatibilityEvaluation[] {
  const sorted = [...input.evaluations].sort((left, right) =>
    snapshotKey(left.snapshot).localeCompare(snapshotKey(right.snapshot)),
  );
  const results: PairwiseCompatibilityEvaluation[] = [];
  for (let leftIndex = 0; leftIndex < sorted.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < sorted.length;
      rightIndex += 1
    ) {
      const [left, right] = canonicalPair(
        sorted[leftIndex]!,
        sorted[rightIndex]!,
      );
      const result = evaluateProgramCompatibility({
        programA: left.snapshot,
        programB: right.snapshot,
        asOfDate: input.evaluationAsOfDate,
        rules: input.compatibilityRules,
      });
      results.push({
        leftProgram: left.snapshot,
        rightProgram: right.snapshot,
        status: mapStatus(result.status),
        scope:
          result.status === "ALLOWED_FOR_DISTINCT_COSTS"
            ? "COST_PORTION"
            : result.status === "ALLOWED_FOR_DISTINCT_BENEFIT_TYPES" ||
                result.allowedBenefitTypes !== undefined ||
                result.prohibitedBenefitTypes !== undefined
              ? "BENEFIT"
              : "PROGRAM",
        reasonCode: compatibilityReason(result.status),
        conditions: result.conditions,
        result,
        sourceReferences: result.sourceReferences,
      });
    }
  }
  return results;
}

function benefitStatus(
  pair: PairwiseCompatibilityEvaluation,
  leftKind: ProgramEvaluationResult["benefits"][number]["benefitKind"],
  rightKind: ProgramEvaluationResult["benefits"][number]["benefitKind"],
): {
  readonly status: FundingCompatibilityStatus;
  readonly reasonCode: string;
} {
  if (pair.status === "INCOMPATIBLE") {
    return {
      status: "INCOMPATIBLE",
      reasonCode: "PROGRAM_RULE_PROHIBITS_BENEFIT_PAIR",
    };
  }
  if (pair.status === "UNKNOWN") {
    return { status: "UNKNOWN", reasonCode: "BENEFIT_COMPATIBILITY_UNKNOWN" };
  }
  if (pair.status === "MANUAL_REVIEW_REQUIRED") {
    return {
      status: "MANUAL_REVIEW_REQUIRED",
      reasonCode: "BENEFIT_COMPATIBILITY_REQUIRES_MANUAL_REVIEW",
    };
  }
  const rule = pair.result;
  const prohibited = [leftKind, rightKind].some((kind) =>
    rule.prohibitedBenefitTypes?.includes(kind),
  );
  const outsideAllowed = [leftKind, rightKind].some(
    (kind) =>
      rule.allowedBenefitTypes !== undefined &&
      !rule.allowedBenefitTypes.includes(kind),
  );
  if (prohibited || outsideAllowed) {
    return {
      status: "INCOMPATIBLE",
      reasonCode: "BENEFIT_KIND_NOT_ALLOWED_BY_CONVERGENCE_RULE",
    };
  }
  if (
    rule.status === "ALLOWED_FOR_DISTINCT_BENEFIT_TYPES" &&
    leftKind === rightKind
  ) {
    return {
      status: "INCOMPATIBLE",
      reasonCode: "CONVERGENCE_REQUIRES_DISTINCT_BENEFIT_KINDS",
    };
  }
  return {
    status:
      pair.status === "CONDITIONALLY_COMPATIBLE"
        ? "CONDITIONALLY_COMPATIBLE"
        : "COMPATIBLE",
    reasonCode:
      pair.status === "CONDITIONALLY_COMPATIBLE"
        ? "BENEFIT_PAIR_ALLOWED_SUBJECT_TO_CONDITIONS"
        : "BENEFIT_PAIR_ALLOWED",
  };
}

export function evaluateBenefitCompatibility(input: {
  readonly evaluations: readonly ProgramEvaluationResult[];
  readonly pairwise: readonly PairwiseCompatibilityEvaluation[];
}): readonly BenefitCompatibilityEvaluation[] {
  const evaluationBySnapshot = new Map(
    input.evaluations.map((evaluation) => [
      snapshotKey(evaluation.snapshot),
      evaluation,
    ]),
  );
  const results: BenefitCompatibilityEvaluation[] = [];
  for (const pair of input.pairwise) {
    const left = evaluationBySnapshot.get(snapshotKey(pair.leftProgram));
    const right = evaluationBySnapshot.get(snapshotKey(pair.rightProgram));
    if (!left || !right) continue;
    for (const leftBenefit of left.benefits) {
      if (leftBenefit.status !== "CALCULATED") continue;
      for (const rightBenefit of right.benefits) {
        if (rightBenefit.status !== "CALCULATED") continue;
        const resolution = benefitStatus(
          pair,
          leftBenefit.benefitKind,
          rightBenefit.benefitKind,
        );
        results.push({
          leftProgram: pair.leftProgram,
          leftBenefitId: leftBenefit.benefitId,
          leftBenefitKind: leftBenefit.benefitKind,
          rightProgram: pair.rightProgram,
          rightBenefitId: rightBenefit.benefitId,
          rightBenefitKind: rightBenefit.benefitKind,
          status: resolution.status,
          reasonCode: resolution.reasonCode,
          sourceReferences: pair.sourceReferences,
        });
      }
    }
  }
  return results;
}
