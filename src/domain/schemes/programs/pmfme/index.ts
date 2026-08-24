import type { CalculationResult } from "../../../shared/calculation";
import {
  calculationFailure,
  calculationSuccess,
} from "../../../shared/calculation";
import { monetaryAmount, percentage } from "../../../shared/decimal";
import type {
  FinancingProgramDefinition,
  ProgramConvergenceRule,
} from "../../program";
import { programId } from "../../program";
import { FinancingProgramRegistry } from "../../registry";
import { PMFME_COMPONENT_ENTITIES } from "./activities";
import type { PmfmeComponent } from "./contracts";
import {
  PMFME_COMMON_INFRA_CAP,
  PMFME_INDIVIDUAL_CAP,
  PMFME_SEED_CAPITAL_PER_MEMBER,
  PMFME_SEED_CAPITAL_PER_SHG_CAP,
} from "./rules";
import {
  pmfmeAifConvergenceSource,
  pmfmeMay2022ModificationSource,
  pmfmeProgramSources,
} from "./sources";
import { PMFME_CURRENT_RULE_VERSION_ID } from "./version";

export * from "./activities";
export * from "./contracts";
export * from "./evaluation";
export * from "./rules";
export * from "./sources";
export * from "./version";

export const PMFME_PROGRAM_FAMILY_ID = "GOI.PMFME";
export const PMFME_PROGRAM_IDS = {
  INDIVIDUAL_UNIT: programId("GOI.PMFME.INDIVIDUAL_UNIT"),
  GROUP_CAPITAL_SUPPORT: programId("GOI.PMFME.GROUP_CAPITAL_SUPPORT"),
  COMMON_INFRASTRUCTURE: programId("GOI.PMFME.COMMON_INFRASTRUCTURE"),
  SHG_SEED_CAPITAL: programId("GOI.PMFME.SHG_SEED_CAPITAL"),
} as const;

const components = Object.keys(PMFME_PROGRAM_IDS) as readonly PmfmeComponent[];

