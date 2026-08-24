import type { Assumption } from "../shared/assumptions";
import type {
  CalculationError,
  CalculationResult,
} from "../shared/calculation";
import { calculationFailure, calculationSuccess } from "../shared/calculation";
import {
  monetaryAmount,
  percentage,
  percentageToFactor,
  toDecimal,
  toMonetaryAmount,
} from "../shared/decimal";
import type { MonetaryAmount } from "../shared/types";
import type {
  BankFinanceComplianceResult,
  BankFinanceRequirement,
  BeneficiaryContributionRequirement,
  ContributionComplianceResult,
  ProgramFundingConstraint,
  ProjectCostEligibilityResult,
} from "./program";

function validateActualAmount(
  assumption: Assumption<MonetaryAmount> | undefined,
  path: string,
): CalculationError | undefined {
  if (assumption === undefined) return undefined;
  if (!assumption.source) {
    return {
      code: "MISSING_PROGRAM_FINANCING_SOURCE",
      message: "Actual financing facts must be explicitly source-backed.",
      path,
    };
  }
  try {
    if (toDecimal(monetaryAmount(assumption.value)).isNegative()) {
      return {
        code: "NEGATIVE_PROGRAM_FINANCING_AMOUNT",
        message: "Actual financing amounts must not be negative.",
        path: `${path}.value`,
      };
    }
  } catch {
    return {
      code: "INVALID_PROGRAM_FINANCING_AMOUNT",
      message: "Actual financing amount must be a canonical monetary value.",
      path: `${path}.value`,
    };
  }
}

export function calculateContributionCompliance(input: {
  readonly requirement?: BeneficiaryContributionRequirement;
  readonly costEligibility: ProjectCostEligibilityResult;
  readonly actualContribution?: Assumption<MonetaryAmount>;
}): CalculationResult<ContributionComplianceResult> {
  const actualError = validateActualAmount(
    input.actualContribution,
    "actualBeneficiaryContribution",
  );
  if (actualError) return calculationFailure(actualError);

  if (input.requirement) {
    try {
      for (const [field, rate] of [
        ["minimumPercentage", input.requirement.minimumPercentage],
        ["fixedPercentage", input.requirement.fixedPercentage],
      ] as const) {
        if (rate === undefined) continue;
        const value = toDecimal(percentage(rate));
        if (value.isNegative() || value.greaterThan("100")) {
          return calculationFailure({
            code: "INVALID_CONTRIBUTION_REQUIREMENT_PERCENTAGE",
            message:
              "Contribution requirement percentage must be between 0 and 100.",
            path: `contributionRequirement.${field}`,
          });
        }
      }
      if (
        input.requirement.minimumAmount !== undefined &&
        toDecimal(monetaryAmount(input.requirement.minimumAmount)).isNegative()
      ) {
        return calculationFailure({
          code: "NEGATIVE_MINIMUM_CONTRIBUTION",
          message: "Minimum contribution amount must not be negative.",
          path: "contributionRequirement.minimumAmount",
        });
      }
    } catch {
      return calculationFailure({
        code: "INVALID_CONTRIBUTION_REQUIREMENT",
        message: "Contribution requirement contains an invalid decimal value.",
        path: "contributionRequirement",
      });
    }
  }

  if (!input.requirement) {
    return calculationSuccess({
      status: "NOT_APPLICABLE",
      requiredMinimumContribution: monetaryAmount("0"),
      ...(input.actualContribution
        ? { actualContribution: input.actualContribution.value }
        : {}),
      shortfall: monetaryAmount("0"),
      sourceReferences: [],
    });
  }

  const basis = toDecimal(
    input.requirement.basis === "TOTAL_PROJECT_COST"
      ? input.costEligibility.totalProjectCost
      : input.costEligibility.eligibleProjectCost,
  );
  let required = toDecimal(monetaryAmount("0"));
  for (const rate of [
    input.requirement.minimumPercentage,
    input.requirement.fixedPercentage,
  ]) {
    if (rate !== undefined) {
      const candidate = basis.times(percentageToFactor(rate));
      if (candidate.greaterThan(required)) required = candidate;
    }
  }
  if (
    input.requirement.minimumAmount !== undefined &&
    toDecimal(input.requirement.minimumAmount).greaterThan(required)
  ) {
    required = toDecimal(input.requirement.minimumAmount);
  }
  if (!input.actualContribution) {
    return calculationSuccess({
      status: required.isZero() ? "NOT_APPLICABLE" : "INSUFFICIENT_INFORMATION",
      requiredMinimumContribution: toMonetaryAmount(required),
      shortfall: toMonetaryAmount(required),
      sourceReferences: input.requirement.sourceReferences,
    });
  }
  const actual = toDecimal(input.actualContribution.value);
  const shortfall = required.minus(actual);
  return calculationSuccess({
    status: actual.greaterThanOrEqualTo(required)
      ? "MEETS_REQUIREMENT"
      : "BELOW_REQUIREMENT",
    requiredMinimumContribution: toMonetaryAmount(required),
    actualContribution: input.actualContribution.value,
    shortfall: toMonetaryAmount(
      shortfall.isPositive() ? shortfall : toDecimal(monetaryAmount("0")),
    ),
    sourceReferences: input.requirement.sourceReferences,
  });
}

