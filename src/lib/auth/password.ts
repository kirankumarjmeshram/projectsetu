import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const KEY_LEN = 64;
const SALT_LEN = 16;

/**
 * Securely hashes a plaintext password using scrypt with a cryptographically secure random salt.
 * Output format: `saltHex:derivedKeyHex`
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== "string") {
    throw new Error("Password must be a non-empty string");
  }

  const salt = randomBytes(SALT_LEN);
  const derivedKey = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;

  return `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

/**
 * Verifies a plaintext password against a stored `salt:hash` string using constant-time comparison.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  if (!password || !storedHash || typeof storedHash !== "string") {
    return false;
  }

  const parts = storedHash.split(":");
  if (parts.length !== 2) {
    return false;
  }

  const [saltHex, keyHex] = parts;
  if (!saltHex || !keyHex) {
    return false;
  }

  try {
    const salt = Buffer.from(saltHex, "hex");
    const storedKey = Buffer.from(keyHex, "hex");

    if (storedKey.length !== KEY_LEN) {
      return false;
    }

    const derivedKey = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;

    return timingSafeEqual(storedKey, derivedKey);
  } catch {
    return false;
  }
}
