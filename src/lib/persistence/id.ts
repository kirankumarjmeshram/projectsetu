import { randomUUID } from "node:crypto";

/**
 * Generates a new unique identifier for persistence entities.
 *
 * Uses Node's built-in crypto.randomUUID() backed by PostgreSQL UUID columns.
 * The returned string is compatible with the domain Identifier contract.
 */
export function generateId(): string {
  return randomUUID();
}
