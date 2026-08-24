import type { CalculationError } from "../shared/calculation";
import { calculationFailure, calculationSuccess } from "../shared/calculation";
import { monetaryAmount, toDecimal, toMonetaryAmount } from "../shared/decimal";
import type { MonetaryAmount } from "../shared/types";
import { evaluateFinancingProgram } from "../schemes/evaluation";
import type {
  ProgramConvergenceRule,
  ProgramEvaluationInput,
  ProgramId,
} from "../schemes/program";
import { FinancingProgramRegistry } from "../schemes/registry";
import type { ProgramRuleHandlerRegistry } from "../schemes/rules";
import { createFundingAllocations } from "./allocations";
import {
  evaluateBenefitCompatibility,
  evaluatePairwiseCompatibility,
} from "./compatibility";
import { composeFundingConstraints } from "./constraints";
import { explanationsFromConflicts } from "./explanations";
import type {
  FundingAllocationLedgerEntry,
  FundingBenefitTotals,
  FundingComposerCalculationResult,
  FundingComposerInput,
  FundingConflict,
  FundingExplanation,
  FundingResolutionStatus,
  FundingSummary,
  IndividualProgramCompositionEvaluation,
  PairwiseCompatibilityEvaluation,
  SourceBackedAmount,
} from "./contracts";

const zero = monetaryAmount("0");

function validateSourceBackedAmount(
  amount: SourceBackedAmount | undefined,
  path: string,
): readonly CalculationError[] {
  if (amount === undefined) return [];
  const errors: CalculationError[] = [];
  try {
    const canonicalAmount = monetaryAmount(amount.value);
    if (toDecimal(canonicalAmount).isNegative()) {
      errors.push({
        code: "NEGATIVE_AUTHORITATIVE_FINANCING_AMOUNT",
        message: "Authoritative financing amounts must not be negative.",
        path: `${path}.value`,
      });
    }
  } catch {
    errors.push({
      code: "INVALID_AUTHORITATIVE_FINANCING_AMOUNT",
      message: "Authoritative financing amount must be a canonical decimal.",
      path: `${path}.value`,
    });
  }
  if (amount.sourceReferences.length === 0) {
    errors.push({
      code: "MISSING_AUTHORITATIVE_FINANCING_SOURCE",
      message: "Authoritative financing amounts require source provenance.",
      path: `${path}.sourceReferences`,
    });
  }
  return errors;
}

function validateInput(
  input: FundingComposerInput,
): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  const costIds = new Set<string>();
  let calculatedProjectCost = toDecimal(zero);
  try {
    const canonicalTotal = monetaryAmount(input.projectCost.totalProjectCost);
    if (toDecimal(canonicalTotal).isNegative()) {
      errors.push({
        code: "NEGATIVE_AUTHORITATIVE_PROJECT_COST",
        message: "Authoritative total project cost must not be negative.",
        path: "projectCost.totalProjectCost",
      });
    }
  } catch {
    errors.push({
      code: "INVALID_AUTHORITATIVE_PROJECT_COST",
      message: "Authoritative project cost must be a canonical decimal.",
      path: "projectCost.totalProjectCost",
    });
  }
  for (const [index, item] of input.projectCost.costItems.entries()) {
    if (costIds.has(item.costItemId)) {
      errors.push({
        code: "DUPLICATE_AUTHORITATIVE_COST_ITEM",
        message: "Authoritative cost item ids must be unique.",
        path: `projectCost.costItems.${index}.costItemId`,
      });
    }
    costIds.add(item.costItemId);
    try {
      const amount = toDecimal(monetaryAmount(item.amount));
      if (amount.isNegative()) {
        errors.push({
          code: "NEGATIVE_AUTHORITATIVE_COST_ITEM",
          message: "Authoritative project-cost lines must not be negative.",
          path: `projectCost.costItems.${index}.amount`,
        });
      }
      calculatedProjectCost = calculatedProjectCost.plus(amount);
    } catch {
      errors.push({
        code: "INVALID_AUTHORITATIVE_COST_ITEM",
        message: "Authoritative project-cost lines must be canonical decimals.",
        path: `projectCost.costItems.${index}.amount`,
      });
    }
  }
  try {
    if (
      !calculatedProjectCost.equals(
        toDecimal(monetaryAmount(input.projectCost.totalProjectCost)),
      )
    ) {
      errors.push({
        code: "AUTHORITATIVE_PROJECT_COST_RECONCILIATION_FAILURE",
        message:
          "The authoritative project-cost total must equal the exact sum of cost lines.",
        path: "projectCost.totalProjectCost",
      });
    }
  } catch {
    // The invalid total is already reported above.
  }
  errors.push(
    ...validateSourceBackedAmount(
      input.financing.promoterContribution,
      "financing.promoterContribution",
    ),
    ...validateSourceBackedAmount(
      input.financing.bankFinance,
      "financing.bankFinance",
    ),
    ...validateSourceBackedAmount(
      input.financing.requestedCredit,
      "financing.requestedCredit",
    ),
  );
  const otherIds = new Set<string>();
  for (const [index, finance] of input.financing.otherFinance.entries()) {
    if (otherIds.has(finance.financeSourceId)) {
      errors.push({
        code: "DUPLICATE_OTHER_FINANCE_SOURCE",
        message: "Other financing source ids must be unique.",
        path: `financing.otherFinance.${index}.financeSourceId`,
      });
    }
    otherIds.add(finance.financeSourceId);
    errors.push(
      ...validateSourceBackedAmount(finance, `financing.otherFinance.${index}`),
    );
  }
  if (
    input.financing.requestedCredit !== undefined &&
    input.facts.financing?.requestedCredit !== undefined &&
    input.facts.financing.requestedCredit !==
      input.financing.requestedCredit.value
  ) {
    errors.push({
      code: "REQUESTED_CREDIT_FACT_MISMATCH",
      message:
        "Normalized requested-credit fact must match authoritative financing input.",
      path: "facts.financing.requestedCredit",
    });
  }
  return errors;
}

