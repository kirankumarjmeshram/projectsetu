import { desc, eq } from "drizzle-orm";

import type { DrizzleDatabase } from "../db";
import { generateId } from "../id";
import { adminAuditLogs } from "../schema/admin-audit-logs";
import type {
  AdminAuditRepository,
  CreateAdminAuditLogInput,
  PersistedAdminAuditLog,
} from "./types";

export class PgAdminAuditRepository implements AdminAuditRepository {
  constructor(private readonly db: DrizzleDatabase) {}

  async create(
    input: CreateAdminAuditLogInput,
  ): Promise<PersistedAdminAuditLog> {
    const id = input.id ?? generateId();

    const [row] = await this.db
      .insert(adminAuditLogs)
      .values({
        id,
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata ?? null,
        createdAt: new Date(),
      })
      .returning();

    return this.toPersistedAuditLog(row);
  }

  async findAll(
    limit: number = 100,
  ): Promise<readonly PersistedAdminAuditLog[]> {
    const rows = await this.db
      .select()
      .from(adminAuditLogs)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(limit);

    return rows.map((row) => this.toPersistedAuditLog(row));
  }

  async findByEntityType(
    entityType: string,
    limit: number = 100,
  ): Promise<readonly PersistedAdminAuditLog[]> {
    const rows = await this.db
      .select()
      .from(adminAuditLogs)
      .where(eq(adminAuditLogs.entityType, entityType))
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(limit);

    return rows.map((row) => this.toPersistedAuditLog(row));
  }

  private toPersistedAuditLog(
    row: typeof adminAuditLogs.$inferSelect,
  ): PersistedAdminAuditLog {
    return {
      id: row.id,
      actorUserId: row.actorUserId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      metadata: row.metadata,
      createdAt: row.createdAt,
    };
  }
}
