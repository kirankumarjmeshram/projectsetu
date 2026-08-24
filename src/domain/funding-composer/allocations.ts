import { calculationFailure, calculationSuccess } from "../shared/calculation";
import type { CalculationResult } from "../shared/calculation";
import { monetaryAmount, toDecimal, toMonetaryAmount } from "../shared/decimal";
import type { Identifier } from "../shared/types";
import type {
  BenefitKind,
  CalculatedBenefitResult,
  FinancialBenefitDefinition,
  ProgramEvaluationResult,
  SchemeCostItem,
} from "../schemes/program";
import type {
  FundingAllocationKind,
  FundingAllocationLedgerEntry,
  FundingAvailability,
  FundingConflict,
  FundingExplanation,
  IndividualProgramCompositionEvaluation,
  PairwiseCompatibilityEvaluation,
  RequestedProgramAllocation,
} from "./contracts";

interface ResolvedBenefit {
  readonly program: IndividualProgramCompositionEvaluation;
  readonly evaluation: ProgramEvaluationResult;
  readonly definition: FinancialBenefitDefinition;
  readonly result: CalculatedBenefitResult & {
    readonly status: "CALCULATED";
    readonly calculatedEligibleBenefit: NonNullable<
      CalculatedBenefitResult["calculatedEligibleBenefit"]
    >;
  };
}

export interface FundingAllocationResult {
  readonly ledger: readonly FundingAllocationLedgerEntry[];
  readonly conflicts: readonly FundingConflict[];
  readonly warnings: readonly FundingExplanation[];
}

const zero = monetaryAmount("0");

function fundingKind(kind: BenefitKind): FundingAllocationKind {
  switch (kind) {
    case "CAPITAL_SUBSIDY":
      return "SUBSIDY";
    case "MARGIN_MONEY":
      return "MARGIN_MONEY";
    case "GRANT":
      return "GRANT";
    case "SEED_CAPITAL":
      return "SEED_CAPITAL";
    case "REIMBURSEMENT":
      return "REIMBURSEMENT";
    case "INTEREST_SUBVENTION":
      return "INTEREST_SUBVENTION";
    case "CREDIT_GUARANTEE":
      return "CREDIT_GUARANTEE";
    case "LOAN_LIMIT":
    case "CREDIT_SUPPORT":
      return "CREDIT";
    case "CUSTOM":
      return "OTHER";
  }
}

function availability(
  kind: BenefitKind,
  release: CalculatedBenefitResult["release"],
): FundingAvailability {
  if (kind === "INTEREST_SUBVENTION" || kind === "CREDIT_GUARANTEE") {
    return "NON_CASH_CONTINGENT";
  }
  return release.mechanism === "UPFRONT" ? "INITIAL" : "DEFERRED_CONDITIONAL";
}

function isCostBased(definition: FinancialBenefitDefinition): boolean {
  return [
    "TOTAL_PROJECT_COST",
    "ELIGIBLE_PROJECT_COST",
    "ELIGIBLE_CAPITAL_COST",
    "SPECIFIC_COST_COMPONENTS",
  ].includes(definition.basis);
}

function basisLines(benefit: ResolvedBenefit): readonly {
  readonly costItemId: Identifier;
  readonly amount: ReturnType<typeof toDecimal>;
}[] {
  if (!isCostBased(benefit.definition)) return [];
  return benefit.evaluation.costEligibility.lines
    .filter((line) => {
      if (benefit.definition.basis === "ELIGIBLE_CAPITAL_COST") {
        return line.costItem.tags.some((tag) => tag === "CAPITAL");
      }
      if (benefit.definition.basis === "SPECIFIC_COST_COMPONENTS") {
        return benefit.definition.specificCostItemIds?.includes(
          line.costItem.costItemId,
        );
      }
      return true;
    })
    .map((line) => ({
      costItemId: line.costItem.costItemId,
      amount: toDecimal(
        benefit.definition.basis === "TOTAL_PROJECT_COST"
          ? line.costItem.amount
          : line.eligibleAmount,
      ),
    }))
    .filter((line) => !line.amount.isNegative());
}

