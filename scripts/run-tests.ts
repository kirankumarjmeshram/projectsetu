import { spawn } from "node:child_process";
import { open, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import {
  TestDatabaseError,
  assertTestDatabaseUrl,
  checkTestDatabase,
  LOCAL_TEST_URL,
  startTestPostgres,
} from "./test-db-setup";
import { runTestMigrations } from "./migrate-test-db";

const mode = process.argv[2];
const commands: Record<string, string[]> = {
  infra: ["--import", "tsx", "scripts/test-infrastructure.ts"],
  unit: ["node_modules/vitest/vitest.mjs", "run"],
  watch: ["node_modules/vitest/vitest.mjs"],
  db: [
    "node_modules/vitest/vitest.mjs",
    "run",
    "--config",
    "vitest.config.db.ts",
  ],
  e2e: ["node_modules/@playwright/test/cli.js", "test"],
};

async function main() {
  if (![...Object.keys(commands), "prepare", "check", "verify"].includes(mode))
    throw new TestDatabaseError("Unknown test command.");
  const url = process.env.TEST_DATABASE_URL || LOCAL_TEST_URL;
  assertTestDatabaseUrl(url);
  const lockPath = resolve(".test-run.lock");
  const lock = await open(lockPath, "wx").catch(() => {
    throw new TestDatabaseError(
      "Another test command owns .test-run.lock. If interrupted, verify its process has exited before removing that file.",
    );
  });
  await lock.writeFile(String(process.pid));
  let stop = async () => {};
  try {
    if (mode !== "check" && !process.env.TEST_DATABASE_URL) {
      ({ stop } = await startTestPostgres());
    }
    await checkTestDatabase(url);
    if (mode !== "check") await runTestMigrations(url);
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: url,
      TEST_DATABASE_URL: url,
      DB_SSL: "false",
      AUTH_SECRET: "projectsetu-isolated-test-secret-at-least-32-characters",
      APP_URL: "http://127.0.0.1:3100",
      PORT: "3100",
    };
    const run = async (args: string[]) => {
      await new Promise<void>((accept, reject) => {
        const child = spawn(process.execPath, args, {
          stdio: "inherit",
          env: {
            ...env,
            NODE_ENV: args.includes("build") ? "production" : "test",
          },
          windowsHide: true,
        });
        const interrupt = () => child.kill("SIGTERM");
        process.on("SIGINT", interrupt);
        process.on("SIGTERM", interrupt);
        child.once("error", reject);
        child.once("exit", (code) => {
          process.off("SIGINT", interrupt);
          process.off("SIGTERM", interrupt);
          if (code === 0) accept();
          else reject(new TestDatabaseError("Test subprocess failed."));
        });
      });
    };
    if (mode === "verify") {
      for (const args of [
        ["node_modules/typescript/bin/tsc", "--noEmit"],
        ["node_modules/eslint/bin/eslint.js", "."],
        commands.infra,
        commands.unit,
        commands.db,
        commands.e2e,
        ["node_modules/next/dist/bin/next", "build"],
      ])
        await run(args);
    } else if (commands[mode])
      await run([...commands[mode], ...process.argv.slice(3)]);
    else console.log("Test database is reachable and UTF8.");
  } finally {
    try {
      await stop();
    } finally {
      await lock.close();
      await unlink(lockPath);
    }
  }
}

main().catch((error) => {
  console.error(
    error instanceof TestDatabaseError
      ? error.message
      : "Test database setup/check failed. Check the local test service and permissions.",
  );
  // embedded-postgres installs a beforeExit hook that otherwise exits with 0.
  // All owned cleanup has completed in main's finally before this explicit exit.
  process.exit(1);
});
