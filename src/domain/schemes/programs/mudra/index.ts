import type { CalculationResult } from "../../../shared/calculation";
import { calculationSuccess } from "../../../shared/calculation";
import type { FinancingProgramDefinition } from "../../program";
import { programId } from "../../program";
import { FinancingProgramRegistry } from "../../registry";
import { pmmyCurrentDfsSource, pmmyProgramSources } from "./sources";
import { MUDRA_CURRENT_VERSION_ID } from "./version";

export * from "./categories";
export * from "./contracts";
export * from "./evaluation";
export * from "./rules";
export * from "./sources";
export * from "./version";

export const MUDRA_PROGRAM_FAMILY_ID = "GOI.PMMY";
export const MUDRA_PROGRAM_ID = programId("GOI.PMMY");

export const mudraProgramDefinition: FinancingProgramDefinition = {
  programId: MUDRA_PROGRAM_ID,
  versionId: MUDRA_CURRENT_VERSION_ID,
  displayName: "Pradhan Mantri MUDRA Yojana",
  description:
    "Collateral-free institutional credit program with category boundaries resolved by requested credit; it has no subsidy benefit.",
  programTypes: ["CREDIT_PROGRAM"],
  effectiveFrom: "2024-10-24",
  status: "ACTIVE",
  jurisdiction: { country: "IN" },
  sourceReferences: pmmyProgramSources,
  eligibility: {
    groupId: "PMMY.ELIGIBILITY",
    operator: "ALL",
    rules: [
      {
        ruleId: "PMMY.REQUESTED-CREDIT",
        name: "Requested credit amount is supplied",
        type: "REQUIRED",
        factPath: "financing.requestedCredit",
        sourceReferences: [pmmyCurrentDfsSource],
      },
      {
        ruleId: "PMMY.ACTIVITY",
        name: "Income-generating micro-enterprise activity is supplied",
        type: "REQUIRED",
        factPath: "activity.classification",
        sourceReferences: [pmmyCurrentDfsSource],
      },
    ],
  },
  costEligibilityRules: [],
  benefits: [],
  bankFinanceRequirement: {
    requirement: "REQUIRED",
    selfFinanceAllowed: false,
    creditLinkedBenefit: false,
    sourceReferences: [pmmyCurrentDfsSource],
  },
  nonFinancialBenefits: [
    "TERM_LOAN_AVAILABLE",
    "WORKING_CAPITAL_AVAILABLE",
    "COLLATERAL_NOT_REQUIRED_UNDER_PROGRAM",
  ],
};

export const mudraProgramDefinitions = [mudraProgramDefinition] as const;

export function registerMudraProgramDefinitions(
  registry: FinancingProgramRegistry,
): CalculationResult<readonly FinancingProgramDefinition[]> {
  const result = registry.registerProgramDefinition(mudraProgramDefinition);
  return result.ok ? calculationSuccess([result.value]) : result;
}
