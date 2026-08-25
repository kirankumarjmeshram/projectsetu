import { eq, and } from "drizzle-orm";
import { generateId } from "../id";
import { projects } from "../schema/projects";
import type { DrizzleDatabase } from "../db";
import type {
  CreateProjectInput,
  PersistedProject,
  ProjectRepository,
  RepositoryResult,
  UpdateProjectInput,
} from "./types";

export class PgProjectRepository implements ProjectRepository {
  constructor(private readonly db: DrizzleDatabase) {}

  async create(input: CreateProjectInput): Promise<PersistedProject> {
    const id = input.id ?? generateId();
    const now = new Date();

    const [row] = await this.db
      .insert(projects)
      .values({
        id,
        name: input.name,
        mode: input.mode,
        industryActivity: input.industryActivity,
        stage: input.stage,
        status: input.status ?? "DRAFT",
        areaClassification: input.areaClassification ?? "UNCLASSIFIED",
        location: input.location ?? null,
        projectionPeriodYears: input.projectionPeriodYears,
        implementationFrom: input.implementationFrom ?? null,
        implementationUntil: input.implementationUntil ?? null,
        revision: 1,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return this.toPersistedProject(row);
  }

  async findById(id: string): Promise<PersistedProject | null> {
    const rows = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    return rows.length > 0 ? this.toPersistedProject(rows[0]) : null;
  }

  async findAll(): Promise<readonly PersistedProject[]> {
    const rows = await this.db
      .select()
      .from(projects)
      .orderBy(projects.createdAt);

    return rows.map((row) => this.toPersistedProject(row));
  }

  async update(
    id: string,
    expectedRevision: number,
    input: UpdateProjectInput,
  ): Promise<RepositoryResult<PersistedProject>> {
    const now = new Date();
    const newRevision = expectedRevision + 1;

    const updateValues: Record<string, unknown> = {
      updatedAt: now,
      revision: newRevision,
    };

    if (input.name !== undefined) updateValues.name = input.name;
    if (input.mode !== undefined) updateValues.mode = input.mode;
    if (input.industryActivity !== undefined)
      updateValues.industryActivity = input.industryActivity;
    if (input.stage !== undefined) updateValues.stage = input.stage;
    if (input.status !== undefined) updateValues.status = input.status;
    if (input.areaClassification !== undefined)
      updateValues.areaClassification = input.areaClassification;
    if (input.location !== undefined) updateValues.location = input.location;
    if (input.projectionPeriodYears !== undefined)
      updateValues.projectionPeriodYears = input.projectionPeriodYears;
    if (input.implementationFrom !== undefined)
      updateValues.implementationFrom = input.implementationFrom;
    if (input.implementationUntil !== undefined)
      updateValues.implementationUntil = input.implementationUntil;
    if (input.currentInputSnapshotId !== undefined)
      updateValues.currentInputSnapshotId = input.currentInputSnapshotId;

    const rows = await this.db
      .update(projects)
      .set(updateValues)
      .where(and(eq(projects.id, id), eq(projects.revision, expectedRevision)))
      .returning();

    if (rows.length === 0) {
      return {
        ok: false,
        error: {
          code: "CONCURRENCY_CONFLICT",
          entityId: id,
          expectedRevision,
          message: `Project ${id} has been modified since revision ${expectedRevision}.`,
        },
      };
    }

    return { ok: true, value: this.toPersistedProject(rows[0]) };
  }

  async archive(
    id: string,
    expectedRevision: number,
  ): Promise<RepositoryResult<PersistedProject>> {
    return this.update(id, expectedRevision, { status: "ARCHIVED" });
  }

  async hardDelete(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(projects)
      .where(eq(projects.id, id))
      .returning({ id: projects.id });

    return rows.length > 0;
  }

  private toPersistedProject(
    row: typeof projects.$inferSelect,
  ): PersistedProject {
    return {
      id: row.id,
      name: row.name,
      mode: row.mode,
      industryActivity: row.industryActivity,
      stage: row.stage,
      status: row.status,
      areaClassification: row.areaClassification,
      location: row.location,
      projectionPeriodYears: row.projectionPeriodYears,
      implementationFrom: row.implementationFrom,
      implementationUntil: row.implementationUntil,
      currentInputSnapshotId: row.currentInputSnapshotId,
      revision: row.revision,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