export function calculateBankFinanceCompliance(input: {
  readonly requirement?: BankFinanceRequirement;
  readonly actualBankFinance?: Assumption<MonetaryAmount>;
}): CalculationResult<BankFinanceComplianceResult> {
  const actualError = validateActualAmount(
    input.actualBankFinance,
    "actualBankFinance",
  );
  if (actualError) return calculationFailure(actualError);

  if (input.requirement) {
    try {
      const minimum = input.requirement.minimumAmount
        ? toDecimal(monetaryAmount(input.requirement.minimumAmount))
        : undefined;
      const maximum = input.requirement.maximumAmount
        ? toDecimal(monetaryAmount(input.requirement.maximumAmount))
        : undefined;
      if (minimum?.isNegative() || maximum?.isNegative()) {
        return calculationFailure({
          code: "NEGATIVE_BANK_FINANCE_CONSTRAINT",
          message: "Bank-finance limits must not be negative.",
          path: "bankFinanceRequirement",
        });
      }
      if (minimum && maximum && minimum.greaterThan(maximum)) {
        return calculationFailure({
          code: "INVALID_BANK_FINANCE_CONSTRAINT_RANGE",
          message: "Minimum bank finance must not exceed maximum bank finance.",
          path: "bankFinanceRequirement",
        });
      }
    } catch {
      return calculationFailure({
        code: "INVALID_BANK_FINANCE_CONSTRAINT",
        message: "Bank-finance constraint contains an invalid monetary value.",
        path: "bankFinanceRequirement",
      });
    }
  }

  if (!input.requirement) {
    return calculationSuccess({
      status: "NOT_APPLICABLE",
      ...(input.actualBankFinance
        ? { actualBankFinance: input.actualBankFinance.value }
        : {}),
      sourceReferences: [],
    });
  }
  if (!input.actualBankFinance) {
    return calculationSuccess({
      status:
        input.requirement.requirement === "OPTIONAL"
          ? "NOT_APPLICABLE"
          : "INSUFFICIENT_INFORMATION",
      sourceReferences: input.requirement.sourceReferences,
    });
  }

  const actual = toDecimal(input.actualBankFinance.value);
  let status: BankFinanceComplianceResult["status"] = "MEETS_REQUIREMENT";
  if (
    input.requirement.requirement === "NOT_PERMITTED" &&
    actual.isPositive()
  ) {
    status = "FINANCE_NOT_PERMITTED";
  } else if (
    input.requirement.minimumAmount !== undefined &&
    actual.lessThan(toDecimal(input.requirement.minimumAmount))
  ) {
    status = "BELOW_MINIMUM";
  } else if (
    input.requirement.maximumAmount !== undefined &&
    actual.greaterThan(toDecimal(input.requirement.maximumAmount))
  ) {
    status = "ABOVE_MAXIMUM";
  }
  return calculationSuccess({
    status,
    actualBankFinance: input.actualBankFinance.value,
    sourceReferences: input.requirement.sourceReferences,
  });
}

export function calculateProgramFundingConstraint(input: {
  readonly costEligibility: ProjectCostEligibilityResult;
  readonly maximumCalculatedBenefit: MonetaryAmount;
  readonly contributionRequirement?: BeneficiaryContributionRequirement;
  readonly bankFinanceRequirement?: BankFinanceRequirement;
  readonly actualBeneficiaryContribution?: Assumption<MonetaryAmount>;
  readonly actualBankFinance?: Assumption<MonetaryAmount>;
}): CalculationResult<ProgramFundingConstraint> {
  const contributionCompliance = calculateContributionCompliance({
    requirement: input.contributionRequirement,
    costEligibility: input.costEligibility,
    actualContribution: input.actualBeneficiaryContribution,
  });
  const bankFinanceCompliance = calculateBankFinanceCompliance({
    requirement: input.bankFinanceRequirement,
    actualBankFinance: input.actualBankFinance,
  });
  if (!contributionCompliance.ok || !bankFinanceCompliance.ok) {
    return calculationFailure(
      ...(!contributionCompliance.ok ? contributionCompliance.errors : []),
      ...(!bankFinanceCompliance.ok ? bankFinanceCompliance.errors : []),
    );
  }
  return calculationSuccess({
    minimumPromoterContribution:
      contributionCompliance.value.requiredMinimumContribution,
    maximumCalculatedBenefit: input.maximumCalculatedBenefit,
    bankFinanceRequired:
      input.bankFinanceRequirement?.requirement === "REQUIRED",
    ...(input.bankFinanceRequirement?.minimumAmount
      ? { minimumBankFinance: input.bankFinanceRequirement.minimumAmount }
      : {}),
    ...(input.bankFinanceRequirement?.maximumAmount
      ? { maximumBankFinance: input.bankFinanceRequirement.maximumAmount }
      : {}),
    selfFinanceAllowed:
      input.bankFinanceRequirement?.selfFinanceAllowed ?? true,
    eligibleCost: input.costEligibility.eligibleProjectCost,
    ineligibleCost: input.costEligibility.ineligibleProjectCost,
    contributionCompliance: contributionCompliance.value,
    bankFinanceCompliance: bankFinanceCompliance.value,
  });
}
