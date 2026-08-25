import "dotenv/config";

import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { PgDocumentMetadataRepository } from "../repositories/pg-document-repository";
import { PgProjectRepository } from "../repositories/pg-project-repository";
import {
  PgQuotationExtractionRepository,
  PgQuotationLineMappingRepository,
  PgQuotationReviewRepository,
} from "../repositories/pg-quotation-repository";
import type { TestTransactionContext } from "./test-db";
import { closeTestPool, createTestTransaction } from "./test-db";

afterAll(async () => {
  await closeTestPool();
});

describe("Document & Quotation Persistence Integration Tests", () => {
  let ctx: TestTransactionContext;
  let projectRepo: PgProjectRepository;
  let docRepo: PgDocumentMetadataRepository;
  let extractionRepo: PgQuotationExtractionRepository;
  let reviewRepo: PgQuotationReviewRepository;
  let mappingRepo: PgQuotationLineMappingRepository;

  beforeEach(async () => {
    ctx = await createTestTransaction();
    projectRepo = new PgProjectRepository(ctx.db);
    docRepo = new PgDocumentMetadataRepository(ctx.db);
    extractionRepo = new PgQuotationExtractionRepository(ctx.db);
    reviewRepo = new PgQuotationReviewRepository(ctx.db);
    mappingRepo = new PgQuotationLineMappingRepository(ctx.db);
  });

  afterEach(async () => {
    await ctx.rollback();
  });

  it("persists document metadata with original filename, checksum, and status", async () => {
    const project = await projectRepo.create({
      name: "Machinery DPR Project",
      mode: "BANKABLE",
      industryActivity: "Manufacturing",
      stage: "PLANNING",
      status: "DRAFT",
      projectionPeriodYears: 5,
    });

    const doc = await docRepo.create({
      projectId: project.id,
      kind: "QUOTATION",
      displayName: "Feed Mill Quotation",
      originalFilename: "feed_mill_quote_v1.pdf",
      storageKey: `projects/${project.id}/feed_mill_quote_v1.pdf`,
      mimeType: "application/pdf",
      sizeBytes: "204800",
      checksumSha256:
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      status: "UPLOADED",
    });

    expect(doc.id).toBeDefined();
    expect(doc.projectId).toBe(project.id);
    expect(doc.originalFilename).toBe("feed_mill_quote_v1.pdf");
    expect(doc.status).toBe("UPLOADED");

    // Update document status
    const updated = await docRepo.update(doc.id, { status: "EXTRACTED" });
    expect(updated?.status).toBe("EXTRACTED");
  });

  it("persists quotation extractions, reviews, and line mappings with rollback isolation", async () => {
    const project = await projectRepo.create({
      name: "Poultry Processing Unit",
      mode: "SUBSIDY",
      industryActivity: "Agro-Processing",
      stage: "PLANNING",
      status: "DRAFT",
      projectionPeriodYears: 5,
    });

    const doc = await docRepo.create({
      projectId: project.id,
      kind: "QUOTATION",
      displayName: "Machinery Quote",
      originalFilename: "quote.pdf",
      storageKey: `projects/${project.id}/quote.pdf`,
      mimeType: "application/pdf",
      sizeBytes: "102400",
      status: "UPLOADED",
    });

    // 1. Create extraction
    const extraction = await extractionRepo.create({
      projectId: project.id,
      documentId: doc.id,
      extractionProvider: "MANUAL_ENTRY",
      status: "PROPOSED",
      rawData: { text: "Item 1: 500000" },
      normalizedData: {
        lineItems: [{ description: "Mixer", amount: "500000" }],
      },
      confidenceScore: "1.00",
    });

    expect(extraction.id).toBeDefined();
    expect(extraction.documentId).toBe(doc.id);

    // 2. Create review
    const review = await reviewRepo.create({
      projectId: project.id,
      extractionId: extraction.id,
      status: "APPROVED",
      reviewedData: {
        lineItems: [{ description: "Mixer (Approved)", amount: "500000" }],
      },
      reviewerNotes: "Verified with supplier GSTIN",
      approvedAt: new Date(),
    });

    expect(review.id).toBeDefined();
    expect(review.status).toBe("APPROVED");

    // 3. Create line mapping
    const mapping = await mappingRepo.create({
      projectId: project.id,
      documentId: doc.id,
      quotationLineId: "line-101",
      projectCostItemId: "cost-item-501",
      costCategory: "PLANT_AND_MACHINERY",
      sourceAmount: "500000.00",
      mappedAmount: "500000.00",
      mappingType: "NEW_ITEM",
      status: "ACTIVE",
    });

    expect(mapping.id).toBeDefined();
    expect(mapping.mappedAmount).toBe("500000.00");

    const projectMappings = await mappingRepo.findByProjectId(project.id);
    expect(projectMappings).toHaveLength(1);
    expect(projectMappings[0].quotationLineId).toBe("line-101");
  });
});
