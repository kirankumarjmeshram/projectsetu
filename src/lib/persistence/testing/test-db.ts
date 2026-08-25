/**
 * Test infrastructure for database integration tests.
 *
 * Strategy: Transaction rollback isolation.
 * Each test runs inside a single PostgreSQL transaction that is rolled back
 * after the test completes. All repository operations within the test use
 * the SAME transaction-scoped Drizzle client, ensuring genuine isolation.
 *
 * Requirements:
 * - TEST_DATABASE_URL environment variable must be set
 * - PostgreSQL must be running and the test database must exist
 * - Schema must be pushed/migrated before running tests
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "../schema/index";

import type { DrizzleDatabase } from "../db";

const { Pool } = pg;

let testPool: pg.Pool | null = null;

/**
 * Returns the shared test connection pool.
 * Creates it lazily on first call.
 */
export function getTestPool(): pg.Pool {
  if (testPool) return testPool;

  const connectionString =
    process.env.TEST_DATABASE_URL ||
    "postgresql://postgres:password@127.0.0.1:5433/projectsetu_test";

  testPool = new Pool({ connectionString, max: 5 });
  return testPool;
}

/**
 * Closes the shared test pool. Call this in afterAll() of the outermost
 * test suite or in globalTeardown.
 */
export async function closeTestPool(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
}

/**
 * Transaction-scoped test context providing an isolated Drizzle client.
 *
 * Usage:
 * ```ts
 * let ctx: TestTransactionContext;
 *
 * beforeEach(async () => {
 *   ctx = await createTestTransaction();
 * });
 *
 * afterEach(async () => {
 *   await ctx.rollback();
 * });
 *
 * it("...", async () => {
 *   const repo = new PgProjectRepository(ctx.db);
 *   // all operations use the same transaction
 * });
 * ```
 */
export interface TestTransactionContext {
  /** Transaction-scoped Drizzle client — all repos should use this */
  readonly db: DrizzleDatabase;
  /** Underlying pg client (for manual SQL if needed) */
  readonly client: pg.PoolClient;
  /** Rolls back the transaction and releases the connection */
  rollback(): Promise<void>;
}

/**
 * Creates a new transaction-scoped test context.
 * The transaction is started immediately and must be rolled back
 * via the returned `rollback()` function.
 */
export async function createTestTransaction(): Promise<TestTransactionContext> {
  const pool = getTestPool();
  const client = await pool.connect();

  await client.query("BEGIN");

  // Create a Drizzle client bound to this specific pg client (transaction)
  const db = drizzle(client, { schema }) as unknown as DrizzleDatabase;

  return {
    db,
    client,
    async rollback() {
      try {
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }
    },
  };
}

/**
 * Checks whether the test database is available and reachable.
 * Returns false if TEST_DATABASE_URL is not set or the connection fails.
 */
export async function isTestDatabaseAvailable(): Promise<boolean> {
  const connectionString =
    process.env.TEST_DATABASE_URL ||
    "postgresql://postgres:password@127.0.0.1:5433/projectsetu_test";

  const pool = new Pool({ connectionString, max: 1 });
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    return true;
  } catch {
    return false;
  } finally {
    await pool.end();
  }
}