function firstSource(amount: SourceBackedAmount | undefined) {
  return amount?.sourceReferences[0];
}

function evaluatePrograms(input: {
  readonly composerInput: FundingComposerInput;
  readonly registry: FinancingProgramRegistry;
  readonly handlers?: ProgramRuleHandlerRegistry;
}): readonly IndividualProgramCompositionEvaluation[] {
  const selections = [...input.composerInput.selectedPrograms].sort(
    (left, right) =>
      left.programId === right.programId
        ? (left.versionId ?? "").localeCompare(right.versionId ?? "")
        : left.programId.localeCompare(right.programId),
  );
  const seenPrograms = new Set<ProgramId>();
  const results: IndividualProgramCompositionEvaluation[] = [];
  for (const selection of selections) {
    if (seenPrograms.has(selection.programId)) {
      results.push({
        selection,
        status: "DUPLICATE_SELECTION",
        errors: [
          {
            code: "DUPLICATE_PROGRAM_SELECTION",
            message:
              "A logical program may be selected only once per composition.",
          },
        ],
        sourceReferences: [],
      });
      continue;
    }
    seenPrograms.add(selection.programId);
    const definition = selection.versionId
      ? input.registry.getProgramDefinition(
          selection.programId,
          selection.versionId,
        )
      : input.registry.resolveProgramVersion({
          programId: selection.programId,
          asOfDate: input.composerInput.evaluationAsOfDate,
        });
    if (!definition.ok) {
      results.push({
        selection,
        status: "VERSION_RESOLUTION_FAILURE",
        errors: definition.errors,
        sourceReferences: [],
      });
      continue;
    }
    const promoterSource = firstSource(
      input.composerInput.financing.promoterContribution,
    );
    const bankSource = firstSource(input.composerInput.financing.bankFinance);
    const evaluationInput: ProgramEvaluationInput = {
      projectId: input.composerInput.projectId,
      selection: {
        programId: definition.value.programId,
        versionId: definition.value.versionId,
      },
      evaluationAsOfDate: input.composerInput.evaluationAsOfDate,
      facts: input.composerInput.financing.requestedCredit
        ? {
            ...input.composerInput.facts,
            financing: {
              ...input.composerInput.facts.financing,
              requestedCredit:
                input.composerInput.financing.requestedCredit.value,
            },
          }
        : input.composerInput.facts,
      costItems: input.composerInput.projectCost.costItems,
      ...(input.composerInput.financing.promoterContribution && promoterSource
        ? {
            actualBeneficiaryContribution: {
              value: input.composerInput.financing.promoterContribution.value,
              source: promoterSource,
            },
          }
        : {}),
      ...(input.composerInput.financing.bankFinance && bankSource
        ? {
            actualBankFinance: {
              value: input.composerInput.financing.bankFinance.value,
              source: bankSource,
            },
          }
        : {}),
    };
    const evaluation = evaluateFinancingProgram(
      evaluationInput,
      input.registry,
      input.handlers,
    );
    results.push(
      evaluation.ok
        ? {
            selection,
            status: "EVALUATED",
            snapshot: evaluation.value.snapshot,
            definition: definition.value,
            evaluation: evaluation.value,
            errors: [],
            sourceReferences: definition.value.sourceReferences,
          }
        : {
            selection,
            status: "EVALUATION_FAILURE",
            snapshot: {
              programId: definition.value.programId,
              programVersionId: definition.value.versionId,
              evaluationAsOfDate: input.composerInput.evaluationAsOfDate,
            },
            definition: definition.value,
            errors: evaluation.errors,
            sourceReferences: definition.value.sourceReferences,
          },
    );
  }
  return results;
}