function resolvedBenefits(
  programs: readonly IndividualProgramCompositionEvaluation[],
): readonly ResolvedBenefit[] {
  return programs.flatMap((program) => {
    if (!program.definition || !program.evaluation) return [];
    return program.evaluation.benefits.flatMap((result) => {
      if (
        result.status !== "CALCULATED" ||
        result.calculatedEligibleBenefit === undefined
      ) {
        return [];
      }
      const definition = program.definition!.benefits.find(
        (candidate) => candidate.benefitId === result.benefitId,
      );
      return definition
        ? [
            {
              program,
              evaluation: program.evaluation!,
              definition,
              result: result as ResolvedBenefit["result"],
            },
          ]
        : [];
    });
  });
}

function benefitKey(programId: string, versionId: string, benefitId: string) {
  return `${programId}::${versionId}::${benefitId}`;
}

function composedBenefitAmount(benefit: ResolvedBenefit) {
  const uncappedProgramTotal = benefit.evaluation.benefits.reduce(
    (total, result) =>
      total.plus(
        result.status === "CALCULATED" &&
          result.calculatedEligibleBenefit !== undefined
          ? toDecimal(result.calculatedEligibleBenefit)
          : toDecimal(zero),
      ),
    toDecimal(zero),
  );
  if (uncappedProgramTotal.isZero()) return toDecimal(zero);
  return toDecimal(benefit.result.calculatedEligibleBenefit)
    .times(toDecimal(benefit.evaluation.totalCalculatedEligibleBenefit))
    .dividedBy(uncappedProgramTotal);
}

function distributeBenefit(
  benefit: ResolvedBenefit,
  portions: readonly {
    readonly allocationId: Identifier;
    readonly costItemId: Identifier;
    readonly costPortionId: Identifier;
    readonly allocatedCostAmount: ReturnType<typeof toDecimal>;
    readonly allocationType: "AUTO" | "MANUAL";
  }[],
): readonly FundingAllocationLedgerEntry[] {
  const totalBasis = portions.reduce(
    (total, portion) => total.plus(portion.allocatedCostAmount),
    toDecimal(zero),
  );
  const calculatedBenefit = composedBenefitAmount(benefit);
  let allocatedBenefit = toDecimal(zero);
  return portions.map((portion, index) => {
    const amount = totalBasis.isZero()
      ? toDecimal(zero)
      : index === portions.length - 1
        ? calculatedBenefit.minus(allocatedBenefit)
        : calculatedBenefit
            .times(portion.allocatedCostAmount)
            .dividedBy(totalBasis);
    allocatedBenefit = allocatedBenefit.plus(amount);
    return {
      allocationId: portion.allocationId,
      programId: benefit.evaluation.snapshot.programId,
      programVersionId: benefit.evaluation.snapshot.programVersionId,
      benefitId: benefit.result.benefitId,
      benefitKind: benefit.result.benefitKind,
      fundingKind: fundingKind(benefit.result.benefitKind),
      availability: availability(
        benefit.result.benefitKind,
        benefit.result.release,
      ),
      costItemId: portion.costItemId,
      costPortionId: portion.costPortionId,
      basisAmount: toMonetaryAmount(portion.allocatedCostAmount),
      allocatedCostAmount: toMonetaryAmount(portion.allocatedCostAmount),
      benefitAmount: toMonetaryAmount(amount),
      allocationType: portion.allocationType,
      release: benefit.result.release,
      sourceRuleIds: [benefit.result.benefitId],
      sourceReferences: benefit.result.sourceReferences,
    };
  });
}

function nonCostEntry(benefit: ResolvedBenefit): FundingAllocationLedgerEntry {
  return {
    allocationId: `NON_COST.${benefit.evaluation.snapshot.programId}.${benefit.result.benefitId}`,
    programId: benefit.evaluation.snapshot.programId,
    programVersionId: benefit.evaluation.snapshot.programVersionId,
    benefitId: benefit.result.benefitId,
    benefitKind: benefit.result.benefitKind,
    fundingKind: fundingKind(benefit.result.benefitKind),
    availability: availability(
      benefit.result.benefitKind,
      benefit.result.release,
    ),
    basisAmount: benefit.result.trace?.basisAmount ?? zero,
    allocatedCostAmount: zero,
    benefitAmount: toMonetaryAmount(composedBenefitAmount(benefit)),
    allocationType: "NON_COST_BASED",
    release: benefit.result.release,
    sourceRuleIds: [benefit.result.benefitId],
    sourceReferences: benefit.result.sourceReferences,
  };
}

