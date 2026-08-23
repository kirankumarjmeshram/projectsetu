import type { Assumption } from "../shared/assumptions";
import type {
  Identifier,
  MonetaryAmount,
  Percentage,
  ProjectionYear,
} from "../shared/types";

export const depreciationMethods = [
  "STRAIGHT_LINE",
  "WRITTEN_DOWN_VALUE",
] as const;
export type DepreciationMethod = (typeof depreciationMethods)[number];

export const depreciationAssetCategories = [
  "BUILDING",
  "PLANT_AND_MACHINERY",
  "EQUIPMENT",
  "FURNITURE_AND_FIXTURES",
  "VEHICLE",
  "ELECTRICAL_INSTALLATION",
  "OFFICE_EQUIPMENT",
  "COMPUTER",
  "OTHER",
] as const;
export type DepreciationAssetCategory =
  (typeof depreciationAssetCategories)[number];

export interface DepreciationAssetAddition {
  /** Unique within the parent asset; distinct additions may share a year. */
  readonly id: Identifier;
  readonly year: ProjectionYear;
  readonly cost: Assumption<MonetaryAmount>;
  /** Explicit residual floor attributable to this addition. */
  readonly residualValue: Assumption<MonetaryAmount>;
  readonly notes?: string;
}

interface BaseDepreciableAsset {
  readonly id: Identifier;
  readonly name: string;
  readonly category: DepreciationAssetCategory;
  readonly originalCost: Assumption<MonetaryAmount>;
  readonly residualValue: Assumption<MonetaryAmount>;
  readonly depreciationStartYear: ProjectionYear;
  readonly additions?: readonly DepreciationAssetAddition[];
  readonly notes?: string;
}

export interface StraightLineDepreciableAsset extends BaseDepreciableAsset {
  readonly method: "STRAIGHT_LINE";
  readonly usefulLifeYears: Assumption<number>;
  readonly depreciationRate?: never;
}

export interface WrittenDownValueDepreciableAsset extends BaseDepreciableAsset {
  readonly method: "WRITTEN_DOWN_VALUE";
  readonly depreciationRate: Assumption<Percentage>;
  readonly usefulLifeYears?: never;
}

export type DepreciableAsset =
  StraightLineDepreciableAsset | WrittenDownValueDepreciableAsset;

export interface DepreciationProjectionInput {
  readonly projectId: Identifier;
  readonly projectionPeriodYears: number;
  readonly assets: readonly DepreciableAsset[];
}

export interface AssetDepreciationYear {
  readonly year: ProjectionYear;
  readonly assetId: Identifier;
  readonly assetName: string;
  readonly assetCategory: DepreciationAssetCategory;
  readonly method: DepreciationMethod;
  readonly openingGrossValue: MonetaryAmount;
  readonly additions: MonetaryAmount;
  readonly closingGrossValue: MonetaryAmount;
  readonly openingCarryingValue: MonetaryAmount;
  /** Opening carrying value plus additions available for the full year. */
  readonly depreciationBase: MonetaryAmount;
  readonly depreciation: MonetaryAmount;
  readonly accumulatedDepreciation: MonetaryAmount;
  readonly closingCarryingValue: MonetaryAmount;
  /** Cumulative residual floor, including additions available by this year. */
  readonly residualValue: MonetaryAmount;
}

export interface AssetDepreciationSchedule {
  readonly asset: DepreciableAsset;
  readonly years: readonly AssetDepreciationYear[];
}

export interface AggregateDepreciationYear {
  readonly year: ProjectionYear;
  readonly openingGrossFixedAssets: MonetaryAmount;
  readonly additions: MonetaryAmount;
  readonly depreciation: MonetaryAmount;
  readonly accumulatedDepreciation: MonetaryAmount;
  readonly closingGrossFixedAssets: MonetaryAmount;
  readonly closingNetCarryingValue: MonetaryAmount;
}

export interface DepreciationSchedule {
  readonly projectId: Identifier;
  readonly projectionPeriodYears: number;
  readonly assetSchedules: readonly AssetDepreciationSchedule[];
  readonly yearlySummaries: readonly AggregateDepreciationYear[];
}
