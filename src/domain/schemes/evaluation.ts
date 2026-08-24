import type {
  CalculationError,
  CalculationResult,
} from "../shared/calculation";
import { calculationFailure, calculationSuccess } from "../shared/calculation";
import { monetaryAmount, toDecimal, toMonetaryAmount } from "../shared/decimal";
import { calculateFinancialBenefits } from "./benefits";
import { calculateProgramFundingConstraint } from "./calculations";
import {
  evaluateProgramCompatibility,
  validateBenefitCompatibility,
  validateAssistanceAllocations,
} from "./compatibility";
import { calculateCostEligibility } from "./cost-eligibility";
import { evaluateProgramEligibility } from "./eligibility";
import type {
  CalculatedBenefitResult,
  CostAssistanceAllocation,
  FinancingProgramDefinition,
  FinancialBenefitDefinition,
  ProgramConvergenceRule,
  ProgramEvaluationInput,
  ProgramEvaluationResult,
  ProgramStackEvaluation,
  ProgramStackEvaluationInput,
  ProjectCostEligibilityResult,
} from "./program";
import { FinancingProgramRegistry } from "./registry";
import type { ProgramRuleHandlerRegistry } from "./rules";

function resolveDefinition(
  input: ProgramEvaluationInput,
  registry: FinancingProgramRegistry,
): CalculationResult<FinancingProgramDefinition> {
  return input.selection.versionId
    ? registry.getProgramDefinition(
        input.selection.programId,
        input.selection.versionId,
      )
    : registry.resolveProgramVersion({
        programId: input.selection.programId,
        asOfDate: input.evaluationAsOfDate,
      });
}

export function evaluateFinancingProgram(
  input: ProgramEvaluationInput,
  registry: FinancingProgramRegistry,
  handlers?: ProgramRuleHandlerRegistry,
): CalculationResult<ProgramEvaluationResult> {
  const definitionResult = resolveDefinition(input, registry);
  if (!definitionResult.ok) return definitionResult;
  const definition = definitionResult.value;
  const eligibility = evaluateProgramEligibility(
    definition.eligibility,
    input.facts,
    handlers,
  );
  const costEligibility = calculateCostEligibility({
    costItems: input.costItems,
    rules: definition.costEligibilityRules,
    facts: input.facts,
    handlers,
  });
  if (!costEligibility.ok) return costEligibility;

  let benefits: readonly CalculatedBenefitResult[] = [];
  if (
    eligibility.status === "ELIGIBLE" ||
    eligibility.status === "CONDITIONALLY_ELIGIBLE"
  ) {
    const benefitResult = calculateFinancialBenefits({
      definitions: definition.benefits,
      facts: input.facts,
      costEligibility: costEligibility.value,
      actualBeneficiaryContribution: input.actualBeneficiaryContribution?.value,
      actualBankFinance: input.actualBankFinance?.value,
      handlers,
    });
    if (!benefitResult.ok) return benefitResult;
    benefits = benefitResult.value;
  }

  const calculatedTotal = benefits.reduce(
    (total, benefit) =>
      total.plus(
        benefit.status === "CALCULATED"
          ? toDecimal(benefit.calculatedEligibleBenefit!)
          : toDecimal(monetaryAmount("0")),
      ),
    toDecimal(monetaryAmount("0")),
  );
  const warnings: string[] = [];
  let cappedTotal = calculatedTotal;
  let appliedOverallBenefitCap;
  if (
    definition.overallBenefitCap !== undefined &&
    toDecimal(definition.overallBenefitCap.amount).lessThan(cappedTotal)
  ) {
    cappedTotal = toDecimal(definition.overallBenefitCap.amount);
    appliedOverallBenefitCap = {
      calculatedBeforeCap: toMonetaryAmount(calculatedTotal),
      capAmount: definition.overallBenefitCap.amount,
      calculatedAfterCap: toMonetaryAmount(cappedTotal),
      sourceReferences: definition.overallBenefitCap.sourceReferences,
    };
    warnings.push("OVERALL_PROGRAM_BENEFIT_CAP_APPLIED");
  }
  if (eligibility.status !== "ELIGIBLE") {
    warnings.push(`PROGRAM_ELIGIBILITY_${eligibility.status}`);
  }
  for (const benefit of benefits) {
    if (benefit.status !== "CALCULATED") {
      warnings.push(`BENEFIT_${benefit.benefitId}_${benefit.status}`);
    }
  }

  const fundingConstraint = calculateProgramFundingConstraint({
    costEligibility: costEligibility.value,
    maximumCalculatedBenefit: toMonetaryAmount(cappedTotal),
    contributionRequirement: definition.contributionRequirement,
    bankFinanceRequirement: definition.bankFinanceRequirement,
    actualBeneficiaryContribution: input.actualBeneficiaryContribution,
    actualBankFinance: input.actualBankFinance,
  });
  if (!fundingConstraint.ok) return fundingConstraint;

  return calculationSuccess({
    projectId: input.projectId,
    snapshot: {
      programId: definition.programId,
      programVersionId: definition.versionId,
      evaluationAsOfDate: input.evaluationAsOfDate,
    },
    programTypes: definition.programTypes,
    eligibility,
    costEligibility: costEligibility.value,
    benefits,
    totalCalculatedEligibleBenefit: toMonetaryAmount(cappedTotal),
    ...(appliedOverallBenefitCap ? { appliedOverallBenefitCap } : {}),
    fundingConstraint: fundingConstraint.value,
    warnings,
  });
}