function pairFor(
  pairs: readonly PairwiseCompatibilityEvaluation[],
  leftProgramId: string,
  rightProgramId: string,
) {
  return pairs.find(
    (pair) =>
      (pair.leftProgram.programId === leftProgramId &&
        pair.rightProgram.programId === rightProgramId) ||
      (pair.leftProgram.programId === rightProgramId &&
        pair.rightProgram.programId === leftProgramId),
  );
}

function conflictKey(conflict: FundingConflict): string {
  return [
    conflict.code,
    [...conflict.programIds].sort().join("|"),
    [...(conflict.benefitIds ?? [])].sort().join("|"),
    [...(conflict.costItemIds ?? [])].sort().join("|"),
  ].join("::");
}

function addRemainingCost(
  ledger: readonly FundingAllocationLedgerEntry[],
  costItems: readonly SchemeCostItem[],
): readonly FundingAllocationLedgerEntry[] {
  const costs = new Map(
    costItems.map((item) => [item.costItemId, item.amount]),
  );
  const consumed = new Map<string, ReturnType<typeof toDecimal>>();
  return [...ledger]
    .sort((left, right) => left.allocationId.localeCompare(right.allocationId))
    .map((entry) => {
      if (!entry.costItemId) return entry;
      const next = (consumed.get(entry.costItemId) ?? toDecimal(zero)).plus(
        toDecimal(entry.allocatedCostAmount),
      );
      consumed.set(entry.costItemId, next);
      const cost = costs.get(entry.costItemId);
      return cost === undefined
        ? entry
        : {
            ...entry,
            remainingCostAmount: toMonetaryAmount(toDecimal(cost).minus(next)),
          };
    });
}

