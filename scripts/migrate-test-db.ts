import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { resolve } from "node:path";
import { assertTestDatabaseUrl } from "./test-db-setup";

export async function runTestMigrations(connectionString: string) {
  assertTestDatabaseUrl(connectionString);
  const pool = new pg.Pool({
    connectionString,
    connectionTimeoutMillis: 10000,
  });
  try {
    await migrate(drizzle(pool), { migrationsFolder: resolve("drizzle") });
    await pool.query("SELECT 1 FROM drizzle.__drizzle_migrations LIMIT 1");
    console.log("Test migrations applied and verified.");
  } finally {
    await pool.end();
  }
}
