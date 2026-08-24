import {
  calculationFailure,
  calculationSuccess,
} from "../../../shared/calculation";
import type { CalculationResult } from "../../../shared/calculation";
import {
  monetaryAmount,
  decimalValue,
  percentage,
  percentageToFactor,
  toDecimal,
  toMonetaryAmount,
} from "../../../shared/decimal";
import { evaluateProgramEligibility } from "../../eligibility";
import { classificationTag } from "../../program";
import type { FinancingProgramRegistry } from "../../registry";
import { evaluatePmegpActivityEligibility } from "./activities";
import {
  categoryContributionPercentage,
  resolvePmegpAreaClassification,
  resolvePmegpBeneficiaryCategory,
  resolvePmegpNewEnterpriseRate,
  upgradationRate,
} from "./categories";
import type {
  PmegpBankFinanceConstraint,
  PmegpContributionResult,
  PmegpMarginMoneyResult,
  PmegpNewEnterpriseEvaluationInput,
  PmegpNewEnterpriseEvaluationResult,
  PmegpUpgradationEvaluationInput,
  PmegpUpgradationEvaluationResult,
} from "./contracts";
import {
  calculatePmegpNewEnterpriseCost,
  calculatePmegpUpgradationCost,
  PMEGP_COST_TAGS,
} from "./costs";
import {
  PMEGP_NEW_ENTERPRISE_PROGRAM_ID,
  pmegpNewEnterpriseReleaseLifecycle,
} from "./new-enterprise";
import {
  createPmegpRuleHandlers,
  toPmegpNewEnterpriseProgramFacts,
  toPmegpUpgradationProgramFacts,
} from "./rules";
import { pmegpBankFinanceSource, pmegpLevelsOfSupportSource } from "./sources";
import {
  PMEGP_UPGRADATION_PROGRAM_ID,
  pmegpUpgradationReleaseLifecycle,
} from "./upgradation";

function calculateContribution(input: {
  readonly basis: string;
  readonly rate?: ReturnType<typeof percentage>;
  readonly actual?: PmegpNewEnterpriseEvaluationInput["actualBeneficiaryContribution"];
}): PmegpContributionResult {
  if (!input.rate) {
    return {
      ...(input.actual ? { actualContribution: input.actual.value } : {}),
      complianceResult: "INSUFFICIENT_INFORMATION",
      sourceReferences: [pmegpLevelsOfSupportSource],
    };
  }
  const required = toDecimal(decimalValue(input.basis)).times(
    percentageToFactor(input.rate),
  );
  const actual = input.actual?.value;
  const shortfall = actual
    ? required.minus(toDecimal(actual)).greaterThan(0)
      ? required.minus(toDecimal(actual))
      : toDecimal(monetaryAmount("0"))
    : required;
  return {
    requiredContribution: toMonetaryAmount(required),
    ...(actual ? { actualContribution: actual } : {}),
    shortfall: toMonetaryAmount(shortfall),
    contributionPercentage: input.rate,
    complianceResult: !actual
      ? "INSUFFICIENT_INFORMATION"
      : shortfall.isZero()
        ? "MEETS_REQUIREMENT"
        : "BELOW_REQUIREMENT",
    sourceReferences: [pmegpLevelsOfSupportSource],
  };
}

function calculateBankConstraint(input: {
  readonly basis: string;
  readonly rate?: ReturnType<typeof percentage>;
  readonly actual?: PmegpNewEnterpriseEvaluationInput["actualBankFinance"];
}): PmegpBankFinanceConstraint {
  if (!input.rate) {
    return {
      basisProjectCost: monetaryAmount(input.basis),
      ...(input.actual ? { actualBankFinance: input.actual.value } : {}),
      complianceResult: "INSUFFICIENT_INFORMATION",
      sourceReferences: [pmegpBankFinanceSource],
    };
  }
  const expected = toDecimal(decimalValue(input.basis)).times(
    percentageToFactor(input.rate),
  );
  const actual = input.actual?.value;
  return {
    basisProjectCost: monetaryAmount(input.basis),
    bankFinancePercentage: input.rate,
    expectedBankFinance: toMonetaryAmount(expected),
    ...(actual ? { actualBankFinance: actual } : {}),
    complianceResult: !actual
      ? "INSUFFICIENT_INFORMATION"
      : toDecimal(actual).equals(expected)
        ? "MATCHES_EXPECTED"
        : toDecimal(actual).lessThan(expected)
          ? "BELOW_EXPECTED"
          : "ABOVE_EXPECTED",
    sourceReferences: [pmegpBankFinanceSource],
  };
}