export function createFundingAllocations(input: {
  readonly programs: readonly IndividualProgramCompositionEvaluation[];
  readonly costItems: readonly SchemeCostItem[];
  readonly compatibility: readonly PairwiseCompatibilityEvaluation[];
  readonly requestedAllocations: readonly RequestedProgramAllocation[];
}): CalculationResult<FundingAllocationResult> {
  const errors = input.requestedAllocations.flatMap((request, index) => {
    try {
      return toDecimal(monetaryAmount(request.allocatedCostAmount)).isNegative()
        ? [
            {
              code: "NEGATIVE_ALLOCATION_AMOUNT",
              message: "Allocated cost amount must not be negative.",
              path: `requestedAllocations.${index}.allocatedCostAmount`,
            },
          ]
        : [];
    } catch {
      return [
        {
          code: "INVALID_ALLOCATION_AMOUNT",
          message: "Allocated cost amount must be a canonical monetary value.",
          path: `requestedAllocations.${index}.allocatedCostAmount`,
        },
      ];
    }
  });
  if (errors.length > 0) return calculationFailure(...errors);

  const benefits = resolvedBenefits(input.programs);
  const benefitMap = new Map(
    benefits.map((benefit) => [
      benefitKey(
        benefit.evaluation.snapshot.programId,
        benefit.evaluation.snapshot.programVersionId,
        benefit.result.benefitId,
      ),
      benefit,
    ]),
  );
  const costs = new Map(
    input.costItems.map((cost) => [cost.costItemId, cost] as const),
  );
  const conflicts: FundingConflict[] = [];
  const warnings: FundingExplanation[] = [];
  const validRequests = new Map<string, RequestedProgramAllocation[]>();
  const portionKeys = new Set<string>();

  for (const request of input.requestedAllocations) {
    const program = input.programs.find(
      (candidate) =>
        candidate.snapshot?.programId === request.programId &&
        (request.programVersionId === undefined ||
          candidate.snapshot.programVersionId === request.programVersionId),
    );
    const key = program?.snapshot
      ? benefitKey(
          program.snapshot.programId,
          program.snapshot.programVersionId,
          request.benefitId,
        )
      : "";
    const benefit = benefitMap.get(key);
    if (!benefit) {
      conflicts.push({
        code: "UNKNOWN_BENEFIT",
        messageCode: "REQUESTED_ALLOCATION_BENEFIT_NOT_FOUND",
        programIds: [request.programId],
        benefitIds: [request.benefitId],
        sourceRuleIds: [],
        sourceReferences: [],
        parameters: { allocationId: request.allocationId },
      });
      continue;
    }
    const cost = costs.get(request.costItemId);
    if (!cost) {
      conflicts.push({
        code: "UNKNOWN_COST_ITEM",
        messageCode: "REQUESTED_ALLOCATION_COST_ITEM_NOT_FOUND",
        programIds: [request.programId],
        benefitIds: [request.benefitId],
        costItemIds: [request.costItemId],
        sourceRuleIds: [request.benefitId],
        sourceReferences: benefit.result.sourceReferences,
        parameters: { allocationId: request.allocationId },
      });
      continue;
    }
    const portionKey = `${request.costItemId}::${request.costPortionId}`;
    if (portionKeys.has(portionKey)) {
      conflicts.push({
        code: "DUPLICATE_COST_PORTION",
        messageCode: "COST_PORTION_IDENTITY_MUST_BE_UNIQUE",
        programIds: [request.programId],
        benefitIds: [request.benefitId],
        costItemIds: [request.costItemId],
        sourceRuleIds: [request.benefitId],
        sourceReferences: benefit.result.sourceReferences,
        parameters: { costPortionId: request.costPortionId },
      });
      continue;
    }
    portionKeys.add(portionKey);
    const eligibleLine = basisLines(benefit).find(
      (line) => line.costItemId === request.costItemId,
    );
    if (
      !eligibleLine ||
      toDecimal(request.allocatedCostAmount).greaterThan(eligibleLine.amount)
    ) {
      conflicts.push({
        code: "INELIGIBLE_COST_ALLOCATION",
        messageCode: "ALLOCATION_EXCEEDS_PROGRAM_ELIGIBLE_COST_BASIS",
        programIds: [request.programId],
        benefitIds: [request.benefitId],
        costItemIds: [request.costItemId],
        sourceRuleIds: [request.benefitId],
        sourceReferences: benefit.result.sourceReferences,
        parameters: {
          allocationId: request.allocationId,
          allocatedCostAmount: request.allocatedCostAmount,
          eligibleCostAmount: toMonetaryAmount(
            eligibleLine?.amount ?? toDecimal(zero),
          ),
        },
      });
      continue;
    }
    const existing = validRequests.get(key) ?? [];
    existing.push(request);
    validRequests.set(key, existing);
  }

  const ledger: FundingAllocationLedgerEntry[] = [];
  for (const benefit of benefits) {
    const key = benefitKey(
      benefit.evaluation.snapshot.programId,
      benefit.evaluation.snapshot.programVersionId,
      benefit.result.benefitId,
    );
    const requests = validRequests.get(key) ?? [];
    if (requests.length > 0) {
      ledger.push(
        ...distributeBenefit(
          benefit,
          requests.map((request) => ({
            allocationId: request.allocationId,
            costItemId: request.costItemId,
            costPortionId: request.costPortionId,
            allocatedCostAmount: toDecimal(request.allocatedCostAmount),
            allocationType: "MANUAL" as const,
          })),
        ),
      );
      continue;
    }
    const lines = basisLines(benefit);
    if (lines.length === 0) {
      ledger.push(nonCostEntry(benefit));
      continue;
    }
    ledger.push(
      ...distributeBenefit(
        benefit,
        lines.map((line, index) => ({
          allocationId: `AUTO.${benefit.evaluation.snapshot.programId}.${benefit.result.benefitId}.${line.costItemId}.${index + 1}`,
          costItemId: line.costItemId,
          costPortionId: `AUTO.${benefit.evaluation.snapshot.programId}.${benefit.result.benefitId}.${index + 1}`,
          allocatedCostAmount: line.amount,
          allocationType: "AUTO" as const,
        })),
      ),
    );
  }

  const byCost = new Map<string, FundingAllocationLedgerEntry[]>();
  for (const entry of ledger) {
    if (!entry.costItemId || entry.allocationType === "NON_COST_BASED")
      continue;
    const existing = byCost.get(entry.costItemId) ?? [];
    existing.push(entry);
    byCost.set(entry.costItemId, existing);
  }

  for (const [costItemId, entries] of byCost) {
    const totalAllocated = entries.reduce(
      (total, entry) => total.plus(toDecimal(entry.allocatedCostAmount)),
      toDecimal(zero),
    );
    const authoritativeCost = costs.get(costItemId)!;
    if (totalAllocated.greaterThan(toDecimal(authoritativeCost.amount))) {
      conflicts.push({
        code: "COST_OVERALLOCATION",
        messageCode: "ALLOCATED_COST_PORTIONS_EXCEED_AUTHORITATIVE_COST",
        programIds: [...new Set(entries.map((entry) => entry.programId))],
        benefitIds: entries.map((entry) => entry.benefitId),
        costItemIds: [costItemId],
        sourceRuleIds: entries.flatMap((entry) => entry.sourceRuleIds),
        sourceReferences: entries.flatMap((entry) => entry.sourceReferences),
        parameters: {
          authoritativeCost: authoritativeCost.amount,
          allocatedCost: toMonetaryAmount(totalAllocated),
        },
      });
    }
    for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < entries.length;
        rightIndex += 1
      ) {
        const left = entries[leftIndex]!;
        const right = entries[rightIndex]!;
        if (left.programId === right.programId) continue;
        const pair = pairFor(
          input.compatibility,
          left.programId,
          right.programId,
        );
        const policy = pair?.result.sameCostItemPolicy ?? "MANUAL_REVIEW";
        if (
          policy === "NO_DOUBLE_ASSISTANCE" ||
          (pair?.result.status === "ALLOWED_FOR_DISTINCT_COSTS" &&
            policy !== "DISTINCT_COST_PORTIONS_ONLY")
        ) {
          conflicts.push({
            code: "DOUBLE_FUNDING_CONFLICT",
            messageCode: "SAME_COST_ASSISTANCE_PROHIBITED",
            programIds: [left.programId, right.programId],
            benefitIds: [left.benefitId, right.benefitId],
            costItemIds: [costItemId],
            sourceRuleIds: pair?.result.convergenceRuleId
              ? [pair.result.convergenceRuleId]
              : [],
            sourceReferences: pair?.sourceReferences ?? [],
            parameters: {},
          });
        } else if (
          policy === "DISTINCT_COST_PORTIONS_ONLY" &&
          (left.allocationType === "AUTO" || right.allocationType === "AUTO")
        ) {
          conflicts.push({
            code: "ALLOCATION_REQUIRED",
            messageCode: "EXPLICIT_DISTINCT_COST_PORTIONS_REQUIRED",
            programIds: [left.programId, right.programId],
            benefitIds: [left.benefitId, right.benefitId],
            costItemIds: [costItemId],
            sourceRuleIds: pair?.result.convergenceRuleId
              ? [pair.result.convergenceRuleId]
              : [],
            sourceReferences: pair?.sourceReferences ?? [],
            parameters: {},
          });
        } else if (
          policy === "ALLOW_DIFFERENT_BENEFIT_TYPES" &&
          left.benefitKind === right.benefitKind
        ) {
          conflicts.push({
            code: "BENEFIT_INCOMPATIBILITY",
            messageCode: "SAME_COST_RULE_REQUIRES_DISTINCT_BENEFIT_KINDS",
            programIds: [left.programId, right.programId],
            benefitIds: [left.benefitId, right.benefitId],
            costItemIds: [costItemId],
            sourceRuleIds: pair?.result.convergenceRuleId
              ? [pair.result.convergenceRuleId]
              : [],
            sourceReferences: pair?.sourceReferences ?? [],
            parameters: {},
          });
        }
      }
    }
  }

  for (const benefit of benefits) {
    if (
      benefit.result.release.mechanism !== "UPFRONT" &&
      !["INTEREST_SUBVENTION", "CREDIT_GUARANTEE"].includes(
        benefit.result.benefitKind,
      )
    ) {
      warnings.push({
        code: "BENEFIT_NOT_AVAILABLE_AS_INITIAL_FUNDING",
        severity: "WARNING",
        programIds: [benefit.evaluation.snapshot.programId],
        costItemIds: [],
        sourceRuleIds: [benefit.result.benefitId],
        sourceReferences: benefit.result.sourceReferences,
        parameters: {
          releaseMechanism: benefit.result.release.mechanism,
          calculatedBenefit: benefit.result.calculatedEligibleBenefit,
        },
      });
    }
  }

  const uniqueConflicts = new Map<string, FundingConflict>();
  for (const conflict of conflicts) {
    uniqueConflicts.set(conflictKey(conflict), conflict);
  }
  return calculationSuccess({
    ledger: addRemainingCost(ledger, input.costItems),
    conflicts: [...uniqueConflicts.values()],
    warnings,
  });
}