function compatibilityConflicts(
  pairs: readonly PairwiseCompatibilityEvaluation[],
): readonly FundingConflict[] {
  return pairs.flatMap((pair) => {
    if (pair.status !== "INCOMPATIBLE") return [];
    return [
      {
        code: "PROGRAM_INCOMPATIBILITY" as const,
        messageCode: pair.reasonCode,
        programIds: [pair.leftProgram.programId, pair.rightProgram.programId],
        sourceRuleIds: pair.result.convergenceRuleId
          ? [pair.result.convergenceRuleId]
          : [],
        sourceReferences: pair.sourceReferences,
        parameters: {},
      },
    ];
  });
}

function calculateBenefitTotals(
  ledger: readonly FundingAllocationLedgerEntry[],
): FundingBenefitTotals {
  const sum = (predicate: (entry: FundingAllocationLedgerEntry) => boolean) =>
    toMonetaryAmount(
      ledger
        .filter(predicate)
        .reduce(
          (total, entry) => total.plus(toDecimal(entry.benefitAmount)),
          toDecimal(zero),
        ),
    );
  const cashKinds = new Set([
    "SUBSIDY",
    "MARGIN_MONEY",
    "GRANT",
    "SEED_CAPITAL",
    "REIMBURSEMENT",
    "OTHER",
  ]);
  return {
    capitalSubsidy: sum((entry) => entry.fundingKind === "SUBSIDY"),
    marginMoney: sum((entry) => entry.fundingKind === "MARGIN_MONEY"),
    grant: sum((entry) => entry.fundingKind === "GRANT"),
    seedCapital: sum((entry) => entry.fundingKind === "SEED_CAPITAL"),
    reimbursement: sum((entry) => entry.fundingKind === "REIMBURSEMENT"),
    otherCashAssistance: sum(
      (entry) =>
        entry.fundingKind === "OTHER" &&
        entry.availability !== "NON_CASH_CONTINGENT",
    ),
    totalCalculatedCashBenefits: sum((entry) =>
      cashKinds.has(entry.fundingKind),
    ),
    totalInitiallyAvailableAssistance: sum(
      (entry) =>
        cashKinds.has(entry.fundingKind) && entry.availability === "INITIAL",
    ),
    totalDeferredConditionalAssistance: sum(
      (entry) =>
        cashKinds.has(entry.fundingKind) &&
        entry.availability === "DEFERRED_CONDITIONAL",
    ),
    interestSubvention: sum(
      (entry) => entry.fundingKind === "INTEREST_SUBVENTION",
    ),
    creditGuarantee: sum((entry) => entry.fundingKind === "CREDIT_GUARANTEE"),
    otherNonCashAssistance: sum(
      (entry) =>
        entry.availability === "NON_CASH_CONTINGENT" &&
        !["INTEREST_SUBVENTION", "CREDIT_GUARANTEE"].includes(
          entry.fundingKind,
        ),
    ),
  };
}

