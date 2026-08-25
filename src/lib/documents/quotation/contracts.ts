import type { ProjectCostCategory } from "@/domain/project-cost/project-cost";

export interface QuotationSupplier {
  readonly name: string;
  readonly address?: string | null;
  readonly phone?: string | null;
  readonly email?: string | null;
  readonly gstin?: string | null;
  readonly pan?: string | null;
}

export interface NormalizedQuotationLine {
  readonly lineId: string;
  readonly description: string;
  readonly model?: string | null;
  readonly manufacturer?: string | null;
  readonly hsnSac?: string | null;
  readonly quantity: string; // canonical decimal string
  readonly unit: string; // e.g. "Nos", "Sets", "Units"
  readonly unitRate: string; // canonical decimal string
  readonly discount?: string | null; // canonical decimal string
  readonly taxableAmount: string; // canonical decimal string
  readonly gstRate?: string | null; // e.g. "18.00"
  readonly cgst?: string | null;
  readonly sgst?: string | null;
  readonly igst?: string | null;
  readonly otherTax?: string | null;
  readonly lineTotal: string; // canonical decimal string
}

export interface QuotationTotals {
  readonly subtotal: string;
  readonly discount: string;
  readonly taxableAmount: string;
  readonly cgst: string;
  readonly sgst: string;
  readonly igst: string;
  readonly otherTax: string;
  readonly freight: string;
  readonly installation: string;
  readonly otherCharges: string;
  readonly grandTotal: string;
}

export interface CommercialTerms {
  readonly paymentTerms?: string | null;
  readonly deliveryTerms?: string | null;
  readonly warranty?: string | null;
  readonly installationTerms?: string | null;
}

export interface NormalizedQuotation {
  readonly quotationId: string;
  readonly documentId: string;
  readonly projectId: string;
  readonly supplier: QuotationSupplier;
  readonly quotationNumber?: string | null;
  readonly quotationDate?: string | null;
  readonly validityDate?: string | null;
  readonly currency: string; // "INR"
  readonly lineItems: readonly NormalizedQuotationLine[];
  readonly totals: QuotationTotals;
  readonly commercialTerms?: CommercialTerms;
  readonly metadata: {
    readonly extractionProvider: string;
    readonly confidenceScore: string;
    readonly extractedAt: string;
  };
}

export interface ExtractionResult {
  readonly success: boolean;
  readonly rawData: unknown;
  readonly normalizedQuotation?: NormalizedQuotation;
  readonly confidenceScore: string;
  readonly status: "PROPOSED" | "MANUAL_REVIEW_REQUIRED" | "FAILED";
  readonly issues: readonly string[];
}

export const MAPPING_TYPES = [
  "NEW_ITEM",
  "EXISTING_ITEM",
  "PARTIAL_ALLOCATION",
  "AGGREGATED",
] as const;

export type MappingType = (typeof MAPPING_TYPES)[number];

export interface QuotationLineMapping {
  readonly id: string;
  readonly projectId: string;
  readonly documentId: string;
  readonly quotationLineId: string;
  readonly projectCostItemId?: string | null;
  readonly costCategory: ProjectCostCategory;
  readonly sourceAmount: string;
  readonly mappedAmount: string;
  readonly mappingType: MappingType;
  readonly status: "ACTIVE" | "SUPERSEDED" | "REMOVED";
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
