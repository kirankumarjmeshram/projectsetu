import type { Assumption } from "../shared/assumptions";
import type { Identifier, Percentage, ProjectionYear } from "../shared/types";

export interface YearlyPercentageAssumption {
  readonly year: ProjectionYear;
  readonly assumption: Assumption<Percentage>;
}

export interface TaxAssumption {
  readonly name: string;
  readonly rate?: Assumption<Percentage>;
  readonly basis?: Assumption<string>;
}

export const depreciationAssetCategories = [
  "BUILDING",
  "PLANT_AND_MACHINERY",
  "VEHICLES",
  "FURNITURE",
  "COMPUTERS",
  "OTHER_ASSET",
] as const;
export type DepreciationAssetCategory =
  (typeof depreciationAssetCategories)[number];

export const depreciationMethods = [
  "STRAIGHT_LINE",
  "WRITTEN_DOWN_VALUE",
  "OTHER",
] as const;
export type DepreciationMethod = (typeof depreciationMethods)[number];

export interface DepreciationAssumption {
  readonly assetReferenceId?: Identifier;
  readonly assetCategory: DepreciationAssetCategory;
  readonly method: Assumption<DepreciationMethod>;
  readonly annualRate?: Assumption<Percentage>;
  readonly authorityBasis: Assumption<string>;
}

export interface FinancialAssumptions {
  readonly projectId: Identifier;
  readonly projectionPeriodYears: ProjectionYear;
  readonly capacityUtilisation: readonly YearlyPercentageAssumption[];
  readonly sellingPriceEscalation?: Assumption<Percentage>;
  readonly rawMaterialInflation?: Assumption<Percentage>;
  readonly salaryEscalation?: Assumption<Percentage>;
  readonly expenseEscalation?: Assumption<Percentage>;
  readonly interestRates?: readonly Assumption<Percentage>[];
  readonly taxAssumptions?: readonly TaxAssumption[];
  readonly depreciationAssumptions?: readonly DepreciationAssumption[];
}