function basisLines(
  definition: FinancialBenefitDefinition,
  costEligibility: ProjectCostEligibilityResult,
): readonly {
  readonly costItemId: string;
  readonly basisAmount: ReturnType<typeof toDecimal>;
}[] {
  if (
    ![
      "TOTAL_PROJECT_COST",
      "ELIGIBLE_PROJECT_COST",
      "ELIGIBLE_CAPITAL_COST",
      "SPECIFIC_COST_COMPONENTS",
    ].includes(definition.basis)
  ) {
    return [];
  }
  return costEligibility.lines
    .filter((line) => {
      if (definition.basis === "ELIGIBLE_CAPITAL_COST") {
        return line.costItem.tags.some((tag) => tag === "CAPITAL");
      }
      if (definition.basis === "SPECIFIC_COST_COMPONENTS") {
        return definition.specificCostItemIds?.includes(
          line.costItem.costItemId,
        );
      }
      return true;
    })
    .map((line) => ({
      costItemId: line.costItem.costItemId,
      basisAmount: toDecimal(
        definition.basis === "TOTAL_PROJECT_COST"
          ? line.costItem.amount
          : line.eligibleAmount,
      ),
    }))
    .filter((line) => line.basisAmount.isPositive());
}

function createAllocations(
  definition: FinancingProgramDefinition,
  evaluation: ProgramEvaluationResult,
): readonly CostAssistanceAllocation[] {
  const allocations: CostAssistanceAllocation[] = [];
  const uncappedTotal = evaluation.benefits.reduce(
    (total, benefit) =>
      total.plus(
        benefit.status === "CALCULATED"
          ? toDecimal(benefit.calculatedEligibleBenefit!)
          : toDecimal(monetaryAmount("0")),
      ),
    toDecimal(monetaryAmount("0")),
  );
  const programScale = uncappedTotal.isZero()
    ? toDecimal(monetaryAmount("0"))
    : toDecimal(evaluation.totalCalculatedEligibleBenefit).dividedBy(
        uncappedTotal,
      );

  for (const benefitResult of evaluation.benefits) {
    if (benefitResult.status !== "CALCULATED") continue;
    const benefitDefinition = definition.benefits.find(
      (benefit) => benefit.benefitId === benefitResult.benefitId,
    );
    if (!benefitDefinition) continue;
    const lines = basisLines(benefitDefinition, evaluation.costEligibility);
    const totalBasis = lines.reduce(
      (total, line) => total.plus(line.basisAmount),
      toDecimal(monetaryAmount("0")),
    );
    if (totalBasis.isZero()) continue;

    const adjustedBenefit = toDecimal(
      benefitResult.calculatedEligibleBenefit!,
    ).times(programScale);
    let allocated = toDecimal(monetaryAmount("0"));
    for (const [index, line] of lines.entries()) {
      const benefitAmount =
        index === lines.length - 1
          ? adjustedBenefit.minus(allocated)
          : adjustedBenefit.times(line.basisAmount).dividedBy(totalBasis);
      allocated = allocated.plus(benefitAmount);
      allocations.push({
        costItemId: line.costItemId,
        programId: definition.programId,
        programVersionId: definition.versionId,
        benefitId: benefitDefinition.benefitId,
        benefitKind: benefitDefinition.kind,
        eligibleBasisAmount: toMonetaryAmount(line.basisAmount),
        benefitAmount: toMonetaryAmount(benefitAmount),
        allocationType: "FULL_COST_BASIS",
      });
    }
  }
  return allocations;
}

