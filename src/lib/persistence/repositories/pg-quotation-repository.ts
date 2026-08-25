import { desc, eq } from "drizzle-orm";
import { generateId } from "../id";
import { quotationExtractions } from "../schema/quotation-extractions";
import { quotationLineMappings } from "../schema/quotation-line-mappings";
import { quotationReviews } from "../schema/quotation-reviews";
import type { DrizzleDatabase } from "../db";
import type {
  CreateQuotationExtractionInput,
  CreateQuotationLineMappingInput,
  CreateQuotationReviewInput,
  PersistedQuotationExtraction,
  PersistedQuotationLineMapping,
  PersistedQuotationReview,
  QuotationExtractionRepository,
  QuotationLineMappingRepository,
  QuotationReviewRepository,
} from "./types";

export class PgQuotationExtractionRepository implements QuotationExtractionRepository {
  constructor(private readonly db: DrizzleDatabase) {}

  async create(
    input: CreateQuotationExtractionInput,
  ): Promise<PersistedQuotationExtraction> {
    const id = input.id ?? generateId();
    const now = new Date();

    const [row] = await this.db
      .insert(quotationExtractions)
      .values({
        id,
        projectId: input.projectId,
        documentId: input.documentId,
        status: input.status ?? "PROPOSED",
        extractionProvider: input.extractionProvider,
        rawData: input.rawData,
        normalizedData: input.normalizedData,
        confidenceScore: input.confidenceScore ?? "1.00",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return this.toPersisted(row);
  }

  async findById(id: string): Promise<PersistedQuotationExtraction | null> {
    const rows = await this.db
      .select()
      .from(quotationExtractions)
      .where(eq(quotationExtractions.id, id))
      .limit(1);

    return rows.length > 0 ? this.toPersisted(rows[0]) : null;
  }

  async findByDocumentId(
    documentId: string,
  ): Promise<readonly PersistedQuotationExtraction[]> {
    const rows = await this.db
      .select()
      .from(quotationExtractions)
      .where(eq(quotationExtractions.documentId, documentId))
      .orderBy(desc(quotationExtractions.createdAt));

    return rows.map((r) => this.toPersisted(r));
  }

  async findByProjectId(
    projectId: string,
  ): Promise<readonly PersistedQuotationExtraction[]> {
    const rows = await this.db
      .select()
      .from(quotationExtractions)
      .where(eq(quotationExtractions.projectId, projectId))
      .orderBy(desc(quotationExtractions.createdAt));

    return rows.map((r) => this.toPersisted(r));
  }

  async updateStatus(
    id: string,
    status: string,
  ): Promise<PersistedQuotationExtraction | null> {
    const rows = await this.db
      .update(quotationExtractions)
      .set({ status, updatedAt: new Date() })
      .where(eq(quotationExtractions.id, id))
      .returning();

    return rows.length > 0 ? this.toPersisted(rows[0]) : null;
  }

  private toPersisted(
    row: typeof quotationExtractions.$inferSelect,
  ): PersistedQuotationExtraction {
    return {
      id: row.id,
      projectId: row.projectId,
      documentId: row.documentId,
      status: row.status,
      extractionProvider: row.extractionProvider,
      rawData: row.rawData,
      normalizedData: row.normalizedData,
      confidenceScore: row.confidenceScore,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export class PgQuotationReviewRepository implements QuotationReviewRepository {
  constructor(private readonly db: DrizzleDatabase) {}

  async create(
    input: CreateQuotationReviewInput,
  ): Promise<PersistedQuotationReview> {
    const id = input.id ?? generateId();
    const now = new Date();

    const [row] = await this.db
      .insert(quotationReviews)
      .values({
        id,
        projectId: input.projectId,
        extractionId: input.extractionId,
        status: input.status ?? "DRAFT",
        reviewedData: input.reviewedData,
        reviewerNotes: input.reviewerNotes ?? null,
        approvedAt: input.approvedAt ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return this.toPersisted(row);
  }

  async findById(id: string): Promise<PersistedQuotationReview | null> {
    const rows = await this.db
      .select()
      .from(quotationReviews)
      .where(eq(quotationReviews.id, id))
      .limit(1);

    return rows.length > 0 ? this.toPersisted(rows[0]) : null;
  }

  async findByExtractionId(
    extractionId: string,
  ): Promise<readonly PersistedQuotationReview[]> {
    const rows = await this.db
      .select()
      .from(quotationReviews)
      .where(eq(quotationReviews.extractionId, extractionId))
      .orderBy(desc(quotationReviews.createdAt));

    return rows.map((r) => this.toPersisted(r));
  }

  async findByProjectId(
    projectId: string,
  ): Promise<readonly PersistedQuotationReview[]> {
    const rows = await this.db
      .select()
      .from(quotationReviews)
      .where(eq(quotationReviews.projectId, projectId))
      .orderBy(desc(quotationReviews.createdAt));

    return rows.map((r) => this.toPersisted(r));
  }

  async update(
    id: string,
    input: Partial<CreateQuotationReviewInput>,
  ): Promise<PersistedQuotationReview | null> {
    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.status !== undefined) updateValues.status = input.status;
    if (input.reviewedData !== undefined)
      updateValues.reviewedData = input.reviewedData;
    if (input.reviewerNotes !== undefined)
      updateValues.reviewerNotes = input.reviewerNotes;
    if (input.approvedAt !== undefined)
      updateValues.approvedAt = input.approvedAt;

    const rows = await this.db
      .update(quotationReviews)
      .set(updateValues)
      .where(eq(quotationReviews.id, id))
      .returning();

    return rows.length > 0 ? this.toPersisted(rows[0]) : null;
  }

  private toPersisted(
    row: typeof quotationReviews.$inferSelect,
  ): PersistedQuotationReview {
    return {
      id: row.id,
      projectId: row.projectId,
      extractionId: row.extractionId,
      status: row.status,
      reviewedData: row.reviewedData,
      reviewerNotes: row.reviewerNotes,
      approvedAt: row.approvedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export class PgQuotationLineMappingRepository implements QuotationLineMappingRepository {
  constructor(private readonly db: DrizzleDatabase) {}

  async create(
    input: CreateQuotationLineMappingInput,
  ): Promise<PersistedQuotationLineMapping> {
    const id = input.id ?? generateId();
    const now = new Date();

    const [row] = await this.db
      .insert(quotationLineMappings)
      .values({
        id,
        projectId: input.projectId,
        documentId: input.documentId,
        quotationLineId: input.quotationLineId,
        projectCostItemId: input.projectCostItemId ?? null,
        costCategory: input.costCategory,
        sourceAmount: input.sourceAmount,
        mappedAmount: input.mappedAmount,
        mappingType: input.mappingType ?? "NEW_ITEM",
        status: input.status ?? "ACTIVE",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return this.toPersisted(row);
  }

  async findById(id: string): Promise<PersistedQuotationLineMapping | null> {
    const rows = await this.db
      .select()
      .from(quotationLineMappings)
      .where(eq(quotationLineMappings.id, id))
      .limit(1);

    return rows.length > 0 ? this.toPersisted(rows[0]) : null;
  }

  async findByProjectId(
    projectId: string,
  ): Promise<readonly PersistedQuotationLineMapping[]> {
    const rows = await this.db
      .select()
      .from(quotationLineMappings)
      .where(eq(quotationLineMappings.projectId, projectId))
      .orderBy(desc(quotationLineMappings.createdAt));

    return rows.map((r) => this.toPersisted(r));
  }

  async findByDocumentId(
    documentId: string,
  ): Promise<readonly PersistedQuotationLineMapping[]> {
    const rows = await this.db
      .select()
      .from(quotationLineMappings)
      .where(eq(quotationLineMappings.documentId, documentId))
      .orderBy(desc(quotationLineMappings.createdAt));

    return rows.map((r) => this.toPersisted(r));
  }

  async updateStatus(
    id: string,
    status: string,
  ): Promise<PersistedQuotationLineMapping | null> {
    const rows = await this.db
      .update(quotationLineMappings)
      .set({ status, updatedAt: new Date() })
      .where(eq(quotationLineMappings.id, id))
      .returning();

    return rows.length > 0 ? this.toPersisted(rows[0]) : null;
  }

  private toPersisted(
    row: typeof quotationLineMappings.$inferSelect,
  ): PersistedQuotationLineMapping {
    return {
      id: row.id,
      projectId: row.projectId,
      documentId: row.documentId,
      quotationLineId: row.quotationLineId,
      projectCostItemId: row.projectCostItemId,
      costCategory: row.costCategory,
      sourceAmount: row.sourceAmount,
      mappedAmount: row.mappedAmount,
      mappingType: row.mappingType,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
