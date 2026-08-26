/**
 * Environment configuration and startup validation.
 *
 * Enforces fail-fast configuration verification on production bootstrap
 * while providing safe developer defaults in development and testing environments.
 *
 * CRITICAL SECURITY GUARANTEE:
 * Never prints secret values (such as passwords, tokens, or raw DATABASE_URL)
 * to standard error or application logs.
 */

export interface AppConfig {
  readonly nodeEnv: "development" | "test" | "production";
  readonly appUrl: string;
  readonly appVersion: string;
  readonly port: number;
  readonly databaseUrl: string;
  readonly testDatabaseUrl?: string;
  readonly authSecret: string;
  readonly dbPoolMin: number;
  readonly dbPoolMax: number;
  readonly dbIdleTimeoutMs: number;
  readonly dbConnectionTimeoutMs: number;
  readonly dbSsl: boolean;
  readonly dbSslRejectUnauthorized: boolean;
  readonly logLevel: "debug" | "info" | "warn" | "error";
  readonly allowDevSeed: boolean;
  readonly enableRateLimit: boolean;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(`[ProjectSetu Configuration Error] ${message}`);
    this.name = "ConfigurationError";
  }
}

/**
 * Validates and parses environment variables.
 * Throws a sanitized `ConfigurationError` if required production variables are missing.
 */
export function validateEnv(
  env: Record<string, string | undefined> = process.env,
): AppConfig {
  const rawNodeEnv = (env.NODE_ENV || "development").toLowerCase();
  const nodeEnv: "development" | "test" | "production" =
    rawNodeEnv === "production"
      ? "production"
      : rawNodeEnv === "test"
        ? "test"
        : "development";

  const isProduction = nodeEnv === "production";
  const errors: string[] = [];

  // Database URL
  let databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    if (isProduction) {
      errors.push(
        "DATABASE_URL is required in production. Must be a valid PostgreSQL connection string.",
      );
    } else {
      // Local development fallback
      databaseUrl =
        env.TEST_DATABASE_URL?.trim() ||
        "postgresql://postgres:password@127.0.0.1:5433/projectsetu_test";
    }
  } else if (
    !databaseUrl.startsWith("postgres://") &&
    !databaseUrl.startsWith("postgresql://")
  ) {
    errors.push(
      "DATABASE_URL must start with 'postgresql://' or 'postgres://'.",
    );
  }

  // Auth Secret
  let authSecret = env.AUTH_SECRET?.trim() || env.SESSION_SECRET?.trim();
  if (!authSecret) {
    if (isProduction) {
      errors.push(
        "AUTH_SECRET (or SESSION_SECRET) is required in production. Provide a cryptographically secure 32+ character key.",
      );
    } else {
      authSecret =
        "projectsetu-development-secret-key-do-not-use-in-production";
    }
  } else if (isProduction && authSecret.length < 16) {
    errors.push(
      "AUTH_SECRET must be at least 16 characters long in production.",
    );
  }

  // App URL
  const appUrl = env.APP_URL?.trim() || "http://localhost:3000";

  // Port
  const rawPort = env.PORT?.trim();
  const port = rawPort ? Number.parseInt(rawPort, 10) : 3000;
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    errors.push(
      `PORT must be a valid TCP port number (1-65535). Received: '${rawPort}'.`,
    );
  }

  // Database connection pool parameters
  const dbPoolMin = env.DB_POOL_MIN ? Number.parseInt(env.DB_POOL_MIN, 10) : 2;
  const dbPoolMax = env.DB_POOL_MAX ? Number.parseInt(env.DB_POOL_MAX, 10) : 20;
  const dbIdleTimeoutMs = env.DB_IDLE_TIMEOUT_MS
    ? Number.parseInt(env.DB_IDLE_TIMEOUT_MS, 10)
    : 10000;
  const dbConnectionTimeoutMs = env.DB_CONNECTION_TIMEOUT_MS
    ? Number.parseInt(env.DB_CONNECTION_TIMEOUT_MS, 10)
    : 5000;

  const dbSsl = env.DB_SSL === "true" || env.DB_SSL === "require";
  const dbSslRejectUnauthorized = env.DB_SSL_REJECT_UNAUTHORIZED !== "false";

  // Log level
  const rawLogLevel = (env.LOG_LEVEL || "info").toLowerCase();
  const logLevel: "debug" | "info" | "warn" | "error" =
    rawLogLevel === "debug" ||
    rawLogLevel === "info" ||
    rawLogLevel === "warn" ||
    rawLogLevel === "error"
      ? rawLogLevel
      : "info";

  const allowDevSeed = env.ALLOW_DEV_SEED === "true";
  const enableRateLimit = env.ENABLE_RATE_LIMIT !== "false";

  if (errors.length > 0) {
    throw new ConfigurationError(
      `Environment validation failed with ${errors.length} error(s):\n- ${errors.join("\n- ")}`,
    );
  }

  return {
    nodeEnv,
    appUrl,
    appVersion: env.APP_VERSION || "0.1.0",
    port,
    databaseUrl: databaseUrl!,
    testDatabaseUrl: env.TEST_DATABASE_URL?.trim(),
    authSecret: authSecret!,
    dbPoolMin: Number.isNaN(dbPoolMin) ? 2 : dbPoolMin,
    dbPoolMax: Number.isNaN(dbPoolMax) ? 20 : dbPoolMax,
    dbIdleTimeoutMs: Number.isNaN(dbIdleTimeoutMs) ? 10000 : dbIdleTimeoutMs,
    dbConnectionTimeoutMs: Number.isNaN(dbConnectionTimeoutMs)
      ? 5000
      : dbConnectionTimeoutMs,
    dbSsl,
    dbSslRejectUnauthorized,
    logLevel,
    allowDevSeed,
    enableRateLimit,
  };
}

let cachedConfig: AppConfig | null = null;

/**
 * Returns the cached, validated application configuration singleton.
 */
export function getAppConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = validateEnv();
  }
  return cachedConfig;
}

/** Resets cached config (useful in unit tests). */
export function resetAppConfigCache(): void {
  cachedConfig = null;
}