export function evaluateProgramStack(
  input: ProgramStackEvaluationInput,
  registry: FinancingProgramRegistry,
  compatibilityRules: readonly ProgramConvergenceRule[],
  handlers?: ProgramRuleHandlerRegistry,
): CalculationResult<ProgramStackEvaluation> {
  if (input.selectedPrograms.length === 0) {
    return calculationSuccess({
      projectId: input.projectId,
      mode: "BANKABLE_PROJECT",
      selectedPrograms: [],
      individualEvaluations: [],
      compatibilityResults: [],
      allocations: [],
      conflicts: [],
      warnings: [],
      manualReviewItems: [],
      combinedCalculatedEligibleBenefits: monetaryAmount("0"),
      combinedEligibleBenefits: monetaryAmount("0"),
    });
  }

  const errors: CalculationError[] = [];
  const definitions: FinancingProgramDefinition[] = [];
  const evaluations: ProgramEvaluationResult[] = [];
  const selectionKeys = new Set<string>();
  for (const selection of input.selectedPrograms) {
    const key = `${selection.programId}::${selection.versionId ?? "AS_OF"}`;
    if (selectionKeys.has(key)) {
      errors.push({
        code: "DUPLICATE_PROGRAM_SELECTION",
        message: "The same program selection cannot appear twice.",
      });
      continue;
    }
    selectionKeys.add(key);
    const evaluationInput: ProgramEvaluationInput = {
      projectId: input.projectId,
      selection,
      evaluationAsOfDate: input.evaluationAsOfDate,
      facts: input.facts,
      costItems: input.costItems,
      actualBeneficiaryContribution: input.actualBeneficiaryContribution,
      actualBankFinance: input.actualBankFinance,
    };
    const definition = resolveDefinition(evaluationInput, registry);
    const evaluation = evaluateFinancingProgram(
      evaluationInput,
      registry,
      handlers,
    );
    if (!definition.ok) errors.push(...definition.errors);
    if (!evaluation.ok) errors.push(...evaluation.errors);
    if (definition.ok && evaluation.ok) {
      definitions.push(definition.value);
      evaluations.push(evaluation.value);
    }
  }
  if (errors.length > 0) return calculationFailure(...errors);

  const compatibilityResults = [];
  for (let left = 0; left < evaluations.length; left += 1) {
    for (let right = left + 1; right < evaluations.length; right += 1) {
      compatibilityResults.push(
        evaluateProgramCompatibility({
          programA: evaluations[left]!.snapshot,
          programB: evaluations[right]!.snapshot,
          asOfDate: input.evaluationAsOfDate,
          rules: compatibilityRules,
        }),
      );
    }
  }

  const allocations = evaluations.flatMap((evaluation, index) =>
    createAllocations(definitions[index]!, evaluation),
  );
  const conflicts = [
    ...validateBenefitCompatibility({ evaluations, compatibilityResults }),
    ...validateAssistanceAllocations({
      allocations,
      costItems: input.costItems,
      compatibilityResults,
    }),
  ];
  const warnings = evaluations.flatMap((evaluation) => evaluation.warnings);
  const manualReviewItems = [
    ...evaluations.flatMap((evaluation) =>
      evaluation.eligibility.status === "INSUFFICIENT_INFORMATION" ||
      evaluation.eligibility.status === "MANUAL_REVIEW_REQUIRED"
        ? [
            `PROGRAM_${evaluation.snapshot.programId}_${evaluation.eligibility.status}`,
          ]
        : [],
    ),
    ...compatibilityResults.flatMap((compatibility) =>
      compatibility.status === "UNKNOWN" ||
      compatibility.status === "REQUIRES_MANUAL_REVIEW" ||
      compatibility.status === "ALLOWED_WITH_CONDITIONS"
        ? [
            `COMPATIBILITY_${compatibility.programA.programId}_${compatibility.programB.programId}_${compatibility.status}`,
          ]
        : [],
    ),
  ];
  const combinedCalculated = evaluations.reduce(
    (total, evaluation) =>
      total.plus(toDecimal(evaluation.totalCalculatedEligibleBenefit)),
    toDecimal(monetaryAmount("0")),
  );
  const combinationResolved =
    conflicts.length === 0 && manualReviewItems.length === 0;

  return calculationSuccess({
    projectId: input.projectId,
    mode: "PROGRAM_STACK",
    selectedPrograms: evaluations.map((evaluation) => evaluation.snapshot),
    individualEvaluations: evaluations,
    compatibilityResults,
    allocations,
    conflicts,
    warnings,
    manualReviewItems,
    combinedCalculatedEligibleBenefits: toMonetaryAmount(combinedCalculated),
    ...(combinationResolved
      ? { combinedEligibleBenefits: toMonetaryAmount(combinedCalculated) }
      : {}),
  });
}
