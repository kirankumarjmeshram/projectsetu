import type { CalculationResult } from "../../../shared/calculation";
import {
  calculationFailure,
  calculationSuccess,
} from "../../../shared/calculation";
import type { FinancingProgramDefinition } from "../../program";
import { FinancingProgramRegistry } from "../../registry";
import {
  PMEGP_NEW_ENTERPRISE_PROGRAM_ID,
  PMEGP_NEW_ENTERPRISE_VERSION_ID,
  PMEGP_REVISED_GUIDELINE_VERSION_ID,
  pmegpNewEnterpriseDefinition,
} from "./new-enterprise";
import {
  PMEGP_UPGRADATION_PROGRAM_ID,
  PMEGP_UPGRADATION_VERSION_ID,
  pmegpUpgradationDefinition,
} from "./upgradation";

export * from "./activities";
export * from "./categories";
export * from "./contracts";
export * from "./costs";
export * from "./evaluation";
export * from "./new-enterprise";
export * from "./rules";
export * from "./sources";
export * from "./upgradation";

export const PMEGP_PROGRAM_FAMILY_ID = "GOI.PMEGP";

export const pmegpProgramDefinitions: readonly FinancingProgramDefinition[] = [
  pmegpNewEnterpriseDefinition,
  pmegpUpgradationDefinition,
];

export function registerPmegpProgramDefinitions(
  registry: FinancingProgramRegistry,
): CalculationResult<readonly FinancingProgramDefinition[]> {
  const registered = pmegpProgramDefinitions.map((definition) =>
    registry.registerProgramDefinition(definition),
  );
  const errors = registered.flatMap((result) =>
    result.ok ? [] : result.errors,
  );
  return errors.length > 0
    ? calculationFailure(...errors)
    : calculationSuccess(
        registered.flatMap((result) => (result.ok ? [result.value] : [])),
      );
}

export function createPmegpProgramRegistry(): FinancingProgramRegistry {
  const registry = new FinancingProgramRegistry();
  const result = registerPmegpProgramDefinitions(registry);
  if (!result.ok) {
    throw new Error(result.errors.map((error) => error.code).join(", "));
  }
  return registry;
}

export const pmegpProgramIdentity = {
  familyId: PMEGP_PROGRAM_FAMILY_ID,
  currentGuidelineVersionId: PMEGP_REVISED_GUIDELINE_VERSION_ID,
  newEnterpriseProgramId: PMEGP_NEW_ENTERPRISE_PROGRAM_ID,
  newEnterpriseVersionId: PMEGP_NEW_ENTERPRISE_VERSION_ID,
  upgradationProgramId: PMEGP_UPGRADATION_PROGRAM_ID,
  upgradationVersionId: PMEGP_UPGRADATION_VERSION_ID,
} as const;
