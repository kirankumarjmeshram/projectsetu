import { eq } from "drizzle-orm";
import { generateId } from "../id";
import { calculationRuns } from "../schema/calculation-runs";
import { calculationSnapshots } from "../schema/calculation-snapshots";
import { fundingSnapshots } from "../schema/funding-snapshots";
import type { DrizzleDatabase } from "../db";
import type {
  CalculationRunRepository,
  CalculationSnapshotRepository,
  CreateCalculationRunInput,
  CreateCalculationSnapshotInput,
  CreateFundingSnapshotInput,
  FundingSnapshotRepository,
  PersistedCalculationRun,
  PersistedCalculationSnapshot,
  PersistedFundingSnapshot,
} from "./types";

export class PgCalculationRunRepository implements CalculationRunRepository {
  constructor(private readonly db: DrizzleDatabase) {}

  async create(
    input: CreateCalculationRunInput,
  ): Promise<PersistedCalculationRun> {
    const id = input.id ?? generateId();

    const [row] = await this.db
      .insert(calculationRuns)
      .values({
        id,
        projectId: input.projectId,
        inputSnapshotId: input.inputSnapshotId,
        status: input.status ?? "PENDING",
        triggeredBy: input.triggeredBy ?? null,
      })
      .returning();

    return this.toPersistedRun(row);
  }

  async findById(id: string): Promise<PersistedCalculationRun | null> {
    const rows = await this.db
      .select()
      .from(calculationRuns)
      .where(eq(calculationRuns.id, id))
      .limit(1);

    return rows.length > 0 ? this.toPersistedRun(rows[0]) : null;
  }

  async findByProjectId(
    projectId: string,
  ): Promise<readonly PersistedCalculationRun[]> {
    const rows = await this.db
      .select()
      .from(calculationRuns)
      .where(eq(calculationRuns.projectId, projectId));

    return rows.map((row) => this.toPersistedRun(row));
  }

  async complete(
    id: string,
    status: "COMPLETED" | "FAILED",
  ): Promise<PersistedCalculationRun | null> {
    const rows = await this.db
      .update(calculationRuns)
      .set({
        status,
        completedAt: new Date(),
      })
      .where(eq(calculationRuns.id, id))
      .returning();

    return rows.length > 0 ? this.toPersistedRun(rows[0]) : null;
  }

  private toPersistedRun(
    row: typeof calculationRuns.$inferSelect,
  ): PersistedCalculationRun {
    return {
      id: row.id,
      projectId: row.projectId,
      inputSnapshotId: row.inputSnapshotId,
      status: row.status,
      triggeredBy: row.triggeredBy,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
    };
  }
}

export class PgCalculationSnapshotRepository implements CalculationSnapshotRepository {
  constructor(private readonly db: DrizzleDatabase) {}

  async create(
    input: CreateCalculationSnapshotInput,
  ): Promise<PersistedCalculationSnapshot> {
    const id = input.id ?? generateId();

    const [row] = await this.db
      .insert(calculationSnapshots)
      .values({
        id,
        projectId: input.projectId,
        calculationRunId: input.calculationRunId,
        snapshotType: input.snapshotType,
        schemaVersion: input.schemaVersion ?? 1,
        data: input.data,
      })
      .returning();

    return this.toPersistedSnapshot(row);
  }

  async findById(id: string): Promise<PersistedCalculationSnapshot | null> {
    const rows = await this.db
      .select()
      .from(calculationSnapshots)
      .where(eq(calculationSnapshots.id, id))
      .limit(1);

    return rows.length > 0 ? this.toPersistedSnapshot(rows[0]) : null;
  }

  async findByCalculationRunId(
    calculationRunId: string,
  ): Promise<readonly PersistedCalculationSnapshot[]> {
    const rows = await this.db
      .select()
      .from(calculationSnapshots)
      .where(eq(calculationSnapshots.calculationRunId, calculationRunId));

    return rows.map((row) => this.toPersistedSnapshot(row));
  }

  private toPersistedSnapshot(
    row: typeof calculationSnapshots.$inferSelect,
  ): PersistedCalculationSnapshot {
    return {
      id: row.id,
      projectId: row.projectId,
      calculationRunId: row.calculationRunId,
      snapshotType: row.snapshotType,
      schemaVersion: row.schemaVersion,
      data: row.data,
      createdAt: row.createdAt,
    };
  }
}

export class PgFundingSnapshotRepository implements FundingSnapshotRepository {
  constructor(private readonly db: DrizzleDatabase) {}

  async create(
    input: CreateFundingSnapshotInput,
  ): Promise<PersistedFundingSnapshot> {
    const id = input.id ?? generateId();

    const [row] = await this.db
      .insert(fundingSnapshots)
      .values({
        id,
        projectId: input.projectId,
        calculationRunId: input.calculationRunId,
        snapshotType: input.snapshotType ?? "FUNDING_COMPOSER",
        schemaVersion: input.schemaVersion ?? 1,
        data: input.data,
      })
      .returning();

    return this.toPersistedSnapshot(row);
  }

  async findById(id: string): Promise<PersistedFundingSnapshot | null> {
    const rows = await this.db
      .select()
      .from(fundingSnapshots)
      .where(eq(fundingSnapshots.id, id))
      .limit(1);

    return rows.length > 0 ? this.toPersistedSnapshot(rows[0]) : null;
  }

  async findByCalculationRunId(
    calculationRunId: string,
  ): Promise<readonly PersistedFundingSnapshot[]> {
    const rows = await this.db
      .select()
      .from(fundingSnapshots)
      .where(eq(fundingSnapshots.calculationRunId, calculationRunId));

    return rows.map((row) => this.toPersistedSnapshot(row));
  }

  async findByProjectId(
    projectId: string,
  ): Promise<readonly PersistedFundingSnapshot[]> {
    const rows = await this.db
      .select()
      .from(fundingSnapshots)
      .where(eq(fundingSnapshots.projectId, projectId));

    return rows.map((row) => this.toPersistedSnapshot(row));
  }

  private toPersistedSnapshot(
    row: typeof fundingSnapshots.$inferSelect,
  ): PersistedFundingSnapshot {
    return {
      id: row.id,
      projectId: row.projectId,
      calculationRunId: row.calculationRunId,
      snapshotType: row.snapshotType,
      schemaVersion: row.schemaVersion,
      data: row.data,
      createdAt: row.createdAt,
    };
  }
}
