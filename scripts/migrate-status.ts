import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

import { getAppConfig } from "../src/lib/env";

const { Pool } = pg;

export async function checkMigrationStatus(): Promise<void> {
  const config = getAppConfig();
  const sanitizedUrl = config.databaseUrl.replace(/:[^:@]+@/, ":****@");

  console.log(
    `[ProjectSetu Migration Status] Target database: ${sanitizedUrl}`,
  );

  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.dbSsl
      ? { rejectUnauthorized: config.dbSslRejectUnauthorized }
      : undefined,
  });

  const client = await pool.connect();
  try {
    // Check Drizzle migrations table
    const tableCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations';
    `);

    const hasMigrationsTable = tableCheck.rows.length > 0;
    const appliedHashes: string[] = [];

    if (hasMigrationsTable) {
      const res = await client.query(`
        SELECT id, hash, created_at
        FROM drizzle.__drizzle_migrations
        ORDER BY created_at ASC;
      `);
      for (const row of res.rows) {
        appliedHashes.push(row.hash);
      }
    }

    const migrationsFolder = resolve(process.cwd(), "drizzle");
    const sqlFiles = readdirSync(migrationsFolder)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    console.log(`\nMigration Folder: ${migrationsFolder}`);
    console.log(`Total Local Migration Files: ${sqlFiles.length}`);
    console.log(`Total Applied In Database: ${appliedHashes.length}\n`);

    console.log("Migration Manifest:");
    for (let i = 0; i < sqlFiles.length; i++) {
      const file = sqlFiles[i];
      const isApplied = i < appliedHashes.length;
      const statusBadge = isApplied ? "✅ APPLIED" : "⏳ PENDING";
      console.log(`  [${statusBadge}] ${file}`);
    }

    if (sqlFiles.length === appliedHashes.length) {
      console.log(
        "\n✅ Database schema is up to date with repository migrations.",
      );
    } else {
      console.log(
        `\n⚠️ Database schema has ${sqlFiles.length - appliedHashes.length} pending migration(s). Run 'npm run db:migrate' to apply.`,
      );
    }
  } catch (err) {
    console.error("Failed to query migration status:", (err as Error).message);
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && process.argv[1].includes("migrate-status")) {
  checkMigrationStatus()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
