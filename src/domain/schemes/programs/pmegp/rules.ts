import type { CalculationResult } from "../../../shared/calculation";
import {
  calculationFailure,
  calculationSuccess,
} from "../../../shared/calculation";
import {
  decimalValue,
  monetaryAmount,
  percentage,
  percentageToFactor,
  toDecimal,
  toMonetaryAmount,
} from "../../../shared/decimal";
import type { ProgramEvaluationFacts } from "../../program";
import { getFact, ProgramRuleHandlerRegistry } from "../../rules";
import { resolvePmegpNewEnterpriseRate } from "./categories";
import type {
  PmegpActivityEligibilityResult,
  PmegpAreaResolution,
  PmegpCategoryResolution,
  PmegpNewEnterpriseCostResult,
  PmegpNewEnterpriseEvaluationInput,
  PmegpUpgradationCostResult,
  PmegpUpgradationEvaluationInput,
} from "./contracts";

export const PMEGP_HANDLER_IDS = {
  NEW_AGE: "PMEGP.NEW.AGE-ABOVE-18",
  NEW_EDUCATION: "PMEGP.NEW.EDUCATION-THRESHOLD",
  NEW_CAPITAL_EXPENDITURE: "PMEGP.NEW.CAPITAL-EXPENDITURE",
  ACTIVITY: "PMEGP.ACTIVITY-ELIGIBILITY",
  UPGRADATION_PRIOR_MARGIN_MONEY:
    "PMEGP.UPGRADATION.PRIOR-MARGIN-MONEY-ADJUSTMENT",
  NEW_MARGIN_MONEY: "PMEGP.NEW.MARGIN-MONEY",
  UPGRADATION_MARGIN_MONEY: "PMEGP.UPGRADATION.MARGIN-MONEY",
} as const;

function resolvedActivityStatus(
  result: PmegpActivityEligibilityResult,
): string {
  if (result.status === "PROHIBITED") return "PROHIBITED";
  if (
    result.status === "MANUAL_REVIEW_REQUIRED" ||
    result.portfolioConstraintStatus === "MANUAL_REVIEW_REQUIRED" ||
    result.portfolioConstraintStatus === "UNSATISFIED"
  ) {
    return "MANUAL_REVIEW_REQUIRED";
  }
  return result.status;
}

export function toPmegpNewEnterpriseProgramFacts(input: {
  readonly evaluationInput: PmegpNewEnterpriseEvaluationInput;
  readonly cost: PmegpNewEnterpriseCostResult;
  readonly category: PmegpCategoryResolution;
  readonly area: PmegpAreaResolution;
  readonly activity: PmegpActivityEligibilityResult;
}): ProgramEvaluationFacts {
  const source = input.evaluationInput;
  return {
    applicant: {
      entityType: source.applicant.entityType?.value,
      ageYears: source.applicant.ageYears?.value,
      educationStandardPassed: source.applicant.educationStandardPassed?.value,
      hasPreviouslyAvailedGovernmentSubsidy:
        source.applicant.hasPreviouslyAvailedGovernmentSubsidy?.value,
      existingUnitAssistedUnderGovernmentScheme:
        source.applicant.existingUnitAssistedUnderGovernmentScheme?.value,
      familyHasExistingPmegpBeneficiary:
        source.applicant.familyHasExistingPmegpBeneficiary?.value,
      ...(input.category.category === "GENERAL" ||
      input.category.category === "SPECIAL"
        ? { pmegpCategory: input.category.category }
        : {}),
    },
    project: {
      projectType: source.project.projectType?.value,
      sector: source.project.sector?.value,
      pmegpProjectCost: input.cost.pmegpFinanceableProjectCost,
      pmegpAdmissibleProjectCost: input.cost.pmegpAdmissibleProjectCost,
      eligibleCapitalExpenditure: input.cost.eligibleCapitalExpenditure,
    },
    location: {
      ...(input.area.classification === "URBAN" ||
      input.area.classification === "RURAL"
        ? { areaClassification: input.area.classification }
        : {}),
    },
    activity: { resolvedStatus: resolvedActivityStatus(input.activity) },
  };
}

