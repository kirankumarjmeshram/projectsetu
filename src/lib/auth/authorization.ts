import type { PersistedProject } from "../persistence/repositories";
import type { AuthUser } from "./contracts";
import { getCurrentUser } from "./session";

export class UnauthorizedError extends Error {
  constructor(message: string = "Authentication required. Please sign in.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(
    message: string = "Access denied. You do not have permission to perform this action.",
  ) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class ProjectNotFoundError extends Error {
  constructor(projectId: string) {
    super(`Project with ID ${projectId} not found.`);
    this.name = "ProjectNotFoundError";
  }
}

/**
 * Checks whether a user has read access to a project.
 * Rules:
 * 1. ADMIN users can access all projects.
 * 2. Regular users can access projects they own.
 * 3. Unowned projects (transitional / demo data where ownerId is null) are accessible by all authenticated users.
 */
export function canAccessProject(
  user: AuthUser,
  project: PersistedProject,
): boolean {
  if (user.role === "ADMIN") {
    return true;
  }

  if (!project.ownerId) {
    return true;
  }

  return project.ownerId === user.id;
}

/**
 * Checks whether a user has write/mutation access to a project.
 * Rules:
 * 1. ADMIN users can mutate all projects.
 * 2. Regular users can mutate only projects they own (or claim an unowned project).
 */
export function canMutateProject(
  user: AuthUser,
  project: PersistedProject,
): boolean {
  if (user.role === "ADMIN") {
    return true;
  }

  if (!project.ownerId) {
    return true;
  }

  return project.ownerId === user.id;
}

/**
 * Enforces that the current request has an active authenticated session.
 * Throws UnauthorizedError if unauthenticated.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

/**
 * Enforces that the current request has an active administrator session.
 * Throws UnauthorizedError if unauthenticated or ForbiddenError if not ADMIN.
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role !== "ADMIN") {
    throw new ForbiddenError(
      "Administrator privilege required to access this resource.",
    );
  }
  return user;
}
