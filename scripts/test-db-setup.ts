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
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
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

  // The test database must be UTF-8 even when an older persistent Windows
  // cluster was initialized with a legacy system code page.
  const dbCheck = await client.query(
    "SELECT pg_encoding_to_char(encoding) AS encoding FROM pg_database WHERE datname = 'projectsetu_test'",
  );
  if (dbCheck.rows[0] && dbCheck.rows[0].encoding !== "UTF8") {
    await client.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'projectsetu_test' AND pid <> pg_backend_pid()",
    );
    await client.query("DROP DATABASE projectsetu_test");
  }
  if (dbCheck.rows.length === 0) {
    await client.query(
      "CREATE DATABASE projectsetu_test WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'",
    );
  } else if (dbCheck.rows[0].encoding !== "UTF8") {
    await client.query(
      "CREATE DATABASE projectsetu_test WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'",
    );
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
