"use server";

import { revalidatePath } from "next/cache";

import type { ProjectCostItemInput } from "@/lib/application/orchestrator/orchestrator-types";
import { getDocumentStorage } from "@/lib/documents/storage";
import { buildQuotationComparisonMatrix } from "@/lib/documents/quotation/comparison";
import type {
  NormalizedQuotation,
  NormalizedQuotationLine,
  QuotationLineMapping,
  QuotationSupplier,
} from "@/lib/documents/quotation/contracts";
import {
  buildManualQuotation,
  RuleBasedTextExtractionProvider,
} from "@/lib/documents/quotation/extractor";
import {
  mapQuotationLinesToProjectCost,
  type MapQuotationLineInstruction,
} from "@/lib/documents/quotation/mapping";
import { getDb } from "@/lib/persistence/db";
import {
  PgDocumentMetadataRepository,
  PgQuotationExtractionRepository,
  PgQuotationLineMappingRepository,
  PgQuotationReviewRepository,
} from "@/lib/persistence/repositories";

export async function createManualQuotationAction(input: {
  projectId: string;
  documentId?: string;
  supplier: QuotationSupplier;
  quotationNumber?: string;
  quotationDate?: string;
  validityDate?: string;
  lines: readonly Partial<NormalizedQuotationLine>[];
  freight?: string;
  installation?: string;
  otherCharges?: string;
  isInterstate?: boolean;
}) {
  try {
    const db = getDb();
    const docRepo = new PgDocumentMetadataRepository(db);
    const extractionRepo = new PgQuotationExtractionRepository(db);
    const reviewRepo = new PgQuotationReviewRepository(db);

    let docId = input.documentId;
    if (!docId) {
      const doc = await docRepo.create({
        projectId: input.projectId,
        kind: "QUOTATION",
        displayName:
          `${input.supplier.name} - Quotation ${input.quotationNumber || ""}`.trim(),
        status: "APPROVED",
      });
      docId = doc.id;
    }

    const normalized = buildManualQuotation({
      projectId: input.projectId,
      documentId: docId,
      supplier: input.supplier,
      quotationNumber: input.quotationNumber,
      quotationDate: input.quotationDate,
      validityDate: input.validityDate,
      lines: input.lines,
      freight: input.freight,
      installation: input.installation,
      otherCharges: input.otherCharges,
      isInterstate: input.isInterstate,
    });

    const extraction = await extractionRepo.create({
      projectId: input.projectId,
      documentId: docId,
      extractionProvider: "MANUAL_ENTRY",
      status: "APPROVED",
      rawData: { manualInput: true },
      normalizedData: normalized,
      confidenceScore: "1.00",
    });

    const review = await reviewRepo.create({
      projectId: input.projectId,
      extractionId: extraction.id,
      status: "APPROVED",
      reviewedData: normalized,
      reviewerNotes: "Direct user manual quotation entry",
      approvedAt: new Date(),
    });

    revalidatePath(`/projects/${input.projectId}`);
    return {
      success: true,
      quotation: normalized,
      extractionId: extraction.id,
      reviewId: review.id,
    };
  } catch (error) {
    console.error("Failed to create manual quotation:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function extractQuotationAction(documentId: string) {
  try {
    const db = getDb();
    const docRepo = new PgDocumentMetadataRepository(db);
    const extractionRepo = new PgQuotationExtractionRepository(db);

    const doc = await docRepo.findById(documentId);
    if (!doc || !doc.storageKey) {
      return {
        success: false,
        error: "Document not found or has no attached file.",
      };
    }

    const storage = getDocumentStorage();
    const fileResult = await storage.get(doc.storageKey);
    if (!fileResult) {
      return {
        success: false,
        error: "Physical file could not be read from storage.",
      };
    }

    const provider = new RuleBasedTextExtractionProvider();
    const extractionRes = await provider.extract(
      {
        ...doc,
        kind: doc.kind as import("@/lib/documents/contracts").DocumentKind,
        status:
          doc.status as import("@/lib/documents/contracts").DocumentStatus,
      },
      fileResult.content,
    );

    const persistedExtraction = await extractionRepo.create({
      projectId: doc.projectId,
      documentId: doc.id,
      extractionProvider: "RULE_BASED_LOCAL",
      status: extractionRes.status,
      rawData: extractionRes.rawData,
      normalizedData: extractionRes.normalizedQuotation || {},
      confidenceScore: extractionRes.confidenceScore || undefined,
    });

    await docRepo.update(doc.id, {
      status:
        extractionRes.status === "PROPOSED" ? "EXTRACTED" : "REVIEW_REQUIRED",
    });

    revalidatePath(`/projects/${doc.projectId}`);
    return {
      success: true,
      extraction: persistedExtraction,
      extractionResult: extractionRes,
    };
  } catch (error) {
    console.error(
      `Failed to extract quotation from document ${documentId}:`,
      error,
    );
    return { success: false, error: (error as Error).message };
  }
}

export async function saveQuotationReviewAction(
  projectId: string,
  extractionId: string,
  reviewedData: NormalizedQuotation,
  reviewerNotes?: string,
) {
  try {
    const db = getDb();
    const reviewRepo = new PgQuotationReviewRepository(db);

    const review = await reviewRepo.create({
      projectId,
      extractionId,
      status: "DRAFT",
      reviewedData,
      reviewerNotes: reviewerNotes || undefined,
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true, review };
  } catch (error) {
    console.error("Failed to save quotation review:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function approveQuotationAction(
  projectId: string,
  extractionId: string,
  approvedData: NormalizedQuotation,
  reviewerNotes?: string,
) {
  try {
    const db = getDb();
    const reviewRepo = new PgQuotationReviewRepository(db);
    const extractionRepo = new PgQuotationExtractionRepository(db);
    const docRepo = new PgDocumentMetadataRepository(db);

    const review = await reviewRepo.create({
      projectId,
      extractionId,
      status: "APPROVED",
      reviewedData: approvedData,
      reviewerNotes: reviewerNotes || undefined,
      approvedAt: new Date(),
    });

    await extractionRepo.updateStatus(extractionId, "APPROVED");
    await docRepo.update(approvedData.documentId, { status: "APPROVED" });

    revalidatePath(`/projects/${projectId}`);
    return { success: true, review };
  } catch (error) {
    console.error("Failed to approve quotation:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function mapQuotationLinesAction(
  quotation: NormalizedQuotation,
  instructions: readonly MapQuotationLineInstruction[],
  existingCostItems: readonly ProjectCostItemInput[],
) {
  try {
    const db = getDb();
    const mappingRepo = new PgQuotationLineMappingRepository(db);
    const existingMappings = await mappingRepo.findByProjectId(
      quotation.projectId,
    );

    const result = mapQuotationLinesToProjectCost(
      quotation,
      instructions,
      existingCostItems,
      existingMappings as unknown as readonly QuotationLineMapping[],
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        costItems: existingCostItems,
      };
    }

    // Persist new mappings to PostgreSQL
    for (const mapping of result.createdMappings) {
      await mappingRepo.create({
        projectId: mapping.projectId,
        documentId: mapping.documentId,
        quotationLineId: mapping.quotationLineId,
        projectCostItemId: mapping.projectCostItemId || undefined,
        costCategory: mapping.costCategory,
        sourceAmount: mapping.sourceAmount,
        mappedAmount: mapping.mappedAmount,
        mappingType: mapping.mappingType,
        status: mapping.status,
      });
    }

    revalidatePath(`/projects/${quotation.projectId}`);
    return {
      success: true,
      costItems: result.updatedCostItems,
      mappings: result.createdMappings,
    };
  } catch (error) {
    console.error("Failed to map quotation lines to project cost:", error);
    return {
      success: false,
      error: (error as Error).message,
      costItems: existingCostItems,
    };
  }
}

export async function getQuotationMappingsAction(projectId: string) {
  try {
    const db = getDb();
    const mappingRepo = new PgQuotationLineMappingRepository(db);
    const mappings = await mappingRepo.findByProjectId(projectId);
    return { success: true, mappings };
  } catch (error) {
    console.error(
      `Failed to fetch quotation mappings for project ${projectId}:`,
      error,
    );
    return { success: false, error: (error as Error).message, mappings: [] };
  }
}

export async function getQuotationDetailsAction(documentId: string) {
  try {
    const db = getDb();
    const extractionRepo = new PgQuotationExtractionRepository(db);
    const reviewRepo = new PgQuotationReviewRepository(db);

    const extractions = await extractionRepo.findByDocumentId(documentId);
    const latestExtraction = extractions[0] || null;

    let latestReview = null;
    if (latestExtraction) {
      const reviews = await reviewRepo.findByExtractionId(latestExtraction.id);
      latestReview = reviews[0] || null;
    }

    return {
      success: true,
      extraction: latestExtraction,
      review: latestReview,
    };
  } catch (error) {
    console.error(
      `Failed to get quotation details for document ${documentId}:`,
      error,
    );
    return { success: false, error: (error as Error).message };
  }
}

export async function compareQuotationsAction(
  projectId: string,
  documentIds: readonly string[],
) {
  try {
    const db = getDb();
    const extractionRepo = new PgQuotationExtractionRepository(db);
    const reviewRepo = new PgQuotationReviewRepository(db);

    const quotations: NormalizedQuotation[] = [];

    for (const docId of documentIds) {
      const extractions = await extractionRepo.findByDocumentId(docId);
      const ext = extractions[0];
      if (!ext) continue;

      const reviews = await reviewRepo.findByExtractionId(ext.id);
      const approvedReview =
        reviews.find((r) => r.status === "APPROVED") || reviews[0];

      if (approvedReview && approvedReview.reviewedData) {
        quotations.push(approvedReview.reviewedData as NormalizedQuotation);
      } else if (ext.normalizedData) {
        quotations.push(ext.normalizedData as NormalizedQuotation);
      }
    }

    const matrix = buildQuotationComparisonMatrix(quotations);
    return { success: true, matrix };
  } catch (error) {
    console.error(
      `Failed to compare quotations for project ${projectId}:`,
      error,
    );
    return { success: false, error: (error as Error).message };
  }
}
