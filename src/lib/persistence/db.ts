import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import { getAppConfig } from "../env";
import * as schema from "./schema/index";

const { Pool } = pg;

export interface PoolConfigOptions {
  connectionString: string;
  min?: number;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  ssl?: boolean | { rejectUnauthorized?: boolean };
}

/**
 * Creates a configured PostgreSQL connection pool.
 *
 * Server-side only — never expose through NEXT_PUBLIC_* variables.
 */
export function createPool(
  optionsOrString: string | PoolConfigOptions,
): pg.Pool {
  if (typeof optionsOrString === "string") {
    return new Pool({ connectionString: optionsOrString });
  }

  return new Pool({
    connectionString: optionsOrString.connectionString,
    min: optionsOrString.min ?? 2,
    max: optionsOrString.max ?? 20,
    idleTimeoutMillis: optionsOrString.idleTimeoutMillis ?? 10000,
    connectionTimeoutMillis: optionsOrString.connectionTimeoutMillis ?? 5000,
    ssl:
      optionsOrString.ssl === true
        ? { rejectUnauthorized: true }
        : optionsOrString.ssl
          ? optionsOrString.ssl
          : undefined,
  });
}

/**
 * Creates a Drizzle ORM database client from a connection pool.
 */
export function createDrizzleClient(pool: pg.Pool) {
  return drizzle(pool, { schema });
}

/**
 * Creates a Drizzle client directly from a connection string or options.
 */
export function createDatabase(optionsOrString: string | PoolConfigOptions) {
  const pool = createPool(optionsOrString);
  const db = createDrizzleClient(pool);
  return { pool, db };
}

let defaultPool: pg.Pool | null = null;
let defaultDatabase: DrizzleDatabase | null = null;

/**
 * Returns the active PostgreSQL connection pool singleton.
 */
export function getPool(): pg.Pool {
  if (!defaultPool) {
    const config = getAppConfig();
    defaultPool = createPool({
      connectionString: config.databaseUrl,
      min: config.dbPoolMin,
      max: config.dbPoolMax,
      idleTimeoutMillis: config.dbIdleTimeoutMs,
      connectionTimeoutMillis: config.dbConnectionTimeoutMs,
      ssl: config.dbSsl
        ? { rejectUnauthorized: config.dbSslRejectUnauthorized }
        : undefined,
    });
  }
  return defaultPool;
}

/**
 * Server-only application database singleton with persistent connection reuse.
 */
export function getDb(): DrizzleDatabase {
  if (!defaultDatabase) {
    const pool = getPool();
    defaultDatabase = createDrizzleClient(pool);
  }
  return defaultDatabase;
}

/**
 * Gracefully terminates all active PostgreSQL pool connections.
 * Used during server shutdown and integration test teardown.
 */
export async function closeDatabase(): Promise<void> {
  if (defaultPool) {
    await defaultPool.end();
    defaultPool = null;
    defaultDatabase = null;
  }
}

export type DrizzleDatabase = ReturnType<typeof createDrizzleClient>;
