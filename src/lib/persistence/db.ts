import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema/index";

const { Pool } = pg;

/**
 * Creates a PostgreSQL connection pool and Drizzle client.
 *
 * Server-side only — never expose through NEXT_PUBLIC_* variables.
 */
export function createPool(connectionString: string) {
  return new Pool({ connectionString });
}

/**
 * Creates a Drizzle ORM database client from a connection pool.
 */
export function createDrizzleClient(pool: pg.Pool) {
  return drizzle(pool, { schema });
}

/**
 * Creates a Drizzle client directly from a connection string.
 * Convenience wrapper for simple usage.
 */
export function createDatabase(connectionString: string) {
  const pool = createPool(connectionString);
  const db = createDrizzleClient(pool);
  return { pool, db };
}

let defaultDatabase: DrizzleDatabase | null = null;

/** Server-only application database singleton. */
export function getDb(): DrizzleDatabase {
  if (!defaultDatabase) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is required for persistence operations.");
    }
    defaultDatabase = createDrizzleClient(createPool(connectionString));
  }
  return defaultDatabase;
}

export type DrizzleDatabase = ReturnType<typeof createDrizzleClient>;
