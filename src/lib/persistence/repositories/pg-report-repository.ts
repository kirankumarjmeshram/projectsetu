import { desc, eq } from "drizzle-orm";
import { generateId } from "../id";
import { reportMetadata } from "../schema/report-metadata";
import type { DrizzleDatabase } from "../db";
import type {
  CreateReportMetadataInput,
  PersistedReportMetadata,
  ReportMetadataRepository,
} from "./types";

export class PgReportMetadataRepository implements ReportMetadataRepository {
  constructor(private readonly db: DrizzleDatabase) {}

  async create(
    input: CreateReportMetadataInput,
  ): Promise<PersistedReportMetadata> {
    const id = input.id ?? generateId();
    const now = new Date();

    const [row] = await this.db
      .insert(reportMetadata)
      .values({
        id,
        projectId: input.projectId,
        reportType: input.reportType,
        reportVersion: input.reportVersion ?? 1,
        templateReference: input.templateReference ?? null,
        inputSnapshotId: input.inputSnapshotId ?? null,
        calculationRunId: input.calculationRunId ?? null,
        fundingSnapshotId: input.fundingSnapshotId ?? null,
        templateVersion: input.templateVersion ?? "BASE_BANKABLE_DPR/1.0",
        contentSchemaVersion: input.contentSchemaVersion ?? 1,
        status: input.status ?? "DRAFT",
        programContext: input.programContext ?? null,
        sections: input.sections ?? null,
        content: input.content ?? null,
        narrativeOverrides: input.narrativeOverrides ?? null,
        generatedDocumentId: input.generatedDocumentId ?? null,
        pdfDocumentId: input.pdfDocumentId ?? null,
        docxDocumentId: input.docxDocumentId ?? null,
        excelDocumentId: input.excelDocumentId ?? null,
        generatedAt: input.generatedAt ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return this.toPersistedReport(row);
  }

  async findById(id: string): Promise<PersistedReportMetadata | null> {
    const rows = await this.db
      .select()
      .from(reportMetadata)
      .where(eq(reportMetadata.id, id))
      .limit(1);

    return rows.length > 0 ? this.toPersistedReport(rows[0]) : null;
  }

  async findByProjectId(
    projectId: string,
  ): Promise<readonly PersistedReportMetadata[]> {
    const rows = await this.db
      .select()
      .from(reportMetadata)
      .where(eq(reportMetadata.projectId, projectId))
      .orderBy(desc(reportMetadata.reportVersion));

    return rows.map((row) => this.toPersistedReport(row));
  }

  async update(
    id: string,
    input: Partial<CreateReportMetadataInput>,
  ): Promise<PersistedReportMetadata | null> {
    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.reportType !== undefined)
      updateValues.reportType = input.reportType;
    if (input.reportVersion !== undefined)
      updateValues.reportVersion = input.reportVersion;
    if (input.templateReference !== undefined)
      updateValues.templateReference = input.templateReference;
    if (input.inputSnapshotId !== undefined)
      updateValues.inputSnapshotId = input.inputSnapshotId;
    if (input.calculationRunId !== undefined)
      updateValues.calculationRunId = input.calculationRunId;
    if (input.fundingSnapshotId !== undefined)
      updateValues.fundingSnapshotId = input.fundingSnapshotId;
    if (input.templateVersion !== undefined)
      updateValues.templateVersion = input.templateVersion;
    if (input.contentSchemaVersion !== undefined)
      updateValues.contentSchemaVersion = input.contentSchemaVersion;
    if (input.status !== undefined) updateValues.status = input.status;
    if (input.programContext !== undefined)
      updateValues.programContext = input.programContext;
    if (input.sections !== undefined) updateValues.sections = input.sections;
    if (input.content !== undefined) updateValues.content = input.content;
    if (input.narrativeOverrides !== undefined)
      updateValues.narrativeOverrides = input.narrativeOverrides;
    if (input.generatedDocumentId !== undefined)
      updateValues.generatedDocumentId = input.generatedDocumentId;
    if (input.pdfDocumentId !== undefined)
      updateValues.pdfDocumentId = input.pdfDocumentId;
    if (input.docxDocumentId !== undefined)
      updateValues.docxDocumentId = input.docxDocumentId;
    if (input.excelDocumentId !== undefined)
      updateValues.excelDocumentId = input.excelDocumentId;
    if (input.generatedAt !== undefined)
      updateValues.generatedAt = input.generatedAt;

    const rows = await this.db
      .update(reportMetadata)
      .set(updateValues)
      .where(eq(reportMetadata.id, id))
      .returning();

    return rows.length > 0 ? this.toPersistedReport(rows[0]) : null;
  }

  private toPersistedReport(
    row: typeof reportMetadata.$inferSelect,
  ): PersistedReportMetadata {
    return {
      id: row.id,
      projectId: row.projectId,
      reportType: row.reportType,
      reportVersion: row.reportVersion,
      templateReference: row.templateReference,
      inputSnapshotId: row.inputSnapshotId,
      calculationRunId: row.calculationRunId,
      fundingSnapshotId: row.fundingSnapshotId,
      templateVersion: row.templateVersion,
      contentSchemaVersion: row.contentSchemaVersion,
      status: row.status,
      programContext: row.programContext,
      sections: row.sections,
      content: row.content,
      narrativeOverrides: row.narrativeOverrides,
      generatedDocumentId: row.generatedDocumentId,
      pdfDocumentId: row.pdfDocumentId,
      docxDocumentId: row.docxDocumentId,
      excelDocumentId: row.excelDocumentId,
      generatedAt: row.generatedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
