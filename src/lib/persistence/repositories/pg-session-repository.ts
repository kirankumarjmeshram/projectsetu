import { eq, lt } from "drizzle-orm";

import type { DrizzleDatabase } from "../db";
import { generateId } from "../id";
import { sessions } from "../schema/sessions";
import type {
  CreateSessionInput,
  PersistedSession,
  SessionRepository,
} from "./types";

export class PgSessionRepository implements SessionRepository {
  constructor(private readonly db: DrizzleDatabase) {}

  async create(input: CreateSessionInput): Promise<PersistedSession> {
    const id = input.id ?? generateId();

    const [row] = await this.db
      .insert(sessions)
      .values({
        id,
        userId: input.userId,
        token: input.token,
        expiresAt: input.expiresAt,
        createdAt: new Date(),
      })
      .returning();

    return this.toPersistedSession(row);
  }

  async findByToken(token: string): Promise<PersistedSession | null> {
    const rows = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.token, token))
      .limit(1);

    return rows.length > 0 ? this.toPersistedSession(rows[0]) : null;
  }

  async deleteByToken(token: string): Promise<boolean> {
    const rows = await this.db
      .delete(sessions)
      .where(eq(sessions.token, token))
      .returning({ id: sessions.id });

    return rows.length > 0;
  }

  async deleteByUserId(userId: string): Promise<number> {
    const rows = await this.db
      .delete(sessions)
      .where(eq(sessions.userId, userId))
      .returning({ id: sessions.id });

    return rows.length;
  }

  async deleteExpired(): Promise<number> {
    const now = new Date();
    const rows = await this.db
      .delete(sessions)
      .where(lt(sessions.expiresAt, now))
      .returning({ id: sessions.id });

    return rows.length;
  }

  private toPersistedSession(
    row: typeof sessions.$inferSelect,
  ): PersistedSession {
    return {
      id: row.id,
      userId: row.userId,
      token: row.token,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    };
  }
}
