import { eq } from "drizzle-orm";
import { generateId } from "../id";
import { documentMetadata } from "../schema/document-metadata";
import type { DrizzleDatabase } from "../db";
import type {
  CreateDocumentMetadataInput,
  DocumentMetadataRepository,
  PersistedDocumentMetadata,
} from "./types";

export class PgDocumentMetadataRepository implements DocumentMetadataRepository {
  constructor(private readonly db: DrizzleDatabase) {}

  async create(
    input: CreateDocumentMetadataInput,
  ): Promise<PersistedDocumentMetadata> {
    const id = input.id ?? generateId();
    const now = new Date();

    const [row] = await this.db
      .insert(documentMetadata)
      .values({
        id,
        projectId: input.projectId,
        kind: input.kind,
        displayName: input.displayName ?? null,
        version: input.version ?? null,
        storageKey: input.storageKey ?? null,
        mimeType: input.mimeType ?? null,
        sizeBytes: input.sizeBytes ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return this.toPersistedDocument(row);
  }

  async findById(id: string): Promise<PersistedDocumentMetadata | null> {
    const rows = await this.db
      .select()
      .from(documentMetadata)
      .where(eq(documentMetadata.id, id))
      .limit(1);

    return rows.length > 0 ? this.toPersistedDocument(rows[0]) : null;
  }

  async findByProjectId(
    projectId: string,
  ): Promise<readonly PersistedDocumentMetadata[]> {
    const rows = await this.db
      .select()
      .from(documentMetadata)
      .where(eq(documentMetadata.projectId, projectId));

    return rows.map((row) => this.toPersistedDocument(row));
  }

  async update(
    id: string,
    input: Partial<CreateDocumentMetadataInput>,
  ): Promise<PersistedDocumentMetadata | null> {
    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.kind !== undefined) updateValues.kind = input.kind;
    if (input.displayName !== undefined)
      updateValues.displayName = input.displayName;
    if (input.version !== undefined) updateValues.version = input.version;
    if (input.storageKey !== undefined)
      updateValues.storageKey = input.storageKey;
    if (input.mimeType !== undefined) updateValues.mimeType = input.mimeType;
    if (input.sizeBytes !== undefined) updateValues.sizeBytes = input.sizeBytes;

    const rows = await this.db
      .update(documentMetadata)
      .set(updateValues)
      .where(eq(documentMetadata.id, id))
      .returning();

    return rows.length > 0 ? this.toPersistedDocument(rows[0]) : null;
  }

  private toPersistedDocument(
    row: typeof documentMetadata.$inferSelect,
  ): PersistedDocumentMetadata {
    return {
      id: row.id,
      projectId: row.projectId,
      kind: row.kind,
      displayName: row.displayName,
      version: row.version,
      storageKey: row.storageKey,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
