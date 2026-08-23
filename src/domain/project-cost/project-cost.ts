import type { QuotationReference } from "../documents/document-reference";
import type { Assumption } from "../shared/assumptions";
import type { SourceReference } from "../shared/provenance";
import type { DecimalValue, Identifier, MonetaryAmount } from "../shared/types";

export const projectCostCategories = [
  "LAND",
  "LAND_DEVELOPMENT",
  "BUILDING",
  "CIVIL_WORKS",
  "PLANT_AND_MACHINERY",
  "EQUIPMENT",
  "ELECTRICAL_INSTALLATION",
  "FURNITURE",
  "VEHICLE",
  "COMPUTERS_AND_IT",
  "PRELIMINARY_EXPENSES",
  "PREOPERATIVE_EXPENSES",
  "CONTINGENCY",
  "MARGIN_FOR_WORKING_CAPITAL",
  "OTHER_FIXED_ASSET",
  "OTHER",
] as const;
export type ProjectCostCategory = (typeof projectCostCategories)[number];

export interface ProjectCostItem {
  readonly id: Identifier;
  readonly description: string;
  readonly category: ProjectCostCategory;
  readonly quantity?: DecimalValue;
  readonly unit?: string;
  readonly rate?: Assumption<MonetaryAmount>;
  readonly amount: Assumption<MonetaryAmount>;
  readonly tax?: Assumption<MonetaryAmount>;
  readonly freight?: Assumption<MonetaryAmount>;
  readonly installation?: Assumption<MonetaryAmount>;
  readonly supplierReferenceId?: Identifier;
  readonly quotation?: QuotationReference;
  readonly sourceReferences?: readonly SourceReference[];
  readonly notes?: string;
}

export interface ProjectCost {
  readonly projectId: Identifier;
  readonly items: readonly ProjectCostItem[];
  readonly statedTotal: MonetaryAmount;
}
