"use server";

import { revalidatePath } from "next/cache";

import { liveProgramDefinitions } from "@/domain/schemes/programs";
import { SCHEME_UI_DESCRIPTORS } from "@/features/schemes/registry";
import { requireAdmin } from "@/lib/auth/authorization";
import { getDb } from "@/lib/persistence/db";
import {
  PgAdminAuditRepository,
  PgProjectRepository,
  PgUserRepository,
} from "@/lib/persistence/repositories";

/**
 * Returns system-wide statistics for the admin dashboard.
 */
export async function adminGetStatsAction() {
  try {
    await requireAdmin();
    const db = getDb();

    const userRepo = new PgUserRepository(db);
    const projectRepo = new PgProjectRepository(db);

    const users = await userRepo.findAll();
    const projects = await projectRepo.findAll();

    // Total stats
    const totalUsers = users.length;
    const adminUsers = users.filter((u) => u.role === "ADMIN").length;
    const totalProjects = projects.length;
    const bankableProjects = projects.filter(
      (p) => p.mode === "BANKABLE",
    ).length;
    const subsidyProjects = projects.filter((p) => p.mode === "SUBSIDY").length;
    const selfFundedProjects = projects.filter(
      (p) => p.mode === "SELF_FUNDED",
    ).length;

    return {
      success: true,
      stats: {
        totalUsers,
        adminUsers,
        totalProjects,
        bankableProjects,
        subsidyProjects,
        selfFundedProjects,
        totalRegisteredSchemes: SCHEME_UI_DESCRIPTORS.length,
      },
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Lists all registered users (excluding password hashes).
 */
export async function adminListUsersAction() {
  try {
    await requireAdmin();
    const db = getDb();
    const userRepo = new PgUserRepository(db);
    const users = await userRepo.findAll();

    // Sanitize user records
    const safeUsers = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));

    return { success: true, users: safeUsers };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Updates a user's role (USER <-> ADMIN) and logs an audit record.
 */
export async function adminUpdateUserRoleAction(
  targetUserId: string,
  newRole: "USER" | "ADMIN",
) {
  try {
    const admin = await requireAdmin();
    const db = getDb();
    const userRepo = new PgUserRepository(db);
    const auditRepo = new PgAdminAuditRepository(db);

    const targetUser = await userRepo.findById(targetUserId);
    if (!targetUser) {
      return { success: false, error: "Target user not found." };
    }

    const previousRole = targetUser.role;
    const updated = await userRepo.updateRole(targetUserId, newRole);

    await auditRepo.create({
      actorUserId: admin.id,
      action: "UPDATE_USER_ROLE",
      entityType: "USER",
      entityId: targetUserId,
      metadata: {
        targetUserEmail: targetUser.email,
        previousRole,
        newRole,
      },
    });

    revalidatePath("/admin");
    return { success: true, user: updated };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Toggles a user's active status (Deactivate / Reactivate) and logs an audit record.
 */
export async function adminToggleUserStatusAction(
  targetUserId: string,
  isActive: boolean,
) {
  try {
    const admin = await requireAdmin();
    const db = getDb();
    const userRepo = new PgUserRepository(db);
    const auditRepo = new PgAdminAuditRepository(db);

    const targetUser = await userRepo.findById(targetUserId);
    if (!targetUser) {
      return { success: false, error: "Target user not found." };
    }

    // Prevent admin from deactivating themselves
    if (admin.id === targetUserId && !isActive) {
      return {
        success: false,
        error: "Administrators cannot deactivate their own account.",
      };
    }

    const updated = await userRepo.updateActiveStatus(targetUserId, isActive);

    await auditRepo.create({
      actorUserId: admin.id,
      action: isActive ? "ACTIVATE_USER" : "DEACTIVATE_USER",
      entityType: "USER",
      entityId: targetUserId,
      metadata: {
        targetUserEmail: targetUser.email,
        isActive,
      },
    });

    revalidatePath("/admin");
    return { success: true, user: updated };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Lists all projects across tenants with owner email and metadata.
 */
export async function adminListProjectsAction() {
  try {
    await requireAdmin();
    const db = getDb();
    const projectRepo = new PgProjectRepository(db);
    const userRepo = new PgUserRepository(db);

    const projects = await projectRepo.findAll();
    const users = await userRepo.findAll();
    const userMap = new Map(users.map((u) => [u.id, u.email]));

    const enriched = projects.map((p) => ({
      ...p,
      ownerEmail: p.ownerId
        ? userMap.get(p.ownerId) || "Unknown User"
        : "Unassigned / Legacy",
    }));

    return { success: true, projects: enriched };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Inspects all registered government scheme definitions, versions, and lifecycle status.
 */
export async function adminGetSchemeRegistryAction() {
  try {
    await requireAdmin();

    const schemes = SCHEME_UI_DESCRIPTORS.map((descriptor) => {
      const defs = liveProgramDefinitions.filter(
        (def) => def.programId === descriptor.programId,
      );

      return {
        id: descriptor.programId,
        name: descriptor.name,
        shortName: descriptor.code,
        ministry: descriptor.sponsoringAgency,
        level: descriptor.category,
        jurisdiction: descriptor.category.startsWith("STATE")
          ? "State (Maharashtra)"
          : "Central (India)",
        targetBeneficiaries: descriptor.eligibleSectors,
        assistanceType: [descriptor.subsidyRateDescription],
        currentVersionId: defs[0]?.versionId || "v1.0",
        versions: defs.map((v) => ({
          versionId: v.versionId,
          guidelineName:
            v.sourceReferences[0]?.documentTitle || descriptor.name,
          guidelineDate: v.effectiveFrom,
          effectiveFrom: v.effectiveFrom,
          effectiveTo: v.effectiveTo,
          status: v.status,
          sourceAuthority:
            v.sourceReferences[0]?.authority || descriptor.sponsoringAgency,
          sourceUrl: v.sourceReferences[0]?.sourceUrl,
          keyRulesSummary: [
            descriptor.shortSummary,
            `Max Project Cost: ${descriptor.maxProjectCost}`,
            descriptor.subsidyRateDescription,
          ],
        })),
      };
    });

    return { success: true, schemes };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Lists recent admin audit logs.
 */
export async function adminListAuditLogsAction(limit: number = 50) {
  try {
    await requireAdmin();
    const db = getDb();
    const auditRepo = new PgAdminAuditRepository(db);
    const userRepo = new PgUserRepository(db);

    const logs = await auditRepo.findAll(limit);
    const users = await userRepo.findAll();
    const userMap = new Map(users.map((u) => [u.id, u.email]));

    const enriched = logs.map((l) => ({
      ...l,
      actorEmail: userMap.get(l.actorUserId) || "System / Unknown",
    }));

    return { success: true, logs: enriched };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Runs a safe system health and latency diagnosis.
 */
export async function adminGetSystemHealthAction() {
  try {
    await requireAdmin();
    const startTime = Date.now();
    const db = getDb();

    // Ping PostgreSQL
    const projectRepo = new PgProjectRepository(db);
    await projectRepo.findAll();
    const dbLatencyMs = Date.now() - startTime;

    const memoryUsage = process.memoryUsage();

    return {
      success: true,
      health: {
        status: "HEALTHY",
        uptimeSeconds: Math.floor(process.uptime()),
        dbLatencyMs,
        memoryUsageRssMb: Math.round(memoryUsage.rss / 1024 / 1024),
        memoryUsageHeapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
