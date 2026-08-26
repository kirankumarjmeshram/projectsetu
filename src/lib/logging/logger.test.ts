import { describe, expect, it } from "vitest";

import { formatSanitizedError, Logger, redactSensitiveData } from "./logger";

describe("Structured Logging & Redaction", () => {
  it("redacts sensitive fields in nested context objects", () => {
    const raw = {
      user: "john@example.test",
      password: "SuperSecretPassword123!",
      session_token: "abcdef1234567890",
      details: {
        authSecret: "another-secret",
        apiKey: "api-key-999",
        normalField: "public-value",
      },
    };

    const redacted = redactSensitiveData(raw) as Record<string, unknown>;
    expect(redacted.user).toBe("john@example.test");
    expect(redacted.password).toBe("[REDACTED]");
    expect(redacted.session_token).toBe("[REDACTED]");

    const nested = redacted.details as Record<string, unknown>;
    expect(nested.authSecret).toBe("[REDACTED]");
    expect(nested.apiKey).toBe("[REDACTED]");
    expect(nested.normalField).toBe("public-value");
  });

  it("redacts credentials inside connection string messages", () => {
    const rawMsg =
      "Connecting to postgresql://admin:super_secret_db_pass@db.internal:5432/db";
    const redacted = redactSensitiveData(rawMsg);

    expect(redacted).toBe(
      "Connecting to postgresql://admin:****@db.internal:5432/db",
    );
    expect(redacted).not.toContain("super_secret_db_pass");
  });

  it("creates logger instances with request correlation IDs", () => {
    const baseLogger = new Logger("info");
    const reqLogger = baseLogger.withRequestId("req-xyz-123");

    expect(reqLogger).toBeInstanceOf(Logger);
  });

  it("sanitizes database error messages and stack traces for client presentation", () => {
    const dbError = new Error(
      "Failed query: SELECT * FROM \"users\" WHERE password = '123'",
    );
    const sanitized = formatSanitizedError(dbError);

    expect(sanitized).toBe("An internal error occurred.");
    expect(sanitized).not.toContain("SELECT");
    expect(sanitized).not.toContain("password");

    const domainError = new Error("Invalid project stage selection.");
    expect(formatSanitizedError(domainError)).toBe(
      "Invalid project stage selection.",
    );
  });
});