export function toPmegpUpgradationProgramFacts(input: {
  readonly evaluationInput: PmegpUpgradationEvaluationInput;
  readonly cost: PmegpUpgradationCostResult;
  readonly specialArea: boolean | undefined;
  readonly activity: PmegpActivityEligibilityResult;
}): ProgramEvaluationFacts {
  const source = input.evaluationInput;
  return {
    project: {
      sector: source.project.sector?.value,
      pmegpProjectCost: input.cost.actualProjectCost,
      pmegpAdmissibleProjectCost: input.cost.pmegpAdmissibleProjectCost,
    },
    enterprise: {
      priorProgram: source.history.priorProgram?.value,
      priorMarginMoneyAdjusted: source.history.priorMarginMoneyAdjusted?.value,
      firstLoanRepaidOnTime: source.history.firstLoanRepaidOnTime?.value,
      profitableYears: source.history.profitableYears?.value,
      hasGoodTurnover: source.history.hasGoodTurnover?.value,
      hasGrowthPotential: source.history.hasGrowthPotential?.value,
      udyamRegistered: source.history.udyamRegistered?.value,
    },
    location: {
      ...(input.specialArea === undefined
        ? {}
        : {
            upgradationAreaType: input.specialArea ? "SPECIAL" : "STANDARD",
          }),
    },
    activity: { resolvedStatus: resolvedActivityStatus(input.activity) },
  };
}

