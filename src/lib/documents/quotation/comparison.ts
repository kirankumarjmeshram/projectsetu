import type { NormalizedQuotation } from "./contracts";

export interface QuotationComparisonSummary {
  readonly quotationId: string;
  readonly supplierName: string;
  readonly quotationNumber?: string | null;
  readonly quotationDate?: string | null;
  readonly subtotal: string;
  readonly taxableAmount: string;
  readonly totalTax: string;
  readonly freight: string;
  readonly installation: string;
  readonly grandTotal: string;
  readonly paymentTerms?: string | null;
  readonly deliveryTerms?: string | null;
  readonly warranty?: string | null;
  readonly itemCount: number;
}

export interface QuotationComparisonMatrix {
  readonly summaries: readonly QuotationComparisonSummary[];
  readonly rawQuotations: readonly NormalizedQuotation[];
}

/**
 * Builds a structured comparison matrix between 2 or more supplier quotations.
 * Allows transparent comparison of base costs, taxes, freight, and terms without auto-selecting.
 */
export function buildQuotationComparisonMatrix(
  quotations: readonly NormalizedQuotation[],
): QuotationComparisonMatrix {
  const summaries: QuotationComparisonSummary[] = quotations.map((q) => {
    const totalTax = (
      BigInt(0) +
      BigInt(q.totals.cgst.split(".")[0] || "0") +
      BigInt(q.totals.sgst.split(".")[0] || "0") +
      BigInt(q.totals.igst.split(".")[0] || "0")
    ).toString();

    return {
      quotationId: q.quotationId,
      supplierName: q.supplier.name,
      quotationNumber: q.quotationNumber,
      quotationDate: q.quotationDate,
      subtotal: q.totals.subtotal,
      taxableAmount: q.totals.taxableAmount,
      totalTax,
      freight: q.totals.freight,
      installation: q.totals.installation,
      grandTotal: q.totals.grandTotal,
      paymentTerms: q.commercialTerms?.paymentTerms,
      deliveryTerms: q.commercialTerms?.deliveryTerms,
      warranty: q.commercialTerms?.warranty,
      itemCount: q.lineItems.length,
    };
  });

  return {
    summaries,
    rawQuotations: quotations,
  };
}
