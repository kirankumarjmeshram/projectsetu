"use server";

import { revalidatePath } from "next/cache";

import type {
  AuthCredentials,
  AuthResult,
  AuthUser,
  CreateUserInput,
} from "@/lib/auth/contracts";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { seedDefaultUsers } from "@/lib/auth/seed-users";
import {
  clearSessionCookie,
  createSession,
  getCurrentUser,
  setSessionCookie,
} from "@/lib/auth/session";
import { getAppConfig } from "@/lib/env";
import { formatSanitizedError, logger } from "@/lib/logging/logger";
import { getDb } from "@/lib/persistence/db";
import {
  PgSessionRepository,
  PgUserRepository,
} from "@/lib/persistence/repositories";
import { authRateLimiter } from "@/lib/security/rate-limiter";

/**
 * Signs in a user with email and password.
 */
export async function signInAction(
  credentials: AuthCredentials,
): Promise<AuthResult> {
  const normalizedEmail = credentials.email.toLowerCase().trim();

  // Rate limiting against brute force attempts
  const config = getAppConfig();
  if (config.enableRateLimit) {
    const rateLimit = authRateLimiter.check(normalizedEmail);
    if (!rateLimit.allowed) {
      const waitSeconds = Math.ceil(rateLimit.resetAfterMs / 1000);
      logger.warn("Sign in rate limit exceeded", { email: normalizedEmail });
      return {
        success: false,
        error: `Too many sign-in attempts. Please try again in ${waitSeconds} second(s).`,
      };
    }
  }

  try {
    const db = getDb();
    if (config.allowDevSeed || config.nodeEnv !== "production") {
      await seedDefaultUsers(db); // Ensure demo users exist if dev
    }

    const userRepo = new PgUserRepository(db);
    const userRow = await userRepo.findByEmail(normalizedEmail);

    if (!userRow) {
      return { success: false, error: "Invalid email or password." };
    }

    if (!userRow.isActive) {
      return {
        success: false,
        error:
          "Your account has been deactivated. Please contact an administrator.",
      };
    }

    const isMatch = await verifyPassword(
      credentials.password,
      userRow.passwordHash,
    );
    if (!isMatch) {
      return { success: false, error: "Invalid email or password." };
    }

    // Reset rate limiter on successful authentication
    if (config.enableRateLimit) {
      authRateLimiter.reset(normalizedEmail);
    }

    const { token, expiresAt } = await createSession(userRow.id);
    await setSessionCookie(token, expiresAt);

    const user: AuthUser = {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      role: userRow.role,
      isActive: userRow.isActive,
      createdAt: userRow.createdAt,
      updatedAt: userRow.updatedAt,
    };

    logger.info("User signed in successfully", {
      userId: user.id,
      role: user.role,
    });
    revalidatePath("/");
    return { success: true, user };
  } catch (error) {
    logger.error("Sign in action failed", error);
    return {
      success: false,
      error: formatSanitizedError(
        error,
        "An unexpected error occurred during sign in.",
      ),
    };
  }
}

/**
 * Signs up a new user with email, name, and password.
 */
export async function signUpAction(
  input: CreateUserInput,
): Promise<AuthResult> {
  const normalizedEmail = input.email.toLowerCase().trim();

  try {
    const db = getDb();
    const userRepo = new PgUserRepository(db);

    const existing = await userRepo.findByEmail(normalizedEmail);
    if (existing) {
      return {
        success: false,
        error: "An account with this email address already exists.",
      };
    }

    if (!input.password || input.password.length < 8) {
      return {
        success: false,
        error: "Password must be at least 8 characters long.",
      };
    }

    const passwordHash = await hashPassword(input.password);
    const userRow = await userRepo.create({
      email: normalizedEmail,
      name: input.name.trim(),
      passwordHash,
      role: "USER",
      isActive: true,
    });

    const { token, expiresAt } = await createSession(userRow.id);
    await setSessionCookie(token, expiresAt);

    const user: AuthUser = {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      role: userRow.role,
      isActive: userRow.isActive,
      createdAt: userRow.createdAt,
      updatedAt: userRow.updatedAt,
    };

    logger.info("User signed up successfully", { userId: user.id });
    revalidatePath("/");
    return { success: true, user };
  } catch (error) {
    logger.error("Sign up action failed", error);
    return {
      success: false,
      error: formatSanitizedError(
        error,
        "An unexpected error occurred during registration.",
      ),
    };
  }
}

/**
 * Signs out the currently authenticated user.
 */
export async function signOutAction(): Promise<{ success: boolean }> {
  try {
    const user = await getCurrentUser();
    if (user) {
      const db = getDb();
      const sessionRepo = new PgSessionRepository(db);
      await sessionRepo.deleteByUserId(user.id);
      logger.info("User signed out", { userId: user.id });
    }

    await clearSessionCookie();
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    logger.error("Sign out action failed", error);
    await clearSessionCookie();
    return { success: true };
  }
}

/**
 * Server action to get the currently authenticated user profile.
 */
export async function getCurrentUserAction(): Promise<AuthUser | null> {
  return getCurrentUser();
}