function registerHandlers(
  handlers: ProgramRuleHandlerRegistry,
): CalculationResult<ProgramRuleHandlerRegistry> {
  const registrations = [
    handlers.registerEligibilityHandler(
      PMEGP_HANDLER_IDS.NEW_AGE,
      ({ facts }) => {
        const entityType = getFact(facts, "applicant.entityType");
        if (entityType === undefined) {
          return {
            status: "UNKNOWN",
            explanationCode: "PMEGP_ENTITY_TYPE_MISSING",
          };
        }
        if (entityType !== "INDIVIDUAL") {
          return {
            status: "PASS",
            explanationCode: "PMEGP_AGE_RULE_NOT_APPLICABLE_TO_NON_INDIVIDUAL",
          };
        }
        const age = getFact(facts, "applicant.ageYears");
        if (age === undefined) {
          return { status: "UNKNOWN", explanationCode: "PMEGP_AGE_MISSING" };
        }
        try {
          const passes = toDecimal(decimalValue(age)).greaterThan("18");
          return {
            status: passes ? "PASS" : "FAIL",
            explanationCode: passes
              ? "PMEGP_AGE_ABOVE_18"
              : "PMEGP_AGE_NOT_ABOVE_18",
          };
        } catch {
          return {
            status: "MANUAL_REVIEW",
            explanationCode: "PMEGP_AGE_INVALID",
          };
        }
      },
    ),
    handlers.registerEligibilityHandler(
      PMEGP_HANDLER_IDS.NEW_EDUCATION,
      ({ facts }) => {
        const sector = getFact(facts, "project.sector");
        const projectCost = getFact(facts, "project.pmegpProjectCost");
        if (sector === undefined || projectCost === undefined) {
          return {
            status: "UNKNOWN",
            explanationCode: "PMEGP_EDUCATION_THRESHOLD_INPUT_MISSING",
          };
        }
        try {
          const threshold = sector === "MANUFACTURING" ? "1000000" : "500000";
          if (
            toDecimal(decimalValue(projectCost)).lessThanOrEqualTo(threshold)
          ) {
            return {
              status: "PASS",
              explanationCode:
                "PMEGP_EDUCATION_NOT_REQUIRED_AT_OR_BELOW_THRESHOLD",
            };
          }
          const education = getFact(facts, "applicant.educationStandardPassed");
          if (education === undefined) {
            return {
              status: "UNKNOWN",
              explanationCode:
                "PMEGP_EDUCATION_EVIDENCE_MISSING_ABOVE_THRESHOLD",
            };
          }
          const passes = toDecimal(
            decimalValue(education),
          ).greaterThanOrEqualTo("8");
          return {
            status: passes ? "PASS" : "FAIL",
            explanationCode: passes
              ? "PMEGP_MINIMUM_EIGHTH_STANDARD_MET"
              : "PMEGP_MINIMUM_EIGHTH_STANDARD_NOT_MET",
          };
        } catch {
          return {
            status: "MANUAL_REVIEW",
            explanationCode: "PMEGP_EDUCATION_INPUT_INVALID",
          };
        }
      },
    ),
    handlers.registerEligibilityHandler(
      PMEGP_HANDLER_IDS.NEW_CAPITAL_EXPENDITURE,
      ({ facts }) => {
        const capital = getFact(facts, "project.eligibleCapitalExpenditure");
        if (capital === undefined) {
          return {
            status: "UNKNOWN",
            explanationCode: "PMEGP_CAPITAL_EXPENDITURE_MISSING",
          };
        }
        try {
          const passes = toDecimal(decimalValue(capital)).greaterThan(0);
          return {
            status: passes ? "PASS" : "FAIL",
            explanationCode: passes
              ? "PMEGP_HAS_ELIGIBLE_CAPITAL_EXPENDITURE"
              : "PMEGP_WORKING_CAPITAL_ONLY_PROJECT",
          };
        } catch {
          return {
            status: "MANUAL_REVIEW",
            explanationCode: "PMEGP_CAPITAL_EXPENDITURE_INVALID",
          };
        }
      },
    ),
    handlers.registerEligibilityHandler(
      PMEGP_HANDLER_IDS.ACTIVITY,
      ({ facts }) => {
        const status = getFact(facts, "activity.resolvedStatus");
        switch (status) {
          case "ALLOWED":
            return {
              status: "PASS",
              explanationCode: "PMEGP_ACTIVITY_ALLOWED",
            };
          case "ALLOWED_WITH_CONDITIONS":
            return {
              status: "CONDITIONAL_PASS",
              explanationCode: "PMEGP_ACTIVITY_ALLOWED_WITH_CONDITIONS",
            };
          case "PROHIBITED":
            return {
              status: "FAIL",
              explanationCode: "PMEGP_ACTIVITY_PROHIBITED",
            };
          case "MANUAL_REVIEW_REQUIRED":
          default:
            return {
              status: "MANUAL_REVIEW",
              explanationCode: "PMEGP_ACTIVITY_REQUIRES_MANUAL_REVIEW",
            };
        }
      },
    ),
    handlers.registerEligibilityHandler(
      PMEGP_HANDLER_IDS.UPGRADATION_PRIOR_MARGIN_MONEY,
      ({ facts }) => {
        const priorProgram = getFact(facts, "enterprise.priorProgram");
        if (priorProgram === undefined) {
          return {
            status: "UNKNOWN",
            explanationCode: "PMEGP_UPGRADATION_PRIOR_PROGRAM_MISSING",
          };
        }
        if (priorProgram === "MUDRA") {
          return {
            status: "PASS",
            explanationCode:
              "PMEGP_UPGRADATION_MUDRA_HAS_NO_PMEGP_MARGIN_MONEY",
          };
        }
        const adjusted = getFact(facts, "enterprise.priorMarginMoneyAdjusted");
        if (adjusted === undefined) {
          return {
            status: "UNKNOWN",
            explanationCode: "PMEGP_PRIOR_MARGIN_MONEY_ADJUSTMENT_MISSING",
          };
        }
        return {
          status: adjusted === true ? "PASS" : "FAIL",
          explanationCode:
            adjusted === true
              ? "PMEGP_PRIOR_MARGIN_MONEY_ADJUSTED"
              : "PMEGP_PRIOR_MARGIN_MONEY_NOT_ADJUSTED",
        };
      },
    ),
    handlers.registerBenefitHandler(
      PMEGP_HANDLER_IDS.NEW_MARGIN_MONEY,
      ({ facts }) => {
        const category = getFact(facts, "applicant.pmegpCategory");
        const area = getFact(facts, "location.areaClassification");
        const basis = getFact(facts, "project.pmegpAdmissibleProjectCost");
        if (
          (category !== "GENERAL" && category !== "SPECIAL") ||
          (area !== "URBAN" && area !== "RURAL") ||
          basis === undefined
        ) {
          throw new Error("PMEGP margin-money facts are incomplete.");
        }
        const rate = resolvePmegpNewEnterpriseRate({
          category,
          areaClassification: area,
        })!;
        return toMonetaryAmount(
          toDecimal(decimalValue(basis)).times(percentageToFactor(rate)),
        );
      },
    ),
    handlers.registerBenefitHandler(
      PMEGP_HANDLER_IDS.UPGRADATION_MARGIN_MONEY,
      ({ facts }) => {
        const sector = getFact(facts, "project.sector");
        const area = getFact(facts, "location.upgradationAreaType");
        const basis = getFact(facts, "project.pmegpAdmissibleProjectCost");
        if (
          (sector !== "MANUFACTURING" &&
            sector !== "SERVICE" &&
            sector !== "BUSINESS_TRADING") ||
          (area !== "SPECIAL" && area !== "STANDARD") ||
          basis === undefined
        ) {
          throw new Error("PMEGP upgradation facts are incomplete.");
        }
        const special = area === "SPECIAL";
        const raw = toDecimal(decimalValue(basis)).times(
          percentageToFactor(percentage(special ? "20" : "15")),
        );
        const cap = toDecimal(
          monetaryAmount(
            sector === "MANUFACTURING"
              ? special
                ? "2000000"
                : "1500000"
              : special
                ? "500000"
                : "375000",
          ),
        );
        return toMonetaryAmount(raw.lessThan(cap) ? raw : cap);
      },
    ),
  ];
  const errors = registrations.flatMap((registration) =>
    registration.ok ? [] : registration.errors,
  );
  return errors.length > 0
    ? calculationFailure(...errors)
    : calculationSuccess(handlers);
}

export function createPmegpRuleHandlers(): ProgramRuleHandlerRegistry {
  const handlers = new ProgramRuleHandlerRegistry();
  const registered = registerHandlers(handlers);
  if (!registered.ok) {
    throw new Error(registered.errors.map((error) => error.code).join(", "));
  }
  return handlers;
}
