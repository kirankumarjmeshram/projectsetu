import { eq } from "drizzle-orm";
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
        templateReference: input.templateReference ?? null,
        inputSnapshotId: input.inputSnapshotId ?? null,
        calculationRunId: input.calculationRunId ?? null,
        programContext: input.programContext ?? null,
        sections: input.sections ?? null,
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
      .where(eq(reportMetadata.projectId, projectId));

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
    if (input.templateReference !== undefined)
      updateValues.templateReference = input.templateReference;
    if (input.inputSnapshotId !== undefined)
      updateValues.inputSnapshotId = input.inputSnapshotId;
    if (input.calculationRunId !== undefined)
      updateValues.calculationRunId = input.calculationRunId;
    if (input.programContext !== undefined)
      updateValues.programContext = input.programContext;
    if (input.sections !== undefined) updateValues.sections = input.sections;

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
      templateReference: row.templateReference,
      inputSnapshotId: row.inputSnapshotId,
      calculationRunId: row.calculationRunId,
      programContext: row.programContext,
      sections: row.sections,
      generatedDocumentId: row.generatedDocumentId,
      generatedAt: row.generatedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
