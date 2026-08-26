/**
 * Structured Production Logging and Observability.
 *
 * Implements structured JSON logging with automatic redaction of sensitive
 * credentials (passwords, tokens, database URLs, session secrets, API keys).
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "password_hash",
  "token",
  "sessiontoken",
  "session_token",
  "secret",
  "authsecret",
  "auth_secret",
  "cookie",
  "cookies",
  "authorization",
  "databaseurl",
  "database_url",
  "apikey",
  "api_key",
  "privatekey",
  "private_key",
]);

/**
 * Deeply scrubs sensitive fields from log metadata.
 */
export function redactSensitiveData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "string") {
    // Redact connection strings with credentials
    return data.replace(/([a-zA-Z]+:\/\/[^:]+:)[^@]+(@)/g, "$1****$2");
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item));
  }

  if (typeof data === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (SENSITIVE_KEYS.has(normalizedKey)) {
        cleaned[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        cleaned[key] = redactSensitiveData(value);
      } else if (typeof value === "string") {
        cleaned[key] = redactSensitiveData(value);
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  return data;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export class Logger {
  constructor(
    private readonly minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ||
      "info",
    private readonly requestId?: string,
  ) {}

  withRequestId(requestId: string): Logger {
    return new Logger(this.minLevel, requestId);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log("warn", message, context);
  }

  error(
    message: string,
    error?: Error | unknown,
    context?: Record<string, unknown>,
  ): void {
    const errObj =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack:
              process.env.NODE_ENV === "production" ? undefined : error.stack,
          }
        : error
          ? { name: "Error", message: String(error) }
          : undefined;

    this.log("error", message, context, errObj);
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: { name: string; message: string; stack?: string },
  ): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: String(redactSensitiveData(message)),
      requestId: this.requestId,
      context: context
        ? (redactSensitiveData(context) as Record<string, unknown>)
        : undefined,
      error,
    };

    if (process.env.NODE_ENV === "production") {
      const output = JSON.stringify(entry);
      if (level === "error") {
        console.error(output);
      } else if (level === "warn") {
        console.warn(output);
      } else {
        console.log(output);
      }
    } else {
      const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]${
        this.requestId ? ` [req:${this.requestId}]` : ""
      }: ${entry.message}`;
      if (level === "error") {
        console.error(prefix, entry.context || "", entry.error || "");
      } else if (level === "warn") {
        console.warn(prefix, entry.context || "");
      } else {
        console.log(prefix, entry.context || "");
      }
    }
  }
}

/** Global application logger singleton. */
export const logger = new Logger();

/**
 * Sanitizes errors for safe return to clients without leaking system internals.
 */
export function formatSanitizedError(
  error: unknown,
  fallbackMessage = "An internal error occurred.",
): string {
  if (!error) return fallbackMessage;
  if (typeof error === "string") return error;
  if (error instanceof Error) {
    // If it's a known user-facing or domain error message, return it
    const msg = error.message;
    if (
      msg.includes("password") ||
      msg.includes("credential") ||
      msg.includes("postgres") ||
      msg.includes("SELECT ") ||
      msg.includes("INSERT ") ||
      msg.includes("UPDATE ") ||
      msg.includes("DELETE ")
    ) {
      return fallbackMessage;
    }
    return msg;
  }
  return fallbackMessage;
}
