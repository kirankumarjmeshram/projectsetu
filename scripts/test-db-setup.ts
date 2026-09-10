import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export class TestDatabaseError extends Error {}

export const LOCAL_TEST_URL =
  "postgresql://postgres:password@127.0.0.1:5433/projectsetu_test";

export function assertTestDatabaseUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TestDatabaseError("Invalid TEST_DATABASE_URL.");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.pathname !== "/projectsetu_test" ||
    url.search ||
    url.hash
  ) {
    throw new TestDatabaseError(
      "Tests require a loopback PostgreSQL projectsetu_test database without URL options.",
    );
  }
}

export async function checkTestDatabase(
  connectionString: string,
): Promise<void> {
  assertTestDatabaseUrl(connectionString);
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 10000,
  });
  try {
    await client.connect();
    const result = await client.query(
      "SELECT current_database() AS name, current_setting('server_encoding') AS encoding",
    );
    if (
      result.rows[0].name !== "projectsetu_test" ||
      result.rows[0].encoding !== "UTF8"
    ) {
      throw new TestDatabaseError(
        "Test database must be projectsetu_test with UTF8 encoding; no data was deleted.",
      );
    }
  } finally {
    await client.end();
  }
}

export async function startTestPostgres() {
  const dbDir = resolve(process.cwd(), ".postgres-test-data");
  const adminUrl = LOCAL_TEST_URL.replace("/projectsetu_test", "/postgres");
  const probe = new pg.Client({
    connectionString: adminUrl,
    connectionTimeoutMillis: 10000,
  });
  let running = false;
  try {
    await probe.connect();
    const result = await probe.query("SHOW data_directory");
    if (
      resolve(result.rows[0].data_directory).toLowerCase() !==
      dbDir.toLowerCase()
    ) {
      throw new TestDatabaseError(
        "Port 5433 belongs to a different cluster; refusing to modify it.",
      );
    }
    running = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ECONNREFUSED") throw error;
  } finally {
    await probe.end();
  }
  const pgServer = running
    ? undefined
    : new EmbeddedPostgres({
        port: 5433,
        databaseDir: dbDir,
        user: "postgres",
        password: "password",
        persistent: true,
        initdbFlags: ["--encoding=UTF8", "--locale=C"],
        postgresFlags: ["-h", "127.0.0.1"],
        onLog: () => {},
        onError: () => {},
      });
  // Use PostgreSQL's bounded fast shutdown, including on Windows. The package's
  // Windows stop uses taskkill and can hang when process termination is denied.
  let started = false;
  let stopping: Promise<void> | undefined;
  if (pgServer)
    pgServer.stop = () => {
      if (!started) return Promise.resolve();
      stopping ??= (async () => {
        const platform =
          process.platform === "win32" ? "windows" : process.platform;
        const { pg_ctl } = await import(
          `@embedded-postgres/${platform}-${process.arch}`
        );
        await promisify(execFile)(
          pg_ctl,
          ["stop", "-D", dbDir, "-m", "fast", "-w", "-t", "15"],
          { windowsHide: true, timeout: 20000 },
        );
      })();
      return stopping;
    };
  try {
    if (pgServer) {
      if (!existsSync(resolve(dbDir, "PG_VERSION")))
        await pgServer.initialise();
      await pgServer.start();
      started = true;
    }
    const client = new pg.Client({
      connectionString: adminUrl,
      connectionTimeoutMillis: 10000,
    });
    try {
      await client.connect();
      const result = await client.query(
        "SELECT 1 FROM pg_database WHERE datname = 'projectsetu_test'",
      );
      if (!result.rowCount)
        await client.query(
          "CREATE DATABASE projectsetu_test WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'",
        );
    } finally {
      await client.end();
    }
    await checkTestDatabase(LOCAL_TEST_URL);
    console.log(
      running
        ? "Reusing verified local test cluster."
        : "Started isolated local test cluster.",
    );
    return {
      testDbUrl: LOCAL_TEST_URL,
      stop: async () => {
        await pgServer?.stop();
      },
    };
  } catch (error) {
    await pgServer?.stop();
    throw error;
  }
}
