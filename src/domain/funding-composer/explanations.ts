import type { FundingConflict, FundingExplanation } from "./contracts";

export function explanationsFromConflicts(
  conflicts: readonly FundingConflict[],
): readonly FundingExplanation[] {
  return conflicts.map((conflict) => ({
    code: conflict.messageCode,
    severity: "BLOCKING",
    programIds: conflict.programIds,
    costItemIds: conflict.costItemIds ?? [],
    sourceRuleIds: conflict.sourceRuleIds,
    sourceReferences: conflict.sourceReferences,
    parameters: conflict.parameters,
  }));
}
