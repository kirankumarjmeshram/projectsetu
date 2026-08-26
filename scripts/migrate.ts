import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

import { getAppConfig } from "../src/lib/env";

const { Pool } = pg;

export async function runMigrations(): Promise<void> {
  const config = getAppConfig();
  const sanitizedUrl = config.databaseUrl.replace(/:[^:@]+@/, ":****@");

  console.log(
    `[ProjectSetu Migration Runner] Connecting to database: ${sanitizedUrl}`,
  );

  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.dbSsl
      ? { rejectUnauthorized: config.dbSslRejectUnauthorized }
      : undefined,
  });

  const db = drizzle(pool);
  const migrationsFolder = resolve(process.cwd(), "drizzle");

  console.log(
    `[ProjectSetu Migration Runner] Reading migrations from: ${migrationsFolder}`,
  );

  const startTime = Date.now();
  try {
    await migrate(db, { migrationsFolder });
    const durationMs = Date.now() - startTime;
    console.log(
      `[ProjectSetu Migration Runner] ✅ All migrations applied successfully in ${durationMs}ms`,
    );
  } catch (error) {
    console.error(
      "[ProjectSetu Migration Runner] ❌ Migration failed:",
      (error as Error).message,
    );
    throw error;
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && process.argv[1].includes("migrate")) {
  runMigrations()
    .then(() => {
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}
