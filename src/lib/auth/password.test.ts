import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("Password Hashing & Verification", () => {
  it("hashes password and verifies successfully with correct password", async () => {
    const password = "SuperSecretPassword123!";
    const hash = await hashPassword(password);

    expect(hash).toContain(":");
    expect(hash.split(":")[0]).toHaveLength(32); // 16 bytes in hex = 32 chars
    expect(hash.split(":")[1]).toHaveLength(128); // 64 bytes in hex = 128 chars

    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it("rejects verification with wrong password", async () => {
    const password = "SuperSecretPassword123!";
    const hash = await hashPassword(password);

    const isValid = await verifyPassword("WrongPassword!", hash);
    expect(isValid).toBe(false);
  });

  it("generates distinct salts for identical passwords", async () => {
    const password = "SamePasswordAcrossUsers";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);
    expect(hash1.split(":")[0]).not.toBe(hash2.split(":")[0]);

    expect(await verifyPassword(password, hash1)).toBe(true);
    expect(await verifyPassword(password, hash2)).toBe(true);
  });

  it("safely handles malformed hashes and empty inputs", async () => {
    expect(await verifyPassword("pwd", "")).toBe(false);
    expect(await verifyPassword("pwd", "malformed")).toBe(false);
    expect(await verifyPassword("pwd", "invalid:hex:parts")).toBe(false);
    expect(await verifyPassword("", "salt:hash")).toBe(false);
  });
});
