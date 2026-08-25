import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

const { Client } = pg;

export async function startTestPostgres(port = 5433) {
  const dbDir = resolve(process.cwd(), ".postgres-test-data");
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  const pgServer = new EmbeddedPostgres({
    port,
    databaseDir: dbDir,
    user: "postgres",
    password: "password",
    persistent: true,
  });

  try {
    await pgServer.initialise();
  } catch {
    // might already be initialized
  }

  try {
    await pgServer.start();
  } catch (err: unknown) {
    // might already be running
    console.log("Postgres start notice:", (err as Error)?.message || err);
  }

  const client = new Client({
    connectionString: `postgresql://postgres:password@127.0.0.1:${port}/postgres`,
  });
  await client.connect();

  const verRes = await client.query("SELECT version();");
  const version = verRes.rows[0].version as string;

  // Check if projectsetu_test exists, if not create it
  const dbCheck = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = 'projectsetu_test'",
  );
  if (dbCheck.rows.length === 0) {
    await client.query("CREATE DATABASE projectsetu_test;");
  }

  await client.end();

  const testDbUrl = `postgresql://postgres:password@127.0.0.1:${port}/projectsetu_test`;
  return { pgServer, version, testDbUrl };
}

if (process.argv[1] && process.argv[1].includes("test-db-setup")) {
  startTestPostgres()
    .then(({ version, testDbUrl }) => {
      console.log("PostgreSQL Version:", version);
      console.log("Test Database URL:", testDbUrl);
      console.log("Ready for migrations and tests.");
    })
    .catch((err) => {
      console.error("Failed to start test database:", err);
      process.exit(1);
    });
}
