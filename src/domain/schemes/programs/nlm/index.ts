import type { CalculationResult } from "../../../shared/calculation";
import {
  calculationFailure,
  calculationSuccess,
} from "../../../shared/calculation";
import { percentage } from "../../../shared/decimal";
import type { FinancingProgramDefinition } from "../../program";
import { classificationTag } from "../../program";
import { FinancingProgramRegistry } from "../../registry";
import { nlmActivities } from "./activities";
import {
  nlmFebruary2026AmendmentSource,
  nlmJanuary2025GuidelineSource,
  nlmProgramSources,
  nlmUnitSizeSource,
} from "./sources";
import { NLM_CURRENT_VERSION_ID } from "./version";

export * from "./activities";
export * from "./contracts";
export * from "./evaluation";
export * from "./rules";
export * from "./sources";
export * from "./version";

export const NLM_PROGRAM_FAMILY_ID = "GOI.NLM";

export const nlmProgramDefinitions: readonly FinancingProgramDefinition[] =
  nlmActivities.map((activity) => ({
    programId: activity.programId,
    versionId: NLM_CURRENT_VERSION_ID,
    displayName: activity.displayName,
    description:
      "Activity-specific NLM capital subsidy evaluated against the January 2025 operational guideline as amended on 25-02-2026.",
    programTypes: ["CAPITAL_SUBSIDY", "COMPOSITE_ASSISTANCE"],
    effectiveFrom: "2026-02-25",
    status: "ACTIVE",
    jurisdiction: { country: "IN" },
    sourceReferences: nlmProgramSources,
    eligibility: {
      groupId: `NLM.${activity.activity}.ELIGIBILITY`,
      operator: "ALL",
      rules: [
        {
          ruleId: `NLM.${activity.activity}.ENTITY`,
          name: "Activity-specific eligible entity",
          type: "ENTITY_TYPE",
          factPath: "applicant.entityType",
          expectedValues: activity.eligibleEntities,
          sourceReferences: [
            nlmJanuary2025GuidelineSource,
            nlmFebruary2026AmendmentSource,
          ],
        },
      ],
    },
    costEligibilityRules: [
      {
        ruleId: `NLM.${activity.activity}.EXPRESS-EXCLUSIONS`,
        type: "EXCLUDE_TAGS",
        tags: [
          classificationTag("LAND_PURCHASE"),
          classificationTag("LAND_RENT"),
          classificationTag("LAND_LEASE"),
          classificationTag("WORKING_CAPITAL"),
          classificationTag("PERSONAL_VEHICLE"),
        ],
        sourceReferences: [nlmJanuary2025GuidelineSource],
      },
    ],
    benefits: [
      {
        benefitId: `NLM.${activity.activity}.CAPITAL-SUBSIDY`,
        name: "NLM activity-specific calculated capital subsidy",
        kind: "CAPITAL_SUBSIDY",
        basis: "ELIGIBLE_CAPITAL_COST",
        calculation: "PERCENTAGE",
        rate: percentage("50"),
        creditLinked: false,
        ...(activity.fixedCap || activity.unitOptions.length === 1
          ? {
              caps: [
                {
                  capId: `NLM.${activity.activity}.CAP`,
                  type: "ABSOLUTE" as const,
                  amount: activity.fixedCap ?? activity.unitOptions[0]!.cap,
                  sourceReferences: [nlmUnitSizeSource],
                },
              ],
            }
          : {}),
        release: {
          mechanism: "MULTIPLE_INSTALLMENTS",
          installments: [
            {
              installmentNumber: 1,
              percentage: percentage("50"),
              trigger: "LOAN_FIRST_DISBURSEMENT",
            },
            {
              installmentNumber: 2,
              percentage: percentage("50"),
              trigger: "PROJECT_COMPLETION",
              conditions: ["STATE_IMPLEMENTING_AGENCY_VERIFICATION"],
            },
          ],
        },
        sourceReferences: [nlmJanuary2025GuidelineSource, nlmUnitSizeSource],
      },
    ],
    bankFinanceRequirement: {
      requirement: "OPTIONAL",
      selfFinanceAllowed: true,
      creditLinkedBenefit: false,
      sourceReferences: [nlmJanuary2025GuidelineSource],
    },
  }));

export function registerNlmProgramDefinitions(
  registry: FinancingProgramRegistry,
): CalculationResult<readonly FinancingProgramDefinition[]> {
  const results = nlmProgramDefinitions.map((definition) =>
    registry.registerProgramDefinition(definition),
  );
  const errors = results.flatMap((result) => (result.ok ? [] : result.errors));
  return errors.length > 0
    ? calculationFailure(...errors)
    : calculationSuccess(
        results.flatMap((result) => (result.ok ? [result.value] : [])),
      );
}