export const pmfmeProgramDefinitions: readonly FinancingProgramDefinition[] =
  components.map((component) => {
    const seed = component === "SHG_SEED_CAPITAL";
    const common = component === "COMMON_INFRASTRUCTURE";
    const cap = common ? PMFME_COMMON_INFRA_CAP : PMFME_INDIVIDUAL_CAP;
    return {
      programId: PMFME_PROGRAM_IDS[component],
      versionId: PMFME_CURRENT_RULE_VERSION_ID,
      displayName: `PMFME - ${component.replaceAll("_", " ")}`,
      description:
        "PMFME component definition under the 18-05-2022 modification, with post-2024-25 continuation uncertainty retained by the evaluator.",
      programTypes: seed
        ? ["SEED_CAPITAL"]
        : ["CAPITAL_SUBSIDY", "COMPOSITE_ASSISTANCE"],
      effectiveFrom: "2022-05-18",
      status: "ACTIVE",
      jurisdiction: { country: "IN" },
      sourceReferences: pmfmeProgramSources,
      eligibility: {
        groupId: `PMFME.${component}.ELIGIBILITY`,
        operator: "ALL",
        rules: [
          {
            ruleId: `PMFME.${component}.ENTITY`,
            name: "PMFME component-specific entity",
            type: "ENTITY_TYPE",
            factPath: "applicant.entityType",
            expectedValues: PMFME_COMPONENT_ENTITIES[component],
            sourceReferences: [pmfmeMay2022ModificationSource],
          },
        ],
      },
      costEligibilityRules: seed
        ? []
        : [
            {
              ruleId: `PMFME.${component}.LAND-AND-WORKSHED-EXCLUSION`,
              type: "EXCLUDE_CATEGORIES",
              categories: ["LAND", "RENTAL_WORKSHED", "LEASE_WORKSHED"],
              sourceReferences: [pmfmeMay2022ModificationSource],
            },
          ],
      benefits: seed
        ? [
            {
              benefitId: "PMFME.SHG.SEED-CAPITAL",
              name: "PMFME seed capital per food-processing SHG member",
              kind: "SEED_CAPITAL",
              basis: "PER_UNIT",
              calculation: "PER_UNIT",
              amountPerUnit: PMFME_SEED_CAPITAL_PER_MEMBER,
              unitCountFactPath: "applicant.foodProcessingShgMembers",
              caps: [
                {
                  capId: "PMFME.SHG.SEED-CAPITAL-CAP",
                  type: "ABSOLUTE",
                  amount: PMFME_SEED_CAPITAL_PER_SHG_CAP,
                  sourceReferences: [pmfmeProgramSources[2]],
                },
              ],
              creditLinked: false,
              release: {
                mechanism: "CUSTOM_CONDITIONAL",
                conditions: [
                  "GRANT_TO_SHG_FEDERATION_THROUGH_SRLM_SULM_AND_SNA",
                  "LOAN_FROM_FEDERATION_TO_ELIGIBLE_MEMBER",
                ],
              },
              sourceReferences: [pmfmeProgramSources[2]],
            },
          ]
        : [
            {
              benefitId: `PMFME.${component}.CAPITAL-SUBSIDY`,
              name: "PMFME credit-linked capital subsidy",
              kind: "CAPITAL_SUBSIDY",
              basis: "ELIGIBLE_PROJECT_COST",
              calculation: "PERCENTAGE",
              rate: percentage("35"),
              caps: [
                {
                  capId: `PMFME.${component}.CAP`,
                  type: "ABSOLUTE",
                  amount: cap,
                  sourceReferences: [pmfmeMay2022ModificationSource],
                },
              ],
              creditLinked: true,
              release: {
                mechanism: "BACK_ENDED",
                conditions: ["BANK_LOAN_REQUIRED", "NOT_IMMEDIATE_CASH"],
              },
              sourceReferences: [pmfmeMay2022ModificationSource],
            },
          ],
      ...(seed
        ? {}
        : {
            contributionRequirement: {
              basis: "TOTAL_PROJECT_COST" as const,
              minimumPercentage: percentage("10"),
              sourceReferences: [pmfmeMay2022ModificationSource],
            },
            bankFinanceRequirement: {
              requirement: "REQUIRED" as const,
              selfFinanceAllowed: false,
              minimumAmount: monetaryAmount("0"),
              creditLinkedBenefit: true,
              sourceReferences: [pmfmeMay2022ModificationSource],
            },
          }),
    } satisfies FinancingProgramDefinition;
  });

export const pmfmeAifConvergenceRule: ProgramConvergenceRule = {
  convergenceRuleId: "PMFME.AIF.CONVERGENCE.2022-08-01",
  programA: { programId: programId("GOI.PMFME.INDIVIDUAL_UNIT") },
  programB: { programId: programId("GOI.AIF") },
  effectiveFrom: "2022-08-01",
  compatibilityStatus: "OFFICIAL_CONVERGENCE_SUPPORTED",
  allowedBenefitTypes: [
    "CAPITAL_SUBSIDY",
    "INTEREST_SUBVENTION",
    "CREDIT_GUARANTEE",
  ],
  sameCostItemPolicy: "ALLOW_EXPLICIT_CONVERGENCE",
  conditions: [
    "EACH_PROGRAM_ELIGIBILITY_MUST_BE_INDEPENDENTLY_SATISFIED",
    "AIF_PRIMARY_PROCESSING_SCOPE_APPLIES_TO_AIF_PORTION",
    "NO_AUTOMATIC_FUNDING_ALLOCATION",
  ],
  sourceReferences: [pmfmeAifConvergenceSource],
};

export function registerPmfmeProgramDefinitions(
  registry: FinancingProgramRegistry,
): CalculationResult<readonly FinancingProgramDefinition[]> {
  const results = pmfmeProgramDefinitions.map((definition) =>
    registry.registerProgramDefinition(definition),
  );
  const errors = results.flatMap((result) => (result.ok ? [] : result.errors));
  return errors.length > 0
    ? calculationFailure(...errors)
    : calculationSuccess(
        results.flatMap((result) => (result.ok ? [result.value] : [])),
      );
}
