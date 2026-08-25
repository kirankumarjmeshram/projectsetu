import { eq, desc } from "drizzle-orm";
import { generateId } from "../id";
import { projectInputSnapshots } from "../schema/project-input-snapshots";
import type { DrizzleDatabase } from "../db";
import type {
  CreateInputSnapshotInput,
  InputSnapshotRepository,
  PersistedInputSnapshot,
} from "./types";

export class PgInputSnapshotRepository implements InputSnapshotRepository {
  constructor(private readonly db: DrizzleDatabase) {}

  async create(
    input: CreateInputSnapshotInput,
  ): Promise<PersistedInputSnapshot> {
    const id = input.id ?? generateId();

    const [row] = await this.db
      .insert(projectInputSnapshots)
      .values({
        id,
        projectId: input.projectId,
        snapshotType: input.snapshotType ?? "PROJECT_INPUT",
        schemaVersion: input.schemaVersion ?? 1,
        revision: input.revision,
        data: input.data,
      })
      .returning();

    return this.toPersistedSnapshot(row);
  }

  async findById(id: string): Promise<PersistedInputSnapshot | null> {
    const rows = await this.db
      .select()
      .from(projectInputSnapshots)
      .where(eq(projectInputSnapshots.id, id))
      .limit(1);

    return rows.length > 0 ? this.toPersistedSnapshot(rows[0]) : null;
  }

  async findByProjectId(
    projectId: string,
  ): Promise<readonly PersistedInputSnapshot[]> {
    const rows = await this.db
      .select()
      .from(projectInputSnapshots)
      .where(eq(projectInputSnapshots.projectId, projectId))
      .orderBy(desc(projectInputSnapshots.revision));

    return rows.map((row) => this.toPersistedSnapshot(row));
  }

  async findLatestByProjectId(
    projectId: string,
  ): Promise<PersistedInputSnapshot | null> {
    const rows = await this.db
      .select()
      .from(projectInputSnapshots)
      .where(eq(projectInputSnapshots.projectId, projectId))
      .orderBy(desc(projectInputSnapshots.revision))
      .limit(1);

    return rows.length > 0 ? this.toPersistedSnapshot(rows[0]) : null;
  }

  private toPersistedSnapshot(
    row: typeof projectInputSnapshots.$inferSelect,
  ): PersistedInputSnapshot {
    return {
      id: row.id,
      projectId: row.projectId,
      snapshotType: row.snapshotType,
      schemaVersion: row.schemaVersion,
      revision: row.revision,
      data: row.data,
      createdAt: row.createdAt,
    };
  }
}
