import type { CalculationResult } from "../../../shared/calculation";
import { calculationSuccess } from "../../../shared/calculation";
import { decimalValue, percentage } from "../../../shared/decimal";
import type { FinancingProgramDefinition } from "../../program";
import { programId } from "../../program";
import { FinancingProgramRegistry } from "../../registry";
import {
  cmegpMay2025AmendmentSource,
  cmegpOriginalGrSource,
  cmegpProgramSources,
} from "./sources";
import { CMEGP_CURRENT_VERSION_ID } from "./version";

export * from "./activities";
export * from "./contracts";
export * from "./evaluation";
export * from "./rules";
export * from "./sources";
export * from "./version";

export const CMEGP_PROGRAM_FAMILY_ID = "MH.CMEGP";
export const CMEGP_PROGRAM_ID = programId("MH.CMEGP.NEW_ENTERPRISE");

export const cmegpProgramDefinition: FinancingProgramDefinition = {
  programId: CMEGP_PROGRAM_ID,
  versionId: CMEGP_CURRENT_VERSION_ID,
  displayName: "Maharashtra CMEGP - New Enterprise",
  description:
    "Credit-linked Maharashtra margin-money program under the amendments effective 01-04-2025.",
  programTypes: [
    "CREDIT_PROGRAM",
    "MARGIN_MONEY_SUBSIDY",
    "COMPOSITE_ASSISTANCE",
  ],
  effectiveFrom: "2025-04-01",
  status: "ACTIVE",
  jurisdiction: { country: "IN", states: ["MAHARASHTRA"] },
  sourceReferences: cmegpProgramSources,
  eligibility: {
    groupId: "CMEGP.NEW.ELIGIBILITY",
    operator: "ALL",
    rules: [
      {
        ruleId: "CMEGP.NEW.JURISDICTION",
        name: "Project is located in Maharashtra",
        type: "LOCATION",
        factPath: "location.state",
        expectedValues: ["MAHARASHTRA"],
        sourceReferences: [cmegpMay2025AmendmentSource],
      },
      {
        ruleId: "CMEGP.NEW.ENTITY",
        name: "Eligible CMEGP ownership entity",
        type: "ENTITY_TYPE",
        factPath: "applicant.entityType",
        expectedValues: ["INDIVIDUAL", "PARTNERSHIP", "APPROVED_SHG"],
        sourceReferences: [cmegpOriginalGrSource],
      },
    ],
  },
  costEligibilityRules: [
    {
      ruleId: "CMEGP.NEW.UNVERIFIED-COSTS",
      type: "MANUAL_REVIEW",
      sourceReferences: [cmegpMay2025AmendmentSource],
    },
  ],
  benefits: [
    {
      benefitId: "CMEGP.NEW.MARGIN-MONEY",
      name: "Calculated CMEGP margin money",
      kind: "MARGIN_MONEY",
      basis: "CUSTOM",
      calculation: "CUSTOM",
      handlerId: "CMEGP.NEW.RATE-CAP-MATRIX",
      creditLinked: true,
      release: {
        mechanism: "BACK_ENDED",
        conditions: [
          "HELD_AGAINST_LOAN_ACCOUNT_FOR_THREE_YEARS",
          "PHYSICAL_VERIFICATION_AFTER_TWO_YEARS",
          "DLTFC_APPROVAL_BEFORE_ADJUSTMENT_AFTER_THREE_YEARS",
        ],
      },
      sourceReferences: [cmegpMay2025AmendmentSource],
    },
  ],
  contributionRequirement: {
    basis: "TOTAL_PROJECT_COST",
    minimumPercentage: percentage("5"),
    sourceReferences: [cmegpOriginalGrSource, cmegpMay2025AmendmentSource],
  },
  bankFinanceRequirement: {
    requirement: "REQUIRED",
    selfFinanceAllowed: false,
    creditLinkedBenefit: true,
    sourceReferences: [cmegpOriginalGrSource],
  },
  nonFinancialBenefits: [
    "ENTREPRENEURSHIP_DEVELOPMENT_TRAINING",
    `LOCK_IN_YEARS_${decimalValue("3")}`,
  ],
  handlerIds: ["CMEGP.NEW.RATE-CAP-MATRIX"],
};

export const cmegpProgramDefinitions = [cmegpProgramDefinition] as const;

export function registerCmegpProgramDefinitions(
  registry: FinancingProgramRegistry,
): CalculationResult<readonly FinancingProgramDefinition[]> {
  const result = registry.registerProgramDefinition(cmegpProgramDefinition);
  return result.ok ? calculationSuccess([result.value]) : result;
}
