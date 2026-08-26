import { describe, expect, it } from "vitest";

import { generateSessionToken, hashSessionToken } from "./session";

describe("Session Token Hashing & Hardening", () => {
  it("generates 64-character hex tokens with high entropy", () => {
    const token1 = generateSessionToken();
    const token2 = generateSessionToken();

    expect(token1).toHaveLength(64);
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);
  });

  it("produces deterministic SHA-256 hash for database storage", () => {
    const rawToken =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const hash1 = hashSessionToken(rawToken);
    const hash2 = hashSessionToken(rawToken);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
    expect(hash1).not.toBe(rawToken);
  });

  it("produces distinct hashes for different raw tokens", () => {
    const hashA = hashSessionToken("token-a");
    const hashB = hashSessionToken("token-b");

    expect(hashA).not.toBe(hashB);
  });
});
