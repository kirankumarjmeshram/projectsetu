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
import type { MonetaryAmount } from "../shared/types";
import { evaluateProgramEligibility } from "./eligibility";
import type {
  AppliedBenefitCap,
  BenefitCalculationBasis,
  CalculatedBenefitResult,
  FinancialBenefitDefinition,
  ProgramEvaluationFacts,
  ProjectCostEligibilityResult,
} from "./program";
import { getFact, type ProgramRuleHandlerRegistry } from "./rules";

function validateBenefit(
  benefit: FinancialBenefitDefinition,
  index: number,
): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  try {
    if (
      benefit.calculation === "PERCENTAGE" &&
      (toDecimal(percentage(benefit.rate)).isNegative() ||
        toDecimal(percentage(benefit.rate)).greaterThan("100"))
    ) {
      errors.push({
        code: "INVALID_PROGRAM_BENEFIT_RATE",
        message: "Percentage benefit rate must be between 0 and 100.",
        path: `benefits.${index}.rate`,
      });
    }
    if (
      benefit.calculation === "FIXED" &&
      toDecimal(monetaryAmount(benefit.fixedAmount)).isNegative()
    ) {
      errors.push({
        code: "NEGATIVE_FIXED_PROGRAM_BENEFIT",
        message: "Fixed benefit must not be negative.",
        path: `benefits.${index}.fixedAmount`,
      });
    }
    if (
      benefit.calculation === "PER_UNIT" &&
      toDecimal(monetaryAmount(benefit.amountPerUnit)).isNegative()
    ) {
      errors.push({
        code: "NEGATIVE_PER_UNIT_PROGRAM_BENEFIT",
        message: "Per-unit benefit amount must not be negative.",
        path: `benefits.${index}.amountPerUnit`,
      });
    }
    if (
      benefit.minimumBenefit !== undefined &&
      toDecimal(monetaryAmount(benefit.minimumBenefit)).isNegative()
    ) {
      errors.push({
        code: "NEGATIVE_MINIMUM_PROGRAM_BENEFIT",
        message: "Minimum benefit must not be negative.",
        path: `benefits.${index}.minimumBenefit`,
      });
    }
    for (const [capIndex, cap] of (benefit.caps ?? []).entries()) {
      if (
        cap.type === "ABSOLUTE" &&
        (cap.amount === undefined ||
          toDecimal(monetaryAmount(cap.amount)).isNegative())
      ) {
        errors.push({
          code: "INVALID_ABSOLUTE_PROGRAM_BENEFIT_CAP",
          message: "Absolute benefit cap requires a non-negative amount.",
          path: `benefits.${index}.caps.${capIndex}`,
        });
      }
      if (
        cap.type === "PERCENTAGE_OF_BASIS" &&
        (cap.percentage === undefined ||
          toDecimal(percentage(cap.percentage)).isNegative() ||
          toDecimal(percentage(cap.percentage)).greaterThan("100"))
      ) {
        errors.push({
          code: "INVALID_PERCENTAGE_PROGRAM_BENEFIT_CAP",
          message: "Percentage cap requires a rate between 0 and 100.",
          path: `benefits.${index}.caps.${capIndex}`,
        });
      }
    }
    const installmentNumbers = new Set<number>();
    let installmentPercentage = toDecimal(percentage("0"));
    for (const [installmentIndex, installment] of (
      benefit.release.installments ?? []
    ).entries()) {
      if (
        !Number.isInteger(installment.installmentNumber) ||
        installment.installmentNumber <= 0 ||
        installmentNumbers.has(installment.installmentNumber)
      ) {
        errors.push({
          code: "INVALID_BENEFIT_RELEASE_INSTALLMENT_NUMBER",
          message:
            "Release installment numbers must be unique positive integers.",
          path: `benefits.${index}.release.installments.${installmentIndex}.installmentNumber`,
        });
      }
      installmentNumbers.add(installment.installmentNumber);
      const rate = toDecimal(percentage(installment.percentage));
      if (rate.isNegative() || rate.greaterThan("100")) {
        errors.push({
          code: "INVALID_BENEFIT_RELEASE_INSTALLMENT_PERCENTAGE",
          message: "Release installment percentage must be between 0 and 100.",
          path: `benefits.${index}.release.installments.${installmentIndex}.percentage`,
        });
      }
      installmentPercentage = installmentPercentage.plus(rate);
    }
    if (
      benefit.release.installments !== undefined &&
      benefit.release.installments.length > 0 &&
      !installmentPercentage.equals("100")
    ) {
      errors.push({
        code: "INVALID_BENEFIT_RELEASE_INSTALLMENT_TOTAL",
        message: "Configured release installment percentages must total 100.",
        path: `benefits.${index}.release.installments`,
      });
    }
  } catch {
    errors.push({
      code: "INVALID_PROGRAM_BENEFIT_DECIMAL",
      message: "Benefit definition contains an invalid decimal value.",
      path: `benefits.${index}`,
    });
  }
  return errors;
}

