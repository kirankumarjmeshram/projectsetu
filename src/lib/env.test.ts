import { describe, expect, it } from "vitest";

import { ConfigurationError, validateEnv } from "./env";

describe("Environment Configuration Validation", () => {
  it("validates successful development configuration with defaults", () => {
    const config = validateEnv({
      NODE_ENV: "development",
    });

    expect(config.nodeEnv).toBe("development");
    expect(config.port).toBe(3000);
    expect(config.logLevel).toBe("info");
    expect(config.databaseUrl).toBeTruthy();
    expect(config.authSecret).toBeTruthy();
  });

  it("validates full valid production configuration", () => {
    const config = validateEnv({
      NODE_ENV: "production",
      APP_URL: "https://projectsetu.org",
      PORT: "8080",
      DATABASE_URL:
        "postgresql://app_user:strongpassword@db.internal:5432/projectsetu",
      AUTH_SECRET: "a-very-long-production-cryptographic-secret-key-32-bytes",
      DB_POOL_MAX: "50",
      DB_SSL: "true",
    });

    expect(config.nodeEnv).toBe("production");
    expect(config.appUrl).toBe("https://projectsetu.org");
    expect(config.port).toBe(8080);
    expect(config.dbPoolMax).toBe(50);
    expect(config.dbSsl).toBe(true);
    expect(config.dbSslRejectUnauthorized).toBe(true);
  });

  it("fails fast in production when DATABASE_URL is missing", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        AUTH_SECRET: "valid-secret-key-that-is-long-enough",
      }),
    ).toThrowError(ConfigurationError);
  });

  it("fails fast in production when AUTH_SECRET is missing or too short", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://user:pass@host:5432/db",
      }),
    ).toThrowError(ConfigurationError);

    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://user:pass@host:5432/db",
        AUTH_SECRET: "short",
      }),
    ).toThrowError(ConfigurationError);
  });

  it("fails fast when PORT is invalid", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "development",
        PORT: "not-a-number",
      }),
    ).toThrowError(ConfigurationError);

    expect(() =>
      validateEnv({
        NODE_ENV: "development",
        PORT: "70000",
      }),
    ).toThrowError(ConfigurationError);
  });

  it("fails fast when DATABASE_URL protocol is not postgresql", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "development",
        DATABASE_URL: "mysql://user:pass@localhost:3306/db",
      }),
    ).toThrowError(ConfigurationError);
  });

  it("never includes passwords or secret values in error messages", () => {
    try {
      validateEnv({
        NODE_ENV: "production",
        DATABASE_URL: "invalid-url",
        AUTH_SECRET: "secret-token-value-12345",
        PORT: "99999",
      });
      expect.unreachable("Should have thrown ConfigurationError");
    } catch (err) {
      const message = (err as Error).message;
      expect(message).not.toContain("secret-token-value-12345");
      expect(message).toContain("Environment validation failed");
    }
  });
});