function calculateSummary(input: {
  readonly composerInput: FundingComposerInput;
  readonly ledger: readonly FundingAllocationLedgerEntry[];
  readonly requiredPromoterContribution: MonetaryAmount;
  readonly contributionShortfall: MonetaryAmount;
  readonly minimumRequiredBankFinance?: MonetaryAmount;
  readonly maximumPermittedBankFinance?: MonetaryAmount;
}): FundingSummary {
  const totalOther = input.composerInput.financing.otherFinance.reduce(
    (total, source) => total.plus(toDecimal(source.value)),
    toDecimal(zero),
  );
  const initialOther = input.composerInput.financing.otherFinance.reduce(
    (total, source) =>
      source.availableAtInitialFunding
        ? total.plus(toDecimal(source.value))
        : total,
    toDecimal(zero),
  );
  const benefits = calculateBenefitTotals(input.ledger);
  const promoter = input.composerInput.financing.promoterContribution;
  const bank = input.composerInput.financing.bankFinance;
  let initialFunding;
  let remaining;
  let surplus;
  if (promoter && bank) {
    initialFunding = toDecimal(promoter.value)
      .plus(toDecimal(bank.value))
      .plus(initialOther)
      .plus(toDecimal(benefits.totalInitiallyAvailableAssistance));
    const difference = toDecimal(
      input.composerInput.projectCost.totalProjectCost,
    ).minus(initialFunding);
    remaining = difference.isPositive() ? difference : toDecimal(zero);
    surplus = difference.isNegative() ? difference.abs() : toDecimal(zero);
  }
  return {
    totalProjectCost: input.composerInput.projectCost.totalProjectCost,
    ...(promoter ? { actualPromoterContribution: promoter.value } : {}),
    requiredPromoterContribution: input.requiredPromoterContribution,
    contributionShortfall: input.contributionShortfall,
    ...(bank ? { actualBankFinance: bank.value } : {}),
    ...(input.minimumRequiredBankFinance !== undefined
      ? { minimumRequiredBankFinance: input.minimumRequiredBankFinance }
      : {}),
    ...(input.maximumPermittedBankFinance !== undefined
      ? { maximumPermittedBankFinance: input.maximumPermittedBankFinance }
      : {}),
    totalOtherSourceBackedFinance: toMonetaryAmount(totalOther),
    totalOtherInitiallyAvailableFinance: toMonetaryAmount(initialOther),
    benefits,
    ...(initialFunding !== undefined
      ? { totalInitialFundingSources: toMonetaryAmount(initialFunding) }
      : {}),
    ...(remaining !== undefined
      ? { remainingInitialFundingRequirement: toMonetaryAmount(remaining) }
      : {}),
    ...(surplus !== undefined
      ? { initialFundingSurplus: toMonetaryAmount(surplus) }
      : {}),
  };
}

function programConflicts(
  programs: readonly IndividualProgramCompositionEvaluation[],
): readonly FundingConflict[] {
  const conflicts: FundingConflict[] = [];
  for (const program of programs) {
    if (program.status === "DUPLICATE_SELECTION") {
      conflicts.push({
        code: "DUPLICATE_PROGRAM_SELECTION",
        messageCode: "LOGICAL_PROGRAM_SELECTED_MORE_THAN_ONCE",
        programIds: [program.selection.programId],
        sourceRuleIds: [],
        sourceReferences: [],
        parameters: {},
      });
      continue;
    }
    if (
      program.status === "VERSION_RESOLUTION_FAILURE" ||
      program.status === "EVALUATION_FAILURE"
    ) {
      conflicts.push({
        code: "PROGRAM_VERSION_RESOLUTION_FAILURE",
        messageCode:
          program.status === "VERSION_RESOLUTION_FAILURE"
            ? "PROGRAM_VERSION_COULD_NOT_BE_RESOLVED"
            : "PROGRAM_EVALUATION_FAILED",
        programIds: [program.selection.programId],
        sourceRuleIds: [],
        sourceReferences: program.sourceReferences,
        parameters: {
          errorCodes: program.errors.map((error) => error.code).join(","),
        },
      });
      continue;
    }
    if (program.evaluation?.eligibility.status === "INELIGIBLE") {
      conflicts.push({
        code: "PROGRAM_INELIGIBLE",
        messageCode: "SELECTED_PROGRAM_IS_INDIVIDUALLY_INELIGIBLE",
        programIds: [program.evaluation.snapshot.programId],
        sourceRuleIds: program.evaluation.eligibility.ruleResults.map(
          (rule) => rule.ruleId,
        ),
        sourceReferences: program.sourceReferences,
        parameters: {},
      });
    }
  }
  return conflicts;
}