function resolveCostBasis(
  basis: BenefitCalculationBasis,
  specificCostItemIds: readonly string[] | undefined,
  costEligibility: ProjectCostEligibilityResult,
  actualBeneficiaryContribution: MonetaryAmount | undefined,
  actualBankFinance: MonetaryAmount | undefined,
): MonetaryAmount | undefined {
  switch (basis) {
    case "TOTAL_PROJECT_COST":
      return costEligibility.totalProjectCost;
    case "ELIGIBLE_PROJECT_COST":
      return costEligibility.eligibleProjectCost;
    case "ELIGIBLE_CAPITAL_COST":
      return toMonetaryAmount(
        costEligibility.lines
          .filter((line) => line.costItem.tags.some((tag) => tag === "CAPITAL"))
          .reduce(
            (total, line) => total.plus(toDecimal(line.eligibleAmount)),
            toDecimal(monetaryAmount("0")),
          ),
      );
    case "SPECIFIC_COST_COMPONENTS":
      return toMonetaryAmount(
        costEligibility.lines
          .filter((line) =>
            specificCostItemIds?.includes(line.costItem.costItemId),
          )
          .reduce(
            (total, line) => total.plus(toDecimal(line.eligibleAmount)),
            toDecimal(monetaryAmount("0")),
          ),
      );
    case "BANK_LOAN":
      return actualBankFinance;
    case "BENEFICIARY_CONTRIBUTION":
      return actualBeneficiaryContribution;
    case "FIXED_AMOUNT":
    case "PER_UNIT":
    case "CUSTOM":
      return monetaryAmount("0");
  }
}

