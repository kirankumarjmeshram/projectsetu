import { generateId } from "@/lib/persistence/id";
import type { DocumentMetadataRecord } from "../contracts";
import type {
  ExtractionResult,
  NormalizedQuotation,
  NormalizedQuotationLine,
  QuotationSupplier,
} from "./contracts";
import {
  calculateQuotationTotals,
  computeQuotationLineFinancials,
  normalizeIndianNumberString,
} from "./normalization";

export interface QuotationExtractionProvider {
  extract(
    document: DocumentMetadataRecord,
    content: Buffer,
  ): Promise<ExtractionResult>;
}

/**
 * Manual extraction builder when a user manually enters quotation details.
 */
export function buildManualQuotation(input: {
  projectId: string;
  documentId: string;
  supplier: QuotationSupplier;
  quotationNumber?: string;
  quotationDate?: string;
  validityDate?: string;
  lines: readonly Partial<NormalizedQuotationLine>[];
  freight?: string;
  installation?: string;
  otherCharges?: string;
  isInterstate?: boolean;
}): NormalizedQuotation {
  const normalizedLines: NormalizedQuotationLine[] = input.lines.map(
    (line, idx) => {
      const qty = normalizeIndianNumberString(line.quantity, "1");
      const rate = normalizeIndianNumberString(line.unitRate, "0");
      const discount = line.discount
        ? normalizeIndianNumberString(line.discount, "0")
        : "0";
      const gstRate = line.gstRate
        ? normalizeIndianNumberString(line.gstRate, "0")
        : null;

      const calc = computeQuotationLineFinancials({
        quantity: qty,
        unitRate: rate,
        discount,
        gstRate,
        isInterstate: input.isInterstate,
      });

      return {
        lineId: line.lineId || generateId(),
        description: line.description || `Item ${idx + 1}`,
        model: line.model || null,
        manufacturer: line.manufacturer || null,
        hsnSac: line.hsnSac || null,
        quantity: qty,
        unit: line.unit || "Nos",
        unitRate: rate,
        discount: discount !== "0" ? discount : null,
        taxableAmount: calc.taxableAmount,
        gstRate: gstRate,
        cgst: calc.cgst,
        sgst: calc.sgst,
        igst: calc.igst,
        otherTax: line.otherTax
          ? normalizeIndianNumberString(line.otherTax, "0")
          : null,
        lineTotal: calc.lineTotal,
      };
    },
  );

  const totals = calculateQuotationTotals(normalizedLines, {
    freight: input.freight,
    installation: input.installation,
    otherCharges: input.otherCharges,
  });

  return {
    quotationId: generateId(),
    documentId: input.documentId,
    projectId: input.projectId,
    supplier: input.supplier,
    quotationNumber: input.quotationNumber || null,
    quotationDate:
      input.quotationDate || new Date().toISOString().split("T")[0],
    validityDate: input.validityDate || null,
    currency: "INR",
    lineItems: normalizedLines,
    totals,
    metadata: {
      extractionProvider: "MANUAL_ENTRY",
      confidenceScore: "1.0",
      extractedAt: new Date().toISOString(),
    },
  };
}

/**
 * Robust rule-based text/PDF extractor that operates locally without external API dependencies.
 * Extracts structured quotation data if recognizable text lines are present.
 */
export class RuleBasedTextExtractionProvider implements QuotationExtractionProvider {
  async extract(
    document: DocumentMetadataRecord,
    content: Buffer,
  ): Promise<ExtractionResult> {
    const rawText = content.toString("utf-8");

    // Check if the content contains extractable text
    if (
      !rawText ||
      rawText.length < 10 ||
      (rawText.includes("%PDF") && !rawText.includes("Quotation"))
    ) {
      return {
        success: true,
        rawData: { textLength: content.length, mimeType: document.mimeType },
        status: "MANUAL_REVIEW_REQUIRED",
        confidenceScore: "0.0",
        issues: [
          "Document requires manual inspection. No plain OCR text layer found.",
        ],
      };
    }

    const issues: string[] = [];
    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    let supplierName = "Supplier / Vendor";
    let quotationNo: string | null = null;
    let quotationDate: string | null = null;
    const extractedLines: Partial<NormalizedQuotationLine>[] = [];

    // Parse simple key-value patterns
    for (const line of lines) {
      if (
        /Supplier|Vendor|Company|M\/s/i.test(line) &&
        supplierName === "Supplier / Vendor"
      ) {
        const parts = line.split(/[:\-]/);
        if (parts[1]) supplierName = parts[1].trim();
      }
      if (/Quotation\s*(?:No|Number|#)/i.test(line) && !quotationNo) {
        const parts = line.split(/[:\-#]/);
        if (parts[1]) quotationNo = parts[1].trim();
      }
      if (/Date/i.test(line) && !quotationDate) {
        const parts = line.split(/[:\-]/);
        if (parts[1]) quotationDate = parts[1].trim();
      }

      // Pattern: Item Description, Qty, Rate, (optional GST)
      // e.g. "Automatic Feed Mixer | 1 | 250000 | 18%"
      const pipeParts = line.split("|").map((p) => p.trim());
      if (pipeParts.length >= 3) {
        extractedLines.push({
          lineId: generateId(),
          description: pipeParts[0],
          quantity: normalizeIndianNumberString(pipeParts[1], "1"),
          unit: "Nos",
          unitRate: normalizeIndianNumberString(pipeParts[2], "0"),
          gstRate: pipeParts[3]
            ? normalizeIndianNumberString(pipeParts[3], "18")
            : "18",
        });
      }
    }

    if (extractedLines.length === 0) {
      return {
        success: true,
        rawData: { linesParsed: lines.length },
        status: "MANUAL_REVIEW_REQUIRED",
        confidenceScore: "0.4",
        issues: [
          "Could not identify structured line item table. Manual review required.",
        ],
      };
    }

    const normalized = buildManualQuotation({
      projectId: document.projectId,
      documentId: document.id,
      supplier: { name: supplierName },
      quotationNumber: quotationNo || undefined,
      quotationDate: quotationDate || undefined,
      lines: extractedLines,
    });

    return {
      success: true,
      rawData: { rawText },
      normalizedQuotation: normalized,
      status: "PROPOSED",
      confidenceScore: "0.85",
      issues,
    };
  }
}