function canCalculateMargin(status: string): boolean {
  return status === "ELIGIBLE" || status === "CONDITIONALLY_ELIGIBLE";
}

function resolveDefinition(
  registry: FinancingProgramRegistry,
  programId: typeof PMEGP_NEW_ENTERPRISE_PROGRAM_ID,
  asOfDate: PmegpNewEnterpriseEvaluationInput["evaluationAsOfDate"],
) {
  return registry.resolveProgramVersion({ programId, asOfDate });
}

export function evaluatePmegpNewEnterprise(
  input: PmegpNewEnterpriseEvaluationInput,
  registry: FinancingProgramRegistry,
): CalculationResult<PmegpNewEnterpriseEvaluationResult> {
  const definition = resolveDefinition(
    registry,
    PMEGP_NEW_ENTERPRISE_PROGRAM_ID,
    input.evaluationAsOfDate,
  );
  if (!definition.ok) return definition;
  const sector = input.project.sector?.value;
  if (!sector) {
    return calculationFailure({
      code: "PMEGP_SECTOR_REQUIRED_FOR_COST_CLASSIFICATION",
      message: "An explicit source-backed PMEGP sector is required.",
      path: "project.sector",
    });
  }
  const cost = calculatePmegpNewEnterpriseCost({
    sector,
    costItems: input.costItems,
  });
  if (!cost.ok) return cost;
  const category = resolvePmegpBeneficiaryCategory({
    applicant: input.applicant,
    location: input.location,
  });
  const area = resolvePmegpAreaClassification(input.location);
  const activity = evaluatePmegpActivityEligibility({
    activity: input.activity,
    location: input.location,
  });
  const facts = toPmegpNewEnterpriseProgramFacts({
    evaluationInput: input,
    cost: cost.value,
    category,
    area,
    activity,
  });
  const eligibility = evaluateProgramEligibility(
    definition.value.eligibility,
    facts,
    createPmegpRuleHandlers(),
  );
  const contributionRate = categoryContributionPercentage(category.category);
  const contribution = calculateContribution({
    basis: cost.value.pmegpFinanceableProjectCost,
    rate: contributionRate,
    actual: input.actualBeneficiaryContribution,
  });
  const bankRate = contributionRate
    ? percentage(
        toDecimal(decimalValue("100"))
          .minus(toDecimal(contributionRate))
          .toString(),
      )
    : undefined;
  const bankConstraint = calculateBankConstraint({
    basis: cost.value.pmegpFinanceableProjectCost,
    rate: bankRate,
    actual: input.actualBankFinance,
  });
  const marginRate = resolvePmegpNewEnterpriseRate({
    category: category.category,
    areaClassification: area.classification,
  });
  let marginMoney: PmegpMarginMoneyResult = {
    status: "INSUFFICIENT_INFORMATION",
  };
  if (marginRate && canCalculateMargin(eligibility.status)) {
    const raw = toDecimal(cost.value.pmegpAdmissibleProjectCost).times(
      percentageToFactor(marginRate),
    );
    const amount = toMonetaryAmount(raw);
    marginMoney = {
      status: "CALCULATED",
      applicableRate: marginRate,
      calculatedEligibleMarginMoney: amount,
      trace: {
        actualProjectCost: cost.value.actualProjectCost,
        admissibleProjectCost: cost.value.pmegpAdmissibleProjectCost,
        beneficiaryCategory: category.category as "GENERAL" | "SPECIAL",
        areaClassification: area.classification as "URBAN" | "RURAL",
        rate: marginRate,
        rawMarginMoney: amount,
        finalCalculatedEligibleMarginMoney: amount,
        sourceReferences: [pmegpLevelsOfSupportSource],
      },
    };
  } else if (
    eligibility.status === "MANUAL_REVIEW_REQUIRED" ||
    activity.status === "MANUAL_REVIEW_REQUIRED"
  ) {
    marginMoney = { status: "MANUAL_REVIEW_REQUIRED" };
  }
  const manualReviewItems = [
    ...activity.manualReviewItems,
    ...(eligibility.status === "INSUFFICIENT_INFORMATION"
      ? ["PMEGP_ELIGIBILITY_INFORMATION_INCOMPLETE"]
      : []),
    ...(eligibility.status === "MANUAL_REVIEW_REQUIRED"
      ? ["PMEGP_ELIGIBILITY_REQUIRES_MANUAL_REVIEW"]
      : []),
  ];
  return calculationSuccess({
    summary: {
      snapshot: {
        programId: definition.value.programId,
        programVersionId: definition.value.versionId,
        evaluationAsOfDate: input.evaluationAsOfDate,
      },
      actualProjectCost: cost.value.actualProjectCost,
      pmegpAdmissibleProjectCost: cost.value.pmegpAdmissibleProjectCost,
      eligibleCapitalExpenditure: cost.value.eligibleCapitalExpenditure,
      eligibleWorkingCapital: cost.value.workingCapital.eligibleWorkingCapital,
      excludedCost: cost.value.excludedCost,
      beneficiaryCategory: category.category,
      areaClassification: area.classification,
      ...(contribution.requiredContribution
        ? { requiredBeneficiaryContribution: contribution.requiredContribution }
        : {}),
      ...(input.actualBeneficiaryContribution
        ? {
            actualBeneficiaryContribution:
              input.actualBeneficiaryContribution.value,
          }
        : {}),
      ...(contribution.shortfall
        ? { contributionShortfall: contribution.shortfall }
        : {}),
      ...(marginRate ? { applicableMarginMoneyRate: marginRate } : {}),
      ...(marginMoney.calculatedEligibleMarginMoney
        ? {
            calculatedEligibleMarginMoney:
              marginMoney.calculatedEligibleMarginMoney,
          }
        : {}),
      expectedBankFinanceConstraint: bankConstraint,
      eligibilityStatus: eligibility.status,
      manualReviewItems,
      ruleTraces: [
        ...eligibility.ruleResults,
        ...category.traces,
        ...area.traces,
        ...activity.traces,
        ...cost.value.lines.flatMap((line) => line.ruleTraces),
      ],
      releaseLifecycle: pmegpNewEnterpriseReleaseLifecycle,
    },
    categoryResolution: category,
    areaResolution: area,
    activityEligibility: activity,
    costEligibility: cost.value,
    contribution,
    marginMoney,
  });
}

