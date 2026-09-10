import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import EmbeddedPostgres from "embedded-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const DEV_PORT = 5434;
const DEV_DATABASE = "projectsetu_dev";
const DEV_URL = `postgresql://postgres:password@127.0.0.1:${DEV_PORT}/${DEV_DATABASE}`;
const dataDir = resolve(".postgres-dev-data");
const logPath = resolve(".postgres-dev.log");
const runFile = promisify(execFile);

class DevDatabaseError extends Error {}

async function pgCtl(args: string[]) {
  const platform = process.platform === "win32" ? "windows" : process.platform;
  const { pg_ctl } = await import(
    `@embedded-postgres/${platform}-${process.arch}`
  );
  await runFile(pg_ctl, args, { windowsHide: true, timeout: 20000 });
}

async function probeOwnedCluster(): Promise<boolean> {
  const client = new pg.Client({
    connectionString: DEV_URL.replace(`/${DEV_DATABASE}`, "/postgres"),
    connectionTimeoutMillis: 1500,
  });
  try {
    await client.connect();
    const result = await client.query("SHOW data_directory");
    if (
      resolve(result.rows[0].data_directory).toLowerCase() !==
      dataDir.toLowerCase()
    )
      throw new DevDatabaseError(
        `Port ${DEV_PORT} belongs to another PostgreSQL cluster; refusing to manage it.`,
      );
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ECONNREFUSED") return false;
    throw error;
  } finally {
    await client.end();
  }
}

async function check() {
  if (!(await probeOwnedCluster()))
    throw new DevDatabaseError("The local development database is stopped.");
  const client = new pg.Client({ connectionString: DEV_URL });
  try {
    await client.connect();
    const result = await client.query(
      "SELECT current_database() AS name, current_setting('server_encoding') AS encoding",
    );
    if (
      result.rows[0].name !== DEV_DATABASE ||
      result.rows[0].encoding !== "UTF8"
    )
      throw new DevDatabaseError(
        "The local development database must be projectsetu_dev with UTF8 encoding.",
      );
  } finally {
    await client.end();
  }
}

async function start() {
  if (await probeOwnedCluster()) {
    await check();
    console.log("Local development database is already running.");
    return;
  }
  if (!existsSync(resolve(dataDir, "PG_VERSION"))) {
    const initializer = new EmbeddedPostgres({
      port: DEV_PORT,
      databaseDir: dataDir,
      user: "postgres",
      password: "password",
      persistent: true,
      initdbFlags: ["--encoding=UTF8", "--locale=C"],
      onLog: () => {},
      onError: () => {},
    });
    await initializer.initialise();
  }
  await pgCtl([
    "start",
    "-D",
    dataDir,
    "-l",
    logPath,
    "-o",
    `-h 127.0.0.1 -p ${DEV_PORT}`,
    "-w",
    "-t",
    "15",
  ]);
  const admin = new pg.Client({
    connectionString: DEV_URL.replace(`/${DEV_DATABASE}`, "/postgres"),
  });
  try {
    await admin.connect();
    const found = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [DEV_DATABASE],
    );
    if (!found.rowCount)
      await admin.query(
        `CREATE DATABASE ${DEV_DATABASE} WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`,
      );
  } finally {
    await admin.end();
  }
  await check();
  console.log(`Local development database started on 127.0.0.1:${DEV_PORT}.`);
}

async function stop() {
  if (!(await probeOwnedCluster())) {
    console.log("Local development database is already stopped.");
    return;
  }
  await pgCtl(["stop", "-D", dataDir, "-m", "fast", "-w", "-t", "15"]);
  console.log("Local development database stopped.");
}

async function prepare() {
  await start();
  const pool = new pg.Pool({ connectionString: DEV_URL });
  try {
    await migrate(drizzle(pool), { migrationsFolder: resolve("drizzle") });
  } finally {
    await pool.end();
  }
  console.log("Local development database migrations applied.");
}

const command = process.argv[2];
try {
  if (command === "start") await start();
  else if (command === "stop") await stop();
  else if (command === "prepare") await prepare();
  else if (command === "check") {
    await check();
    console.log("Local development database is ready and UTF8.");
  } else throw new DevDatabaseError("Use start, stop, prepare, or check.");
} catch (error) {
  const detail = error instanceof Error ? error.message : "Unknown error";
  console.error(
    error instanceof DevDatabaseError
      ? error.message
      : `Local development database command failed: ${detail.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[database URL hidden]")}`,
  );
  process.exitCode = 1;
}
