import { monetaryAmount, toDecimal, toMonetaryAmount } from "../shared/decimal";
import type { MonetaryAmount } from "../shared/types";
import type {
  BankFinanceConstraintEvaluation,
  ContributionConstraintEvaluation,
  FundingConflict,
  FundingExplanation,
  IndividualProgramCompositionEvaluation,
} from "./contracts";

export interface ConstraintCompositionResult {
  readonly contributionConstraints: readonly ContributionConstraintEvaluation[];
  readonly bankFinanceConstraints: readonly BankFinanceConstraintEvaluation[];
  readonly requiredPromoterContribution: MonetaryAmount;
  readonly contributionShortfall: MonetaryAmount;
  readonly minimumRequiredBankFinance?: MonetaryAmount;
  readonly maximumPermittedBankFinance?: MonetaryAmount;
  readonly conflicts: readonly FundingConflict[];
  readonly warnings: readonly FundingExplanation[];
}

const zero = monetaryAmount("0");

function evaluated(
  programs: readonly IndividualProgramCompositionEvaluation[],
) {
  return programs.filter(
    (program) =>
      program.definition !== undefined && program.evaluation !== undefined,
  );
}

export function composeFundingConstraints(input: {
  readonly programs: readonly IndividualProgramCompositionEvaluation[];
  readonly actualPromoterContribution?: MonetaryAmount;
  readonly actualBankFinance?: MonetaryAmount;
  readonly requestedCredit?: MonetaryAmount;
}): ConstraintCompositionResult {
  const programs = evaluated(input.programs);
  const contributionConstraints: ContributionConstraintEvaluation[] = [];
  const bankFinanceConstraints: BankFinanceConstraintEvaluation[] = [];
  const conflicts: FundingConflict[] = [];
  const warnings: FundingExplanation[] = [];

  for (const program of programs) {
    const definition = program.definition!;
    const evaluation = program.evaluation!;
    if (definition.contributionRequirement) {
      const compliance = evaluation.fundingConstraint.contributionCompliance;
      contributionConstraints.push({
        program: evaluation.snapshot,
        requiredContribution: compliance.requiredMinimumContribution,
        ...(input.actualPromoterContribution !== undefined
          ? { actualContribution: input.actualPromoterContribution }
          : {}),
        shortfall: compliance.shortfall,
        compliance: compliance.status,
        sourceReferences: definition.contributionRequirement.sourceReferences,
      });
    }
    if (definition.bankFinanceRequirement) {
      const requirement = definition.bankFinanceRequirement;
      const creditProgram = definition.programTypes.includes("CREDIT_PROGRAM");
      const requestedCredit = input.requestedCredit;
      const creditCompliance = !creditProgram
        ? undefined
        : requirement.maximumAmount === undefined
          ? "NO_LIMIT_CONFIGURED"
          : requestedCredit === undefined
            ? "INSUFFICIENT_INFORMATION"
            : toDecimal(requestedCredit).greaterThan(
                  toDecimal(requirement.maximumAmount),
                )
              ? "ABOVE_LIMIT"
              : "WITHIN_LIMIT";
      bankFinanceConstraints.push({
        program: evaluation.snapshot,
        creditProgram,
        requirement: requirement.requirement,
        ...(requirement.minimumAmount !== undefined
          ? { minimumBankFinance: requirement.minimumAmount }
          : {}),
        ...(requirement.maximumAmount !== undefined
          ? { maximumBankFinance: requirement.maximumAmount }
          : {}),
        ...(input.actualBankFinance !== undefined
          ? { actualBankFinance: input.actualBankFinance }
          : {}),
        ...(requestedCredit !== undefined ? { requestedCredit } : {}),
        ...(creditProgram && requirement.maximumAmount !== undefined
          ? { maximumEligibleCredit: requirement.maximumAmount }
          : {}),
        ...(creditCompliance ? { creditCompliance } : {}),
        compliance: evaluation.fundingConstraint.bankFinanceCompliance.status,
        sourceReferences: requirement.sourceReferences,
      });
    }
  }

  const requiredPromoter = contributionConstraints.reduce(
    (maximum, constraint) => {
      const required = toDecimal(constraint.requiredContribution);
      return required.greaterThan(maximum) ? required : maximum;
    },
    toDecimal(zero),
  );
  const actualPromoter =
    input.actualPromoterContribution === undefined
      ? undefined
      : toDecimal(input.actualPromoterContribution);
  const promoterShortfall =
    actualPromoter === undefined
      ? requiredPromoter
      : requiredPromoter.minus(actualPromoter);

  const fixedConstraints = programs.filter(
    (program) => program.definition!.contributionRequirement?.fixedPercentage,
  );
  const fixedAmounts = new Set(
    fixedConstraints.map(
      (program) =>
        program.evaluation!.fundingConstraint.contributionCompliance
          .requiredMinimumContribution,
    ),
  );
  if (fixedAmounts.size > 1) {
    conflicts.push({
      code: "CONTRIBUTION_CONSTRAINT_CONFLICT",
      messageCode: "FIXED_CONTRIBUTION_REQUIREMENTS_DISAGREE",
      programIds: fixedConstraints.map(
        (program) => program.evaluation!.snapshot.programId,
      ),
      sourceRuleIds: fixedConstraints.map(
        (program) => `CONTRIBUTION.${program.evaluation!.snapshot.programId}`,
      ),
      sourceReferences: fixedConstraints.flatMap(
        (program) =>
          program.definition!.contributionRequirement!.sourceReferences,
      ),
      parameters: { fixedRequiredAmounts: [...fixedAmounts].join(",") },
    });
  }
  if (
    actualPromoter !== undefined &&
    promoterShortfall.greaterThan(toDecimal(zero))
  ) {
    conflicts.push({
      code: "CONTRIBUTION_CONSTRAINT_CONFLICT",
      messageCode: "ACTUAL_PROMOTER_CONTRIBUTION_BELOW_COMBINED_MINIMUM",
      programIds: contributionConstraints.map(
        (constraint) => constraint.program.programId,
      ),
      sourceRuleIds: contributionConstraints.map(
        (constraint) => `CONTRIBUTION.${constraint.program.programId}`,
      ),
      sourceReferences: contributionConstraints.flatMap(
        (constraint) => constraint.sourceReferences,
      ),
      parameters: {
        actualContribution: input.actualPromoterContribution!,
        requiredContribution: toMonetaryAmount(requiredPromoter),
        shortfall: toMonetaryAmount(promoterShortfall),
      },
    });
  }

  const requiringBank = bankFinanceConstraints.filter(
    (constraint) => constraint.requirement === "REQUIRED",
  );
  const prohibitingBank = bankFinanceConstraints.filter(
    (constraint) => constraint.requirement === "NOT_PERMITTED",
  );
  if (requiringBank.length > 0 && prohibitingBank.length > 0) {
    const constraints = [...requiringBank, ...prohibitingBank];
    conflicts.push({
      code: "BANK_FINANCE_CONSTRAINT_CONFLICT",
      messageCode: "BANK_FINANCE_REQUIRED_AND_PROHIBITED",
      programIds: constraints.map((constraint) => constraint.program.programId),
      sourceRuleIds: constraints.map(
        (constraint) => `BANK_FINANCE.${constraint.program.programId}`,
      ),
      sourceReferences: constraints.flatMap(
        (constraint) => constraint.sourceReferences,
      ),
      parameters: {},
    });
  }

  const minimums = bankFinanceConstraints.flatMap((constraint) =>
    constraint.minimumBankFinance === undefined
      ? []
      : [toDecimal(constraint.minimumBankFinance)],
  );
  const maximums = bankFinanceConstraints.flatMap((constraint) =>
    constraint.maximumBankFinance === undefined
      ? []
      : [toDecimal(constraint.maximumBankFinance)],
  );
  const combinedMinimum = minimums.reduce(
    (maximum, amount) => (amount.greaterThan(maximum) ? amount : maximum),
    toDecimal(zero),
  );
  const combinedMaximum = maximums.reduce<
    ReturnType<typeof toDecimal> | undefined
  >(
    (minimum, amount) =>
      minimum === undefined || amount.lessThan(minimum) ? amount : minimum,
    undefined,
  );
  if (combinedMaximum && combinedMinimum.greaterThan(combinedMaximum)) {
    conflicts.push({
      code: "BANK_FINANCE_CONSTRAINT_CONFLICT",
      messageCode: "COMBINED_BANK_FINANCE_RANGE_IS_EMPTY",
      programIds: bankFinanceConstraints.map(
        (constraint) => constraint.program.programId,
      ),
      sourceRuleIds: bankFinanceConstraints.map(
        (constraint) => `BANK_FINANCE.${constraint.program.programId}`,
      ),
      sourceReferences: bankFinanceConstraints.flatMap(
        (constraint) => constraint.sourceReferences,
      ),
      parameters: {
        minimumBankFinance: toMonetaryAmount(combinedMinimum),
        maximumBankFinance: toMonetaryAmount(combinedMaximum),
      },
    });
  }

  const nonCompliantBank = bankFinanceConstraints.filter((constraint) =>
    ["BELOW_MINIMUM", "ABOVE_MAXIMUM", "FINANCE_NOT_PERMITTED"].includes(
      constraint.compliance,
    ),
  );
  if (nonCompliantBank.length > 0) {
    conflicts.push({
      code: "BANK_FINANCE_CONSTRAINT_CONFLICT",
      messageCode: "ACTUAL_BANK_FINANCE_VIOLATES_PROGRAM_CONSTRAINT",
      programIds: nonCompliantBank.map(
        (constraint) => constraint.program.programId,
      ),
      sourceRuleIds: nonCompliantBank.map(
        (constraint) => `BANK_FINANCE.${constraint.program.programId}`,
      ),
      sourceReferences: nonCompliantBank.flatMap(
        (constraint) => constraint.sourceReferences,
      ),
      parameters: {
        actualBankFinance: input.actualBankFinance ?? "MISSING",
      },
    });
  }

  const excessiveCredit = bankFinanceConstraints.filter(
    (constraint) => constraint.creditCompliance === "ABOVE_LIMIT",
  );
  if (excessiveCredit.length > 0) {
    conflicts.push({
      code: "BANK_FINANCE_CONSTRAINT_CONFLICT",
      messageCode: "REQUESTED_CREDIT_EXCEEDS_PROGRAM_LIMIT",
      programIds: excessiveCredit.map(
        (constraint) => constraint.program.programId,
      ),
      sourceRuleIds: excessiveCredit.map(
        (constraint) => `CREDIT_LIMIT.${constraint.program.programId}`,
      ),
      sourceReferences: excessiveCredit.flatMap(
        (constraint) => constraint.sourceReferences,
      ),
      parameters: {
        requestedCredit: input.requestedCredit ?? "MISSING",
      },
    });
  }

  if (
    (contributionConstraints.length > 0 &&
      input.actualPromoterContribution === undefined) ||
    (requiringBank.length > 0 && input.actualBankFinance === undefined)
  ) {
    warnings.push({
      code: "SOURCE_BACKED_FINANCING_FACT_REQUIRED",
      severity: "WARNING",
      programIds: programs.map(
        (program) => program.evaluation!.snapshot.programId,
      ),
      costItemIds: [],
      sourceRuleIds: [],
      sourceReferences: [],
      parameters: {},
    });
  }

  return {
    contributionConstraints,
    bankFinanceConstraints,
    requiredPromoterContribution: toMonetaryAmount(requiredPromoter),
    contributionShortfall: toMonetaryAmount(
      promoterShortfall.greaterThan(toDecimal(zero))
        ? promoterShortfall
        : toDecimal(zero),
    ),
    ...(minimums.length > 0 || requiringBank.length > 0
      ? { minimumRequiredBankFinance: toMonetaryAmount(combinedMinimum) }
      : {}),
    ...(combinedMaximum
      ? { maximumPermittedBankFinance: toMonetaryAmount(combinedMaximum) }
      : {}),
    conflicts,
    warnings,
  };
}
