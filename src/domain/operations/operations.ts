import type { Assumption } from "../shared/assumptions";
import type {
  Identifier,
  MonetaryAmount,
  Percentage,
  ProjectionYear,
} from "../shared/types";

export interface YearlyAssumption<TValue> {
  readonly year: ProjectionYear;
  readonly assumption: Assumption<TValue>;
}

export interface InstalledCapacity {
  readonly quantity: string;
  readonly unit: string;
  readonly period?: string;
}

export interface OperatingCapacityPlan {
  readonly installedCapacity: InstalledCapacity;
  readonly workingDaysPerYear: Assumption<number>;
  readonly shiftsPerDay: Assumption<number>;
  readonly productionCycle?: Assumption<string>;
  readonly capacityUtilisation: readonly YearlyAssumption<Percentage>[];
}

export interface ProductOrService {
  readonly id: Identifier;
  readonly name: string;
  readonly description?: string;
  readonly unit: string;
  readonly installedCapacity?: InstalledCapacity;
  readonly sellingPrice: readonly YearlyAssumption<MonetaryAmount>[];
  readonly productionQuantity?: readonly YearlyAssumption<string>[];
  readonly salesQuantity?: readonly YearlyAssumption<string>[];
}

export const operatingInputCategories = [
  "RAW_MATERIAL",
  "PACKAGING",
  "CONSUMABLE",
  "FEED_OR_FODDER",
  "FUEL",
  "OTHER",
] as const;
export type OperatingInputCategory = (typeof operatingInputCategories)[number];

export interface OperatingInput {
  readonly id: Identifier;
  readonly name: string;
  readonly category: OperatingInputCategory;
  readonly quantity?: Assumption<string>;
  readonly unit: string;
  readonly purchaseRate?: Assumption<MonetaryAmount>;
  readonly supplierReferenceId?: Identifier;
  readonly transportCost?: Assumption<MonetaryAmount>;
  readonly storagePeriodDays?: Assumption<number>;
  readonly annualPriceEscalation?: Assumption<Percentage>;
}

export const manpowerCategories = [
  "MANAGEMENT",
  "SKILLED",
  "SEMI_SKILLED",
  "UNSKILLED",
  "ADMINISTRATIVE",
  "SALES",
  "OTHER",
] as const;
export type ManpowerCategory = (typeof manpowerCategories)[number];

export interface ManpowerRequirement {
  readonly id: Identifier;
  readonly category: ManpowerCategory;
  readonly role: string;
  readonly headcount: Assumption<number>;
  readonly salaryOrWage: Assumption<MonetaryAmount>;
  readonly payPeriod: string;
  readonly statutoryEmployeeCost?: Assumption<Percentage>;
  readonly annualEscalation?: Assumption<Percentage>;
}

export const expenseBehaviours = ["VARIABLE", "FIXED"] as const;
export type ExpenseBehaviour = (typeof expenseBehaviours)[number];

export const knownOperatingExpenseCategories = [
  "RAW_MATERIALS",
  "PACKAGING",
  "CONSUMABLES",
  "ELECTRICITY",
  "FUEL",
  "PRODUCTION_LABOUR",
  "FREIGHT",
  "COMMISSION",
  "SALARY",
  "RENT",
  "ADMINISTRATION",
  "REPAIRS",
  "INSURANCE",
  "TELEPHONE_AND_INTERNET",
  "PROFESSIONAL_FEES",
  "MARKETING",
  "SECURITY",
  "MISCELLANEOUS",
] as const;
export type KnownOperatingExpenseCategory =
  (typeof knownOperatingExpenseCategories)[number];
export type OperatingExpenseCategory =
  KnownOperatingExpenseCategory | (string & {});

export interface OperatingExpense {
  readonly id: Identifier;
  readonly name: string;
  readonly behaviour: ExpenseBehaviour;
  readonly category: OperatingExpenseCategory;
  readonly yearlyAmounts: readonly YearlyAssumption<MonetaryAmount>[];
}
