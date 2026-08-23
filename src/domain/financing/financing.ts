import type { SourceReference } from "../shared/provenance";
import type { Identifier, MonetaryAmount } from "../shared/types";

export const financeSourceTypes = [
  "PROMOTER_CONTRIBUTION",
  "EQUITY",
  "UNSECURED_LOAN",
  "TERM_LOAN",
  "WORKING_CAPITAL_FINANCE",
  "GOVERNMENT_SUBSIDY_OR_GRANT",
  "OTHER_INSTITUTIONAL_FINANCE",
  "OTHER_CONTRIBUTION",
] as const;
export type FinanceSourceType = (typeof financeSourceTypes)[number];

export interface FinanceSource {
  readonly id: Identifier;
  readonly type: FinanceSourceType;
  readonly name: string;
  readonly amount: MonetaryAmount;
  readonly source?: SourceReference;
  readonly notes?: string;
}

export interface MeansOfFinance {
  readonly projectId: Identifier;
  readonly sources: readonly FinanceSource[];
  readonly statedTotal: MonetaryAmount;
  readonly projectCostReferenceId?: Identifier;
}