export function calculateFinancialBenefits(input: {
  readonly definitions: readonly FinancialBenefitDefinition[];
  readonly facts: ProgramEvaluationFacts;
  readonly costEligibility: ProjectCostEligibilityResult;
  readonly actualBeneficiaryContribution?: MonetaryAmount;
  readonly actualBankFinance?: MonetaryAmount;
  readonly handlers?: ProgramRuleHandlerRegistry;
}): CalculationResult<readonly CalculatedBenefitResult[]> {
  const errors = input.definitions.flatMap((benefit, index) =>
    validateBenefit(benefit, index),
  );
  if (errors.length > 0) return calculationFailure(...errors);

  const results: CalculatedBenefitResult[] = [];
  for (const definition of input.definitions) {
    const basisAmount = resolveCostBasis(
      definition.basis,
      definition.specificCostItemIds,
      input.costEligibility,
      input.actualBeneficiaryContribution,
      input.actualBankFinance,
    );
    if (basisAmount === undefined) {
      results.push({
        benefitId: definition.benefitId,
        benefitKind: definition.kind,
        status: "INSUFFICIENT_INFORMATION",
        sourceReferences: definition.sourceReferences,
        release: definition.release,
      });
      continue;
    }

    let rawBenefit;
    let unitCount;
    if (definition.calculation === "PERCENTAGE") {
      rawBenefit = toDecimal(basisAmount).times(
        percentageToFactor(definition.rate),
      );
    } else if (definition.calculation === "FIXED") {
      rawBenefit = toDecimal(definition.fixedAmount);
    } else if (definition.calculation === "PER_UNIT") {
      const count = getFact(input.facts, definition.unitCountFactPath);
      try {
        unitCount = decimalValue(count);
        if (toDecimal(unitCount).isNegative()) throw new Error();
      } catch {
        results.push({
          benefitId: definition.benefitId,
          benefitKind: definition.kind,
          status:
            count === undefined
              ? "INSUFFICIENT_INFORMATION"
              : "MANUAL_REVIEW_REQUIRED",
          sourceReferences: definition.sourceReferences,
          release: definition.release,
        });
        continue;
      }
      rawBenefit = toDecimal(definition.amountPerUnit).times(
        toDecimal(unitCount),
      );
    } else {
      const handler = input.handlers?.getBenefitHandler(definition.handlerId);
      if (!handler) {
        results.push({
          benefitId: definition.benefitId,
          benefitKind: definition.kind,
          status: "MANUAL_REVIEW_REQUIRED",
          sourceReferences: definition.sourceReferences,
          release: definition.release,
        });
        continue;
      }
      try {
        rawBenefit = toDecimal(
          monetaryAmount(
            handler({
              definition,
              facts: input.facts,
              costEligibility: input.costEligibility,
              actualBeneficiaryContribution:
                input.actualBeneficiaryContribution,
              actualBankFinance: input.actualBankFinance,
            }),
          ),
        );
      } catch {
        return calculationFailure({
          code: "INVALID_CUSTOM_PROGRAM_BENEFIT",
          message: "Custom benefit handler returned an invalid monetary value.",
          path: `benefits.${definition.benefitId}`,
        });
      }
      if (rawBenefit.isNegative()) {
        return calculationFailure({
          code: "NEGATIVE_CUSTOM_PROGRAM_BENEFIT",
          message: "Custom benefit handler must not return a negative amount.",
          path: `benefits.${definition.benefitId}`,
        });
      }
    }

    let calculated = rawBenefit;
    if (
      definition.minimumBenefit !== undefined &&
      calculated.lessThan(toDecimal(definition.minimumBenefit))
    ) {
      calculated = toDecimal(definition.minimumBenefit);
    }

    const appliedCaps: AppliedBenefitCap[] = [];
    let unresolvedCap = false;
    for (const cap of definition.caps ?? []) {
      if (cap.applicability) {
        const applicability = evaluateProgramEligibility(
          cap.applicability,
          input.facts,
          input.handlers,
        );
        if (applicability.status === "INELIGIBLE") continue;
        if (
          applicability.status === "INSUFFICIENT_INFORMATION" ||
          applicability.status === "MANUAL_REVIEW_REQUIRED"
        ) {
          unresolvedCap = true;
          break;
        }
      }
      const capAmount =
        cap.type === "ABSOLUTE"
          ? toDecimal(cap.amount!)
          : toDecimal(basisAmount).times(percentageToFactor(cap.percentage!));
      appliedCaps.push({
        capId: cap.capId,
        capAmount: toMonetaryAmount(capAmount),
        sourceReferences: cap.sourceReferences,
      });
      if (capAmount.lessThan(calculated)) calculated = capAmount;
    }
    if (unresolvedCap) {
      results.push({
        benefitId: definition.benefitId,
        benefitKind: definition.kind,
        status: "MANUAL_REVIEW_REQUIRED",
        sourceReferences: definition.sourceReferences,
        release: definition.release,
      });
      continue;
    }

    results.push({
      benefitId: definition.benefitId,
      benefitKind: definition.kind,
      status: "CALCULATED",
      calculatedEligibleBenefit: toMonetaryAmount(calculated),
      trace: {
        basisType: definition.basis,
        basisAmount,
        ...(definition.calculation === "PERCENTAGE"
          ? { rate: definition.rate }
          : {}),
        ...(definition.calculation === "FIXED"
          ? { fixedAmount: definition.fixedAmount }
          : {}),
        ...(definition.calculation === "PER_UNIT"
          ? { unitCount, amountPerUnit: definition.amountPerUnit }
          : {}),
        rawBenefit: toMonetaryAmount(rawBenefit),
        ...(definition.minimumBenefit
          ? { minimumBenefit: definition.minimumBenefit }
          : {}),
        appliedCaps,
        calculatedEligibleBenefit: toMonetaryAmount(calculated),
      },
      sourceReferences: definition.sourceReferences,
      release: definition.release,
    });
  }
  return calculationSuccess(results);
}
