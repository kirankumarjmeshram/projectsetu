import assert from "node:assert/strict";
import pg from "pg";
import {
  checkTestDatabase,
  LOCAL_TEST_URL,
  startTestPostgres,
} from "./test-db-setup";
import { runTestMigrations } from "./migrate-test-db";

const url = process.env.TEST_DATABASE_URL || LOCAL_TEST_URL;
await checkTestDatabase(url);
await runTestMigrations(url);
await runTestMigrations(url);
if (url === LOCAL_TEST_URL) {
  const borrowed = await startTestPostgres();
  await borrowed.stop();
  await checkTestDatabase(url); // A borrowed server must remain alive.
}
const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  const encoding = await client.query("SHOW server_encoding");
  assert.equal(encoding.rows[0].server_encoding, "UTF8");
  const migrations = await client.query(
    "SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations",
  );
  assert.equal(migrations.rows[0].count, 4);
} finally {
  await client.end();
}
await assert.rejects(
  checkTestDatabase(
    "postgresql://postgres:password@127.0.0.1:1/projectsetu_test",
  ),
);
// Exercise the real readiness handler against an unreachable required DB.
process.env.DATABASE_URL =
  "postgresql://postgres:password@127.0.0.1:1/projectsetu_test";
const { GET } = await import("../src/app/api/ready/route");
const response = await GET();
assert.equal(response.status, 503);
assert.doesNotMatch(
  JSON.stringify(await response.json()),
  /password|postgresql:\/\/|SELECT/,
);
const { closeDatabase } = await import("../src/lib/persistence/db");
await closeDatabase();
console.log(
  "Infrastructure checks passed: live reachability, borrowed ownership, UTF8, repeated migrations, unreachable DB rejection, real readiness 503 and sanitized response.",
);
