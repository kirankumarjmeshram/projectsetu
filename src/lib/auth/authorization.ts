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
 * 3. Unowned transitional projects are accessible only to administrators.
 */
export function canAccessProject(
  user: AuthUser,
  project: PersistedProject,
): boolean {
  if (user.role === "ADMIN") {
    return true;
  }

  return Boolean(project.ownerId) && project.ownerId === user.id;
}

/**
 * Checks whether a user has write/mutation access to a project.
 * Rules:
 * 1. ADMIN users can mutate all projects.
 * 2. Regular users can mutate only projects they own.
 */
export function canMutateProject(
  user: AuthUser,
  project: PersistedProject,
): boolean {
  if (user.role === "ADMIN") {
    return true;
  }

  return Boolean(project.ownerId) && project.ownerId === user.id;
}

/** Prevents browser-supplied resource IDs from being cross-linked to a project. */
export function belongsToProject(
  resource: { readonly projectId: string },
  projectId: string,
): boolean {
  return resource.projectId === projectId;
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
