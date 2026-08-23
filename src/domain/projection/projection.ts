import type { Assumption } from "../shared/assumptions";
import type {
  DecimalValue,
  Identifier,
  MonetaryAmount,
  Percentage,
  ProjectionYear,
} from "../shared/types";

export interface RevenueProjectionYearOverride {
  readonly year: ProjectionYear;
  /** Replaces this year's quantity and becomes the next year's growth base. */
  readonly quantity?: Assumption<DecimalValue>;
  /** Replaces this year's unit price and becomes the next year's escalation base. */
  readonly unitPrice?: Assumption<MonetaryAmount>;
  readonly capacityUtilisation?: Assumption<Percentage>;
  /** Applied to the selected quantity to derive the following year's quantity. */
  readonly quantityGrowth?: Assumption<Percentage>;
  /** Applied to the selected unit price to derive the following year's price. */
  readonly sellingPriceEscalation?: Assumption<Percentage>;
}

export interface RevenueProjectionAssumption {
  readonly id: Identifier;
  readonly productOrServiceName: string;
  readonly unit: string;
  /** Year-one quantity before capacity utilisation. Zero is valid. */
  readonly quantity: Assumption<DecimalValue>;
  /** Year-one selling price per effective unit. Zero is valid. */
  readonly unitPrice: Assumption<MonetaryAmount>;
  /** Used for every year unless a year override is supplied. */
  readonly capacityUtilisation: Assumption<Percentage>;
  /** Default annual growth from the current year to the next; minimum -100%. */
  readonly quantityGrowth: Assumption<Percentage>;
  /** Default annual price change from the current year to the next; minimum -100%. */
  readonly sellingPriceEscalation: Assumption<Percentage>;
  readonly yearlyOverrides?: readonly RevenueProjectionYearOverride[];
  readonly notes?: string;
}

export const projectionOperatingExpenseCategories = [
  "RAW_MATERIALS",
  "WAGES",
  "SALARIES",
  "POWER_AND_ELECTRICITY",
  "FUEL",
  "REPAIRS_AND_MAINTENANCE",
  "RENT",
  "TRANSPORT",
  "ADMINISTRATIVE_EXPENSES",
  "MARKETING_AND_ADVERTISEMENT",
  "TELEPHONE_AND_INTERNET",
  "STATIONERY_AND_POSTAGE",
  "MISCELLANEOUS_OVERHEADS",
  "CUSTOM",
] as const;
export type ProjectionOperatingExpenseCategory =
  (typeof projectionOperatingExpenseCategories)[number];

export interface FixedOperatingExpenseYearOverride {
  readonly year: ProjectionYear;
  readonly annualAmount?: Assumption<MonetaryAmount>;
  /** Applied to the selected annual amount for the following year; minimum -100%. */
  readonly annualEscalation?: Assumption<Percentage>;
}

export interface PercentageOperatingExpenseYearOverride {
  readonly year: ProjectionYear;
  readonly percentageOfRevenue?: Assumption<Percentage>;
  /** Applied to the selected percentage rate for the following year; minimum -100%. */
  readonly annualEscalation?: Assumption<Percentage>;
}

interface BaseOperatingExpenseProjectionAssumption {
  readonly id: Identifier;
  readonly name: string;
  readonly category: ProjectionOperatingExpenseCategory;
  readonly notes?: string;
}

export interface FixedOperatingExpenseProjectionAssumption extends BaseOperatingExpenseProjectionAssumption {
  readonly calculationMethod: "FIXED_ANNUAL_AMOUNT";
  /** Year-one amount. Zero is valid. */
  readonly annualAmount: Assumption<MonetaryAmount>;
  readonly annualEscalation: Assumption<Percentage>;
  readonly yearlyOverrides?: readonly FixedOperatingExpenseYearOverride[];
}

export interface PercentageOperatingExpenseProjectionAssumption extends BaseOperatingExpenseProjectionAssumption {
  readonly calculationMethod: "PERCENTAGE_OF_REVENUE";
  /** Year-one rate expressed in percent points. */
  readonly percentageOfRevenue: Assumption<Percentage>;
  /** Escalates the percentage rate, not the already-calculated expense. */
  readonly annualEscalation: Assumption<Percentage>;
  readonly yearlyOverrides?: readonly PercentageOperatingExpenseYearOverride[];
}

export type OperatingExpenseProjectionAssumption =
  | FixedOperatingExpenseProjectionAssumption
  | PercentageOperatingExpenseProjectionAssumption;

export interface RevenueAndOperatingExpenseProjectionInput {
  readonly projectId: Identifier;
  readonly projectionPeriodYears: number;
  readonly revenueAssumptions: readonly RevenueProjectionAssumption[];
  readonly operatingExpenseAssumptions: readonly OperatingExpenseProjectionAssumption[];
}

export interface RevenueProjectionLine {
  readonly input: RevenueProjectionAssumption;
  readonly year: ProjectionYear;
  readonly quantity: DecimalValue;
  readonly capacityUtilisation: Percentage;
  readonly effectiveQuantity: DecimalValue;
  readonly unitPrice: MonetaryAmount;
  readonly quantityGrowthForNextYear: Percentage;
  readonly sellingPriceEscalationForNextYear: Percentage;
  readonly revenue: MonetaryAmount;
}

export interface RevenueProjectionYear {
  readonly year: ProjectionYear;
  readonly lines: readonly RevenueProjectionLine[];
  readonly totalRevenue: MonetaryAmount;
}

export interface RevenueProjection {
  readonly projectionPeriodYears: number;
  readonly years: readonly RevenueProjectionYear[];
}

export interface OperatingExpenseProjectionLine {
  readonly input: OperatingExpenseProjectionAssumption;
  readonly year: ProjectionYear;
  readonly calculationMethod: "FIXED_ANNUAL_AMOUNT" | "PERCENTAGE_OF_REVENUE";
  readonly annualAmount?: MonetaryAmount;
  readonly percentageOfRevenue?: Percentage;
  readonly annualEscalationForNextYear: Percentage;
  readonly amount: MonetaryAmount;
}

export interface OperatingExpenseProjectionYear {
  readonly year: ProjectionYear;
  readonly lines: readonly OperatingExpenseProjectionLine[];
  readonly rawMaterialAndVariableCosts: MonetaryAmount;
  readonly wages: MonetaryAmount;
  readonly salaries: MonetaryAmount;
  readonly utilities: MonetaryAmount;
  readonly repairsAndMaintenance: MonetaryAmount;
  readonly administrativeAndOtherOperatingCosts: MonetaryAmount;
  readonly totalOperatingExpenses: MonetaryAmount;
}

export interface OperatingExpenseProjection {
  readonly projectionPeriodYears: number;
  readonly years: readonly OperatingExpenseProjectionYear[];
}

export interface RevenueAndOperatingExpenseProjectionYear extends OperatingExpenseProjectionYear {
  readonly revenueLines: readonly RevenueProjectionLine[];
  readonly totalRevenue: MonetaryAmount;
  readonly operatingSurplusBeforeDepreciationInterestAndTax: MonetaryAmount;
}

export interface RevenueAndOperatingExpenseProjection {
  readonly projectId: Identifier;
  readonly projectionPeriodYears: number;
  readonly years: readonly RevenueAndOperatingExpenseProjectionYear[];
}