function manualReviewExplanations(input: {
  readonly programs: readonly IndividualProgramCompositionEvaluation[];
  readonly compatibility: readonly PairwiseCompatibilityEvaluation[];
  readonly financingComplete: boolean;
}): readonly FundingExplanation[] {
  const items: FundingExplanation[] = [];
  for (const program of input.programs) {
    const status = program.evaluation?.eligibility.status;
    if (
      status === "INSUFFICIENT_INFORMATION" ||
      status === "MANUAL_REVIEW_REQUIRED"
    ) {
      items.push({
        code: `PROGRAM_${status}`,
        severity: "WARNING",
        programIds: program.snapshot ? [program.snapshot.programId] : [],
        costItemIds: [],
        sourceRuleIds:
          program.evaluation?.eligibility.ruleResults.map(
            (rule) => rule.ruleId,
          ) ?? [],
        sourceReferences: program.sourceReferences,
        parameters: {},
      });
    }
    for (const benefit of program.evaluation?.benefits ?? []) {
      if (benefit.status === "CALCULATED") continue;
      items.push({
        code: `BENEFIT_${benefit.status}`,
        severity: "WARNING",
        programIds: program.snapshot ? [program.snapshot.programId] : [],
        costItemIds: [],
        sourceRuleIds: [benefit.benefitId],
        sourceReferences: benefit.sourceReferences,
        parameters: { benefitId: benefit.benefitId },
      });
    }
  }
  for (const pair of input.compatibility) {
    if (pair.status === "UNKNOWN" || pair.status === "MANUAL_REVIEW_REQUIRED") {
      items.push({
        code:
          pair.status === "UNKNOWN"
            ? "COMPATIBILITY_EVIDENCE_NOT_FOUND"
            : "COMPATIBILITY_REQUIRES_MANUAL_REVIEW",
        severity: "WARNING",
        programIds: [pair.leftProgram.programId, pair.rightProgram.programId],
        costItemIds: [],
        sourceRuleIds: pair.result.convergenceRuleId
          ? [pair.result.convergenceRuleId]
          : [],
        sourceReferences: pair.sourceReferences,
        parameters: {},
      });
    }
  }
  if (!input.financingComplete) {
    items.push({
      code: "AUTHORITATIVE_INITIAL_FINANCING_FACTS_MISSING",
      severity: "WARNING",
      programIds: [],
      costItemIds: [],
      sourceRuleIds: [],
      sourceReferences: [],
      parameters: {},
    });
  }
  return items;
}

function resolutionStatus(input: {
  readonly conflicts: readonly FundingConflict[];
  readonly manualReviewItems: readonly FundingExplanation[];
  readonly warnings: readonly FundingExplanation[];
  readonly programs: readonly IndividualProgramCompositionEvaluation[];
}): FundingResolutionStatus {
  if (
    input.programs.some(
      (program) => program.evaluation?.eligibility.status === "INELIGIBLE",
    )
  ) {
    return "INELIGIBLE_SELECTION";
  }
  if (input.conflicts.length > 0) return "UNRESOLVED";
  if (input.manualReviewItems.length > 0) return "MANUAL_REVIEW_REQUIRED";
  return input.warnings.length > 0 ? "RESOLVED_WITH_WARNINGS" : "RESOLVED";
}

