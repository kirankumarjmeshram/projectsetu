import type { CalculationResult } from "../../shared/calculation";
import {
  calculationFailure,
  calculationSuccess,
} from "../../shared/calculation";
import type { FinancingProgramDefinition } from "../program";
import { FinancingProgramRegistry } from "../registry";
import {
  cmegpProgramDefinitions,
  registerCmegpProgramDefinitions,
} from "./cmegp";
import {
  mudraProgramDefinitions,
  registerMudraProgramDefinitions,
} from "./mudra";
import { nlmProgramDefinitions, registerNlmProgramDefinitions } from "./nlm";
import {
  pmfmeProgramDefinitions,
  registerPmfmeProgramDefinitions,
} from "./pmfme";
import {
  pmegpProgramDefinitions,
  registerPmegpProgramDefinitions,
} from "./pmegp";

export * from "./cmegp";
export * from "./mudra";
export * from "./nlm";
export * from "./pmfme";
export * from "./pmegp";

export const liveProgramDefinitions: readonly FinancingProgramDefinition[] = [
  ...pmegpProgramDefinitions,
  ...nlmProgramDefinitions,
  ...pmfmeProgramDefinitions,
  ...mudraProgramDefinitions,
  ...cmegpProgramDefinitions,
];

export function registerLiveProgramDefinitions(
  registry: FinancingProgramRegistry,
): CalculationResult<readonly FinancingProgramDefinition[]> {
  const results = [
    registerPmegpProgramDefinitions(registry),
    registerNlmProgramDefinitions(registry),
    registerPmfmeProgramDefinitions(registry),
    registerMudraProgramDefinitions(registry),
    registerCmegpProgramDefinitions(registry),
  ];
  const errors = results.flatMap((result) => (result.ok ? [] : result.errors));
  return errors.length > 0
    ? calculationFailure(...errors)
    : calculationSuccess(
        results.flatMap((result) => (result.ok ? result.value : [])),
      );
}

export function createLiveProgramRegistry(): FinancingProgramRegistry {
  const registry = new FinancingProgramRegistry();
  const result = registerLiveProgramDefinitions(registry);
  if (!result.ok) {
    throw new Error(result.errors.map((error) => error.code).join(", "));
  }
  return registry;
}
