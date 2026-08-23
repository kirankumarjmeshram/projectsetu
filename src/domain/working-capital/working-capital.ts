import type { Assumption } from "../shared/assumptions";
import type {
  Identifier,
  MonetaryAmount,
  Percentage,
  ProjectionYear,
} from "../shared/types";

export const currentAssetCategories = [
  "RAW_MATERIAL_INVENTORY",
  "WORK_IN_PROGRESS",
  "FINISHED_GOODS",
  "RECEIVABLES",
  "CASH_AND_BANK",
  "OTHER_CURRENT_ASSET",
] as const;
export type CurrentAssetCategory = (typeof currentAssetCategories)[number];

export const currentLiabilityCategories = [
  "SUPPLIER_CREDIT",
  "EXPENSES_PAYABLE",
  "OTHER_CURRENT_LIABILITY",
] as const;
export type CurrentLiabilityCategory =
  (typeof currentLiabilityCategories)[number];

export interface HoldingPeriodAssumptions {
  readonly inventoryDays?: Assumption<number>;
  readonly receivableDays?: Assumption<number>;
  readonly creditorDays?: Assumption<number>;
}

interface WorkingCapitalLineBase {
  readonly id: Identifier;
  readonly name: string;
  readonly annualBaseAmount?: Assumption<MonetaryAmount>;
  readonly holdingPeriodDays?: Assumption<number>;
}

export interface CurrentAssetLine extends WorkingCapitalLineBase {
  readonly side: "CURRENT_ASSET";
  readonly category: CurrentAssetCategory;
}

export interface CurrentLiabilityLine extends WorkingCapitalLineBase {
  readonly side: "CURRENT_LIABILITY";
  readonly category: CurrentLiabilityCategory;
}

export type WorkingCapitalLine = CurrentAssetLine | CurrentLiabilityLine;

export interface WorkingCapitalAssessmentInput {
  readonly projectId: Identifier;
  readonly projectionYear: ProjectionYear;
  readonly lines: readonly WorkingCapitalLine[];
  readonly holdingPeriods?: HoldingPeriodAssumptions;
  readonly borrowerMargin?: Assumption<Percentage>;
}

export interface WorkingCapitalAssessmentResult {
  readonly projectId: Identifier;
  readonly projectionYear: ProjectionYear;
  readonly totalCurrentAssets: MonetaryAmount;
  readonly totalCurrentLiabilities: MonetaryAmount;
  readonly workingCapitalGap: MonetaryAmount;
  readonly borrowerMargin: MonetaryAmount;
  readonly bankFinanceRequired: MonetaryAmount;
}
