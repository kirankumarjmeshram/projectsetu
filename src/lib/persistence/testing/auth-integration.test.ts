import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { hashPassword } from "@/lib/auth/password";
import {
  PgAdminAuditRepository,
  PgProjectRepository,
  PgSessionRepository,
  PgUserRepository,
} from "../repositories";
import {
  closeTestPool,
  createTestTransaction,
  isTestDatabaseAvailable,
  type TestTransactionContext,
} from "./test-db";

describe("PostgreSQL Auth & Ownership Integration Tests", () => {
  let ctx: TestTransactionContext;
  let isDbUp = false;

  beforeEach(async () => {
    isDbUp = await isTestDatabaseAvailable();
    if (isDbUp) {
      ctx = await createTestTransaction();
    }
  });

  afterEach(async () => {
    if (ctx) {
      await ctx.rollback();
    }
  });

  afterAll(async () => {
    await closeTestPool();
  });

  it("creates, queries, and updates users in PostgreSQL", async () => {
    if (!isDbUp) return;

    const userRepo = new PgUserRepository(ctx.db);
    const pwdHash = await hashPassword("TestPass123!");

    const user = await userRepo.create({
      email: "testuser@example.com",
      name: "Integration Test User",
      passwordHash: pwdHash,
      role: "USER",
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe("testuser@example.com");
    expect(user.role).toBe("USER");
    expect(user.isActive).toBe(true);

    const byEmail = await userRepo.findByEmail("testuser@example.com");
    expect(byEmail).not.toBeNull();
    expect(byEmail?.id).toBe(user.id);

    const updatedRole = await userRepo.updateRole(user.id, "ADMIN");
    expect(updatedRole?.role).toBe("ADMIN");

    const updatedStatus = await userRepo.updateActiveStatus(user.id, false);
    expect(updatedStatus?.isActive).toBe(false);
  });

  it("creates, queries, and manages sessions in PostgreSQL", async () => {
    if (!isDbUp) return;

    const userRepo = new PgUserRepository(ctx.db);
    const sessionRepo = new PgSessionRepository(ctx.db);

    const user = await userRepo.create({
      email: "sessionuser@example.com",
      name: "Session User",
      passwordHash: "dummyhash",
    });

    const token = "secure-random-test-token-12345";
    const expiresAt = new Date(Date.now() + 3600 * 1000);

    const session = await sessionRepo.create({
      userId: user.id,
      token,
      expiresAt,
    });

    expect(session.id).toBeDefined();
    expect(session.userId).toBe(user.id);

    const fetched = await sessionRepo.findByToken(token);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(session.id);

    const deleted = await sessionRepo.deleteByToken(token);
    expect(deleted).toBe(true);

    const notFound = await sessionRepo.findByToken(token);
    expect(notFound).toBeNull();
  });

  it("enforces tenant project ownership isolation in PostgreSQL", async () => {
    if (!isDbUp) return;

    const userRepo = new PgUserRepository(ctx.db);
    const projectRepo = new PgProjectRepository(ctx.db);

    const userA = await userRepo.create({
      email: "owner_a@example.com",
      name: "Owner A",
      passwordHash: "hashA",
    });

    const userB = await userRepo.create({
      email: "owner_b@example.com",
      name: "Owner B",
      passwordHash: "hashB",
    });

    const projA = await projectRepo.create({
      name: "Project of User A",
      mode: "BANKABLE",
      industryActivity: "Manufacturing",
      stage: "PLANNING",
      projectionPeriodYears: 5,
      ownerId: userA.id,
    });

    const projB = await projectRepo.create({
      name: "Project of User B",
      mode: "SUBSIDY",
      industryActivity: "Agro Processing",
      stage: "PLANNING",
      projectionPeriodYears: 5,
      ownerId: userB.id,
    });

    expect(projA.ownerId).toBe(userA.id);
    expect(projB.ownerId).toBe(userB.id);

    const projectsOfA = await projectRepo.findByOwnerId(userA.id);
    expect(projectsOfA).toHaveLength(1);
    expect(projectsOfA[0].id).toBe(projA.id);

    const projectsOfB = await projectRepo.findByOwnerId(userB.id);
    expect(projectsOfB).toHaveLength(1);
    expect(projectsOfB[0].id).toBe(projB.id);
  });

  it("records and queries administrative audit trail logs", async () => {
    if (!isDbUp) return;

    const userRepo = new PgUserRepository(ctx.db);
    const auditRepo = new PgAdminAuditRepository(ctx.db);

    const admin = await userRepo.create({
      email: "auditor@example.com",
      name: "Audit Admin",
      passwordHash: "hash",
      role: "ADMIN",
    });

    const log = await auditRepo.create({
      actorUserId: admin.id,
      action: "UPDATE_USER_ROLE",
      entityType: "USER",
      entityId: "some-user-uuid",
      metadata: { previousRole: "USER", newRole: "ADMIN" },
    });

    expect(log.id).toBeDefined();
    expect(log.actorUserId).toBe(admin.id);
    expect(log.action).toBe("UPDATE_USER_ROLE");

    const allLogs = await auditRepo.findAll(10);
    expect(allLogs.length).toBeGreaterThan(0);
    expect(allLogs[0].action).toBe("UPDATE_USER_ROLE");

    const filtered = await auditRepo.findByEntityType("USER", 10);
    expect(filtered.length).toBeGreaterThan(0);
  });
});
