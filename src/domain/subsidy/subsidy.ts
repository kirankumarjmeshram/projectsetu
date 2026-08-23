import type { SourceReference } from "../shared/provenance";
import type { Identifier, MonetaryAmount, Percentage } from "../shared/types";

export const costEligibilityStatuses = [
  "ELIGIBLE",
  "INELIGIBLE",
  "PARTIALLY_ELIGIBLE",
  "CONDITIONALLY_ELIGIBLE",
] as const;
export type CostEligibilityStatus = (typeof costEligibilityStatuses)[number];

export interface CostEligibility {
  readonly projectCostItemId: Identifier;
  readonly schemeVersionId: Identifier;
  readonly status: CostEligibilityStatus;
  readonly eligibleAmount?: MonetaryAmount;
  readonly conditions?: readonly string[];
  readonly sourceReferences: readonly SourceReference[];
  readonly notes?: string;
}

export interface ProjectCostEligibilitySummary {
  readonly projectId: Identifier;
  readonly schemeVersionId: Identifier;
  readonly totalProjectCost: MonetaryAmount;
  readonly eligibleProjectCost: MonetaryAmount;
  readonly ineligibleProjectCost: MonetaryAmount;
  readonly classifications: readonly CostEligibility[];
}

export interface SubsidyReleaseTerms {
  readonly mechanism: string;
  readonly lockInPeriod?: string;
  readonly conditions?: readonly string[];
}

export interface SubsidyAssessment {
  readonly projectId: Identifier;
  readonly schemeVersionId: Identifier;
  readonly costEligibility: ProjectCostEligibilitySummary;
  readonly subsidyRate?: Percentage;
  readonly maximumSubsidyCeiling?: MonetaryAmount;
  readonly calculatedSubsidy?: MonetaryAmount;
  readonly admissibleSubsidy?: MonetaryAmount;
  readonly beneficiaryContribution?: MonetaryAmount;
  readonly bankFinance?: MonetaryAmount;
  readonly releaseTerms?: SubsidyReleaseTerms;
  readonly conditions?: readonly string[];
  readonly sourceReferences: readonly SourceReference[];
}
