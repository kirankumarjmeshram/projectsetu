import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { resolve } from "node:path";

const { Pool } = pg;

export async function runTestMigrations(testDbUrl?: string) {
  const connectionString =
    testDbUrl ||
    process.env.TEST_DATABASE_URL ||
    "postgresql://postgres:password@127.0.0.1:5433/projectsetu_test";

  console.log(
    "Applying migrations to test database at:",
    connectionString.replace(/:[^:@]+@/, ":****@"),
  );

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  const migrationsFolder = resolve(process.cwd(), "drizzle");
  console.log("Migration folder:", migrationsFolder);

  await migrate(db, { migrationsFolder });
  console.log("Migrations applied successfully!");

  // Verify created tables
  const client = await pool.connect();
  const tablesRes = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);

  console.log("Verified tables in database:");
  for (const row of tablesRes.rows) {
    console.log(" - " + row.table_name);
  }

  // Verify foreign keys
  const fksRes = await client.query(`
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
    ORDER BY tc.table_name, kcu.column_name;
  `);

  console.log("Verified foreign keys:");
  for (const row of fksRes.rows) {
    console.log(
      ` - ${row.table_name}.${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name}`,
    );
  }

  client.release();
  await pool.end();
}

if (process.argv[1] && process.argv[1].includes("migrate-test-db")) {
  runTestMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
