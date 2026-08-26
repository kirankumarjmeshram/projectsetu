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
import { getDb } from "@/lib/persistence/db";
import {
  PgSessionRepository,
  PgUserRepository,
} from "@/lib/persistence/repositories";

/**
 * Signs in a user with email and password.
 */
export async function signInAction(
  credentials: AuthCredentials,
): Promise<AuthResult> {
  try {
    const db = getDb();
    await seedDefaultUsers(db); // Ensure demo users exist if first run

    const userRepo = new PgUserRepository(db);
    const userRow = await userRepo.findByEmail(credentials.email);

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

    revalidatePath("/");
    return { success: true, user };
  } catch (error) {
    console.error("Sign in failed:", error);
    return {
      success: false,
      error: "An unexpected error occurred during sign in.",
    };
  }
}

/**
 * Signs up a new user with email, name, and password.
 */
export async function signUpAction(
  input: CreateUserInput,
): Promise<AuthResult> {
  try {
    const db = getDb();
    const userRepo = new PgUserRepository(db);

    const existing = await userRepo.findByEmail(input.email);
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
      email: input.email,
      name: input.name,
      passwordHash,
      role: input.role ?? "USER",
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

    revalidatePath("/");
    return { success: true, user };
  } catch (error) {
    console.error("Sign up failed:", error);
    return {
      success: false,
      error: "An unexpected error occurred during registration.",
    };
  }
}

/**
 * Signs out the current user and clears session cookies.
 */
export async function signOutAction(): Promise<{ success: boolean }> {
  try {
    const user = await getCurrentUser();
    if (user) {
      const db = getDb();
      const sessionRepo = new PgSessionRepository(db);
      await sessionRepo.deleteByUserId(user.id);
    }
    await clearSessionCookie();
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Sign out error:", error);
    await clearSessionCookie();
    return { success: true };
  }
}

/**
 * Resolves current authenticated user from request session.
 */
export async function getCurrentUserAction(): Promise<AuthUser | null> {
  try {
    const db = getDb();
    await seedDefaultUsers(db);
    return getCurrentUser();
  } catch {
    return null;
  }
}