export function composeMultiProgramFunding(
  input: FundingComposerInput,
  registry: FinancingProgramRegistry,
  compatibilityRules: readonly ProgramConvergenceRule[],
  handlers?: ProgramRuleHandlerRegistry,
): FundingComposerCalculationResult {
  const errors = validateInput(input);
  if (errors.length > 0) return calculationFailure(...errors);

  const programs = evaluatePrograms({
    composerInput: input,
    registry,
    handlers,
  });
  const successfulEvaluations = programs.flatMap((program) =>
    program.evaluation ? [program.evaluation] : [],
  );
  const compatibility = evaluatePairwiseCompatibility({
    evaluations: successfulEvaluations,
    evaluationAsOfDate: input.evaluationAsOfDate,
    compatibilityRules,
  });
  const benefitCompatibility = evaluateBenefitCompatibility({
    evaluations: successfulEvaluations,
    pairwise: compatibility,
  });
  const allocations = createFundingAllocations({
    programs,
    costItems: input.projectCost.costItems,
    compatibility,
    requestedAllocations: input.requestedAllocations ?? [],
  });
  if (!allocations.ok) return allocations;

  const constraints = composeFundingConstraints({
    programs,
    actualPromoterContribution: input.financing.promoterContribution?.value,
    actualBankFinance: input.financing.bankFinance?.value,
    requestedCredit: input.financing.requestedCredit?.value,
  });
  const conflicts: FundingConflict[] = [
    ...programConflicts(programs),
    ...compatibilityConflicts(compatibility),
    ...benefitCompatibility.flatMap((benefit) =>
      benefit.status === "INCOMPATIBLE"
        ? [
            {
              code: "BENEFIT_INCOMPATIBILITY" as const,
              messageCode: benefit.reasonCode,
              programIds: [
                benefit.leftProgram.programId,
                benefit.rightProgram.programId,
              ],
              benefitIds: [benefit.leftBenefitId, benefit.rightBenefitId],
              sourceRuleIds: [],
              sourceReferences: benefit.sourceReferences,
              parameters: {},
            },
          ]
        : [],
    ),
    ...allocations.value.conflicts,
    ...constraints.conflicts,
  ];
  const warnings: FundingExplanation[] = [
    ...allocations.value.warnings,
    ...constraints.warnings,
    ...programs.flatMap((program) =>
      (program.evaluation?.warnings ?? []).flatMap((warning) =>
        warning.startsWith("PROGRAM_ELIGIBILITY_INSUFFICIENT") ||
        warning.startsWith("PROGRAM_ELIGIBILITY_MANUAL_REVIEW") ||
        warning.includes("BENEFIT_")
          ? []
          : [
              {
                code: warning,
                severity: "WARNING" as const,
                programIds: program.snapshot
                  ? [program.snapshot.programId]
                  : [],
                costItemIds: [],
                sourceRuleIds: [],
                sourceReferences: program.sourceReferences,
                parameters: {},
              },
            ],
      ),
    ),
    ...compatibility.flatMap((pair) =>
      pair.status === "CONDITIONALLY_COMPATIBLE"
        ? [
            {
              code: "PROGRAMS_COMPATIBLE_SUBJECT_TO_CONDITIONS",
              severity: "WARNING" as const,
              programIds: [
                pair.leftProgram.programId,
                pair.rightProgram.programId,
              ],
              costItemIds: [],
              sourceRuleIds: pair.result.convergenceRuleId
                ? [pair.result.convergenceRuleId]
                : [],
              sourceReferences: pair.sourceReferences,
              parameters: { conditions: pair.conditions.join("|") },
            },
          ]
        : [],
    ),
  ];
  const summary = calculateSummary({
    composerInput: input,
    ledger: allocations.value.ledger,
    requiredPromoterContribution: constraints.requiredPromoterContribution,
    contributionShortfall: constraints.contributionShortfall,
    minimumRequiredBankFinance: constraints.minimumRequiredBankFinance,
    maximumPermittedBankFinance: constraints.maximumPermittedBankFinance,
  });
  if (
    summary.remainingInitialFundingRequirement !== undefined &&
    toDecimal(summary.remainingInitialFundingRequirement).greaterThan(
      toDecimal(zero),
    )
  ) {
    warnings.push({
      code: "INITIAL_FUNDING_GAP_REMAINS",
      severity: "WARNING",
      programIds: successfulEvaluations.map(
        (evaluation) => evaluation.snapshot.programId,
      ),
      costItemIds: [],
      sourceRuleIds: [],
      sourceReferences: [],
      parameters: {
        amount: summary.remainingInitialFundingRequirement,
      },
    });
  }
  const manualReviewItems = manualReviewExplanations({
    programs,
    compatibility,
    financingComplete:
      input.financing.promoterContribution !== undefined &&
      input.financing.bankFinance !== undefined,
  });
  const mode =
    input.selectedPrograms.length === 0
      ? "BANKABLE_PROJECT"
      : input.selectedPrograms.length === 1
        ? "SINGLE_PROGRAM"
        : "MULTI_PROGRAM";
  const nonFinancialBenefits = programs.flatMap((program) =>
    program.snapshot && program.definition?.nonFinancialBenefits
      ? program.definition.nonFinancialBenefits.map((benefitCode) => ({
          program: program.snapshot!,
          benefitCode,
          sourceReferences: program.sourceReferences,
        }))
      : [],
  );
  const result = {
    projectId: input.projectId,
    evaluationAsOfDate: input.evaluationAsOfDate,
    mode,
    resolutionStatus: resolutionStatus({
      conflicts,
      manualReviewItems,
      warnings,
      programs,
    }),
    projectCost: input.projectCost,
    financing: input.financing,
    selectedPrograms: [...input.selectedPrograms].sort((left, right) =>
      left.programId.localeCompare(right.programId),
    ),
    individualProgramEvaluations: programs,
    compatibilityEvaluations: compatibility,
    benefitCompatibilityEvaluations: benefitCompatibility,
    allocationLedger: allocations.value.ledger,
    nonFinancialBenefits,
    contributionConstraints: constraints.contributionConstraints,
    bankFinanceConstraints: constraints.bankFinanceConstraints,
    summary,
    conflicts,
    warnings,
    manualReviewItems,
    explanations: [
      ...explanationsFromConflicts(conflicts),
      ...manualReviewItems,
      ...warnings,
    ],
  } as const;
  return calculationSuccess(result);
}
