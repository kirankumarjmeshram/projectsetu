import { eq } from "drizzle-orm";

import { generateId } from "../id";
import { programSelections } from "../schema/program-selections";

import type { DrizzleDatabase } from "../db";
import type {
  CreateProgramSelectionInput,
  PersistedProgramSelection,
  ProgramSelectionRepository,
} from "./types";

export class PgProgramSelectionRepository implements ProgramSelectionRepository {
  constructor(private readonly db: DrizzleDatabase) {}

  async create(
    input: CreateProgramSelectionInput,
  ): Promise<PersistedProgramSelection> {
    const id = input.id ?? generateId();

    const [row] = await this.db
      .insert(programSelections)
      .values({
        id,
        projectId: input.projectId,
        programId: input.programId,
        versionId: input.versionId ?? null,
      })
      .returning();

    return this.toPersisted(row);
  }

  async findByProjectId(
    projectId: string,
  ): Promise<readonly PersistedProgramSelection[]> {
    const rows = await this.db
      .select()
      .from(programSelections)
      .where(eq(programSelections.projectId, projectId));

    return rows.map((row) => this.toPersisted(row));
  }

  async deleteByProjectId(projectId: string): Promise<number> {
    const rows = await this.db
      .delete(programSelections)
      .where(eq(programSelections.projectId, projectId))
      .returning({ id: programSelections.id });

    return rows.length;
  }

  async replaceForProject(
    projectId: string,
    selections: readonly CreateProgramSelectionInput[],
  ): Promise<readonly PersistedProgramSelection[]> {
    // Delete existing selections
    await this.deleteByProjectId(projectId);

    // Insert new selections
    if (selections.length === 0) {
      return [];
    }

    const values = selections.map((s) => ({
      id: s.id ?? generateId(),
      projectId,
      programId: s.programId,
      versionId: s.versionId ?? null,
    }));

    const rows = await this.db
      .insert(programSelections)
      .values(values)
      .returning();

    return rows.map((row) => this.toPersisted(row));
  }

  private toPersisted(
    row: typeof programSelections.$inferSelect,
  ): PersistedProgramSelection {
    return {
      id: row.id,
      projectId: row.projectId,
      programId: row.programId,
      versionId: row.versionId,
      createdAt: row.createdAt,
    };
  }
}
