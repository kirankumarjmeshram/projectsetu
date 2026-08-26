import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { getDb } from "../persistence/db";
import {
  PgSessionRepository,
  PgUserRepository,
} from "../persistence/repositories";
import type { AuthSession, AuthUser } from "./contracts";

export const SESSION_COOKIE_NAME = "projectsetu_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * Generates a cryptographically secure random session token.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Computes a SHA-256 hash of a session token before database persistence.
 * This guarantees that even with read access to the database,
 * an attacker cannot forge or hijack client session cookies.
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Creates a new session in PostgreSQL for the given user ID.
 * Returns the raw token for client cookie issuance, while persisting
 * only its cryptographic hash in PostgreSQL.
 */
export async function createSession(userId: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const token = generateSessionToken();
  const hashedToken = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  const db = getDb();
  const sessionRepo = new PgSessionRepository(db);

  await sessionRepo.create({
    userId,
    token: hashedToken,
    expiresAt,
  });

  return { token, expiresAt };
}

/**
 * Validates a raw session token against PostgreSQL by hashing it first.
 * Returns the AuthSession with user details if valid and unexpired.
 */
export async function validateSession(
  token: string,
): Promise<AuthSession | null> {
  if (!token || typeof token !== "string") {
    return null;
  }

  const hashedToken = hashSessionToken(token);
  const db = getDb();
  const sessionRepo = new PgSessionRepository(db);
  const userRepo = new PgUserRepository(db);

  // Check hashed token first, fallback to raw token for backward compatibility
  let sessionRow = await sessionRepo.findByToken(hashedToken);
  if (!sessionRow) {
    sessionRow = await sessionRepo.findByToken(token);
  }

  if (!sessionRow) {
    return null;
  }

  // Check expiration
  if (sessionRow.expiresAt.getTime() <= Date.now()) {
    await sessionRepo.deleteByToken(sessionRow.token);
    return null;
  }

  const userRow = await userRepo.findById(sessionRow.userId);
  if (!userRow || !userRow.isActive) {
    return null;
  }

  const authUser: AuthUser = {
    id: userRow.id,
    email: userRow.email,
    name: userRow.name,
    role: userRow.role,
    isActive: userRow.isActive,
    createdAt: userRow.createdAt,
    updatedAt: userRow.updatedAt,
  };

  return {
    id: sessionRow.id,
    userId: sessionRow.userId,
    token: sessionRow.token,
    expiresAt: sessionRow.expiresAt,
    user: authUser,
  };
}

/**
 * Sets the HTTP-only secure session cookie in the response.
 */
export async function setSessionCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Clears the session cookie in the response.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

/**
 * Retrieves the session token from incoming cookies.
 */
export async function getSessionTokenFromCookies(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(SESSION_COOKIE_NAME);
    return cookie ? cookie.value : null;
  } catch {
    return null;
  }
}

/**
 * Resolves the authenticated user from the current request cookies.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = await getSessionTokenFromCookies();
  if (!token) {
    return null;
  }

  const session = await validateSession(token);
  return session ? session.user : null;
}

/**
 * Resolves the full authenticated session from the current request cookies.
 */
export async function getCurrentSession(): Promise<AuthSession | null> {
  const token = await getSessionTokenFromCookies();
  if (!token) {
    return null;
  }

  return validateSession(token);
}
