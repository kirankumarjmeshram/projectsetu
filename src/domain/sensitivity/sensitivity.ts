import type { FinancialMetricResults } from "../financials/metrics";
import type {
  ProjectedCashFlow,
  ProjectedProfitAndLoss,
} from "../financials/statements";
import type { Identifier, Percentage } from "../shared/types";

export const adjustmentOperations = [
  "INCREASE_BY_PERCENTAGE",
  "DECREASE_BY_PERCENTAGE",
  "REPLACE_WITH_VALUE",
] as const;
export type AdjustmentOperation = (typeof adjustmentOperations)[number];

export interface ScenarioAdjustment {
  readonly id: Identifier;
  readonly targetPath: string;
  readonly operation: AdjustmentOperation;
  readonly value: string | Percentage;
  readonly notes?: string;
}

export interface SensitivityScenario {
  readonly id: Identifier;
  readonly projectId: Identifier;
  readonly name: string;
  readonly description?: string;
  readonly adjustments: readonly ScenarioAdjustment[];
}

export interface SensitivityResult {
  readonly scenarioId: Identifier;
  readonly profitAndLoss?: ProjectedProfitAndLoss;
  readonly cashFlow?: ProjectedCashFlow;
  readonly metrics?: FinancialMetricResults;
  readonly repaymentCapacity?: string;
}
