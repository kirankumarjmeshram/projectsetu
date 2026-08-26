import { desc, eq } from "drizzle-orm";

import type { DrizzleDatabase } from "../db";
import { generateId } from "../id";
import { users } from "../schema/users";
import type { CreateUserInput, PersistedUser, UserRepository } from "./types";

export class PgUserRepository implements UserRepository {
  constructor(private readonly db: DrizzleDatabase) {}

  async create(input: CreateUserInput): Promise<PersistedUser> {
    const id = input.id ?? generateId();
    const now = new Date();

    const [row] = await this.db
      .insert(users)
      .values({
        id,
        email: input.email.toLowerCase().trim(),
        name: input.name.trim(),
        passwordHash: input.passwordHash,
        role: input.role ?? "USER",
        isActive: input.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return this.toPersistedUser(row);
  }

  async findById(id: string): Promise<PersistedUser | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return rows.length > 0 ? this.toPersistedUser(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<PersistedUser | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    return rows.length > 0 ? this.toPersistedUser(rows[0]) : null;
  }

  async findAll(): Promise<readonly PersistedUser[]> {
    const rows = await this.db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));

    return rows.map((row) => this.toPersistedUser(row));
  }

  async updateRole(
    id: string,
    role: "USER" | "ADMIN",
  ): Promise<PersistedUser | null> {
    const [row] = await this.db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    return row ? this.toPersistedUser(row) : null;
  }

  async updateActiveStatus(
    id: string,
    isActive: boolean,
  ): Promise<PersistedUser | null> {
    const [row] = await this.db
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    return row ? this.toPersistedUser(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });

    return rows.length > 0;
  }

  private toPersistedUser(row: typeof users.$inferSelect): PersistedUser {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      passwordHash: row.passwordHash,
      role: row.role as "USER" | "ADMIN",
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
