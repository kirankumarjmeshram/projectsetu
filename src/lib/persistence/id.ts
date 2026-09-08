/**
 * Generates a new unique identifier for persistence entities.
 *
 * Uses the Web Crypto API shared by modern browsers and Node.js. The returned
 * string is compatible with PostgreSQL UUID columns and the domain Identifier
 * contract without pulling a Node-only module into client components.
 */
export function generateId(): string {
  return globalThis.crypto.randomUUID();
}
