import { describe, expect, it } from "vitest";
import {
  assertTestDatabaseUrl,
  LOCAL_TEST_URL,
} from "../../../scripts/test-db-setup";

describe("test database safety boundary", () => {
  it.each([
    LOCAL_TEST_URL,
    "postgresql://test_user:test_password@localhost:5432/projectsetu_test",
  ])("accepts an isolated loopback test target", (url) => {
    expect(() => assertTestDatabaseUrl(url)).not.toThrow();
  });
  it.each([
    "postgresql://user:secret@example.com/projectsetu_test",
    "postgresql://user:secret@localhost/projectsetu",
    "postgresql://user:secret@localhost/postgres",
    "postgresql://user:secret@localhost/projectsetu_test?host=example.com",
    "postgresql://user:secret@localhost/projectsetu_test#fragment",
    "not-a-url",
  ])("rejects unsafe targets without exposing credentials", (url) => {
    expect(() => assertTestDatabaseUrl(url)).toThrow();
    try {
      assertTestDatabaseUrl(url);
    } catch (error) {
      expect(String(error)).not.toContain("secret");
    }
  });
});