export function evaluatePmegpUpgradation(
  input: PmegpUpgradationEvaluationInput,
  registry: FinancingProgramRegistry,
): CalculationResult<PmegpUpgradationEvaluationResult> {
  const definition = registry.resolveProgramVersion({
    programId: PMEGP_UPGRADATION_PROGRAM_ID,
    asOfDate: input.evaluationAsOfDate,
  });
  if (!definition.ok) return definition;
  const sector = input.project.sector?.value;
  if (!sector) {
    return calculationFailure({
      code: "PMEGP_SECTOR_REQUIRED_FOR_COST_CLASSIFICATION",
      message: "An explicit source-backed PMEGP sector is required.",
      path: "project.sector",
    });
  }
  const cost = calculatePmegpUpgradationCost({
    sector,
    costItems: input.costItems,
  });
  if (!cost.ok) return cost;
  const rateResolution = upgradationRate(
    input.location.upgradationSpecialAreas,
  );
  const activity = evaluatePmegpActivityEligibility({
    activity: input.activity,
    location: input.location,
  });
  const facts = toPmegpUpgradationProgramFacts({
    evaluationInput: input,
    cost: cost.value,
    specialArea: rateResolution.rate ? rateResolution.specialArea : undefined,
    activity,
  });
  const eligibility = evaluateProgramEligibility(
    definition.value.eligibility,
    facts,
    createPmegpRuleHandlers(),
  );
  const contribution = calculateContribution({
    basis: cost.value.actualProjectCost,
    rate: percentage("10"),
    actual: input.actualBeneficiaryContribution,
  });
  const bankConstraint = calculateBankConstraint({
    basis: cost.value.actualProjectCost,
    rate: percentage("90"),
    actual: input.actualBankFinance,
  });
  let marginMoney: PmegpMarginMoneyResult = {
    status: "INSUFFICIENT_INFORMATION",
  };
  if (rateResolution.rate && canCalculateMargin(eligibility.status)) {
    const raw = toDecimal(cost.value.pmegpAdmissibleProjectCost).times(
      percentageToFactor(rateResolution.rate),
    );
    const cap = toDecimal(
      monetaryAmount(
        sector === "MANUFACTURING"
          ? rateResolution.specialArea
            ? "2000000"
            : "1500000"
          : rateResolution.specialArea
            ? "500000"
            : "375000",
      ),
    );
    const final = raw.lessThan(cap) ? raw : cap;
    marginMoney = {
      status: "CALCULATED",
      applicableRate: rateResolution.rate,
      calculatedEligibleMarginMoney: toMonetaryAmount(final),
      trace: {
        actualProjectCost: cost.value.actualProjectCost,
        admissibleProjectCost: cost.value.pmegpAdmissibleProjectCost,
        beneficiaryCategory: "GENERAL",
        rate: rateResolution.rate,
        rawMarginMoney: toMonetaryAmount(raw),
        cap: toMonetaryAmount(cap),
        finalCalculatedEligibleMarginMoney: toMonetaryAmount(final),
        sourceReferences: [pmegpLevelsOfSupportSource],
      },
    };
  } else if (eligibility.status === "MANUAL_REVIEW_REQUIRED") {
    marginMoney = { status: "MANUAL_REVIEW_REQUIRED" };
  }
  const capital = input.costItems
    .filter((item) =>
      item.tags.includes(classificationTag(PMEGP_COST_TAGS.CAPITAL)),
    )
    .reduce(
      (total, item) => total.plus(toDecimal(item.amount)),
      toDecimal(decimalValue("0")),
    );
  const workingCapital = input.costItems
    .filter((item) =>
      item.tags.includes(classificationTag(PMEGP_COST_TAGS.WORKING_CAPITAL)),
    )
    .reduce(
      (total, item) => total.plus(toDecimal(item.amount)),
      toDecimal(decimalValue("0")),
    );
  const manualReviewItems = [
    ...activity.manualReviewItems,
    ...(eligibility.status === "INSUFFICIENT_INFORMATION"
      ? ["PMEGP_UPGRADATION_INFORMATION_INCOMPLETE"]
      : []),
    ...(eligibility.status === "MANUAL_REVIEW_REQUIRED"
      ? ["PMEGP_UPGRADATION_REQUIRES_MANUAL_REVIEW"]
      : []),
  ];
  return calculationSuccess({
    summary: {
      snapshot: {
        programId: definition.value.programId,
        programVersionId: definition.value.versionId,
        evaluationAsOfDate: input.evaluationAsOfDate,
      },
      actualProjectCost: cost.value.actualProjectCost,
      pmegpAdmissibleProjectCost: cost.value.pmegpAdmissibleProjectCost,
      eligibleCapitalExpenditure: toMonetaryAmount(capital),
      eligibleWorkingCapital: toMonetaryAmount(workingCapital),
      excludedCost: cost.value.excessProjectCostOutsideSubsidy,
      beneficiaryCategory: "NOT_APPLICABLE",
      areaClassification: "NOT_APPLICABLE",
      requiredBeneficiaryContribution: contribution.requiredContribution,
      ...(input.actualBeneficiaryContribution
        ? {
            actualBeneficiaryContribution:
              input.actualBeneficiaryContribution.value,
          }
        : {}),
      contributionShortfall: contribution.shortfall,
      ...(rateResolution.rate
        ? { applicableMarginMoneyRate: rateResolution.rate }
        : {}),
      ...(marginMoney.calculatedEligibleMarginMoney
        ? {
            calculatedEligibleMarginMoney:
              marginMoney.calculatedEligibleMarginMoney,
          }
        : {}),
      expectedBankFinanceConstraint: bankConstraint,
      eligibilityStatus: eligibility.status,
      manualReviewItems,
      ruleTraces: [
        ...eligibility.ruleResults,
        rateResolution.trace,
        ...activity.traces,
      ],
      releaseLifecycle: pmegpUpgradationReleaseLifecycle,
    },
    activityEligibility: activity,
    costEligibility: cost.value,
    contribution,
    marginMoney,
  });
}
