import { describe, expect, it } from "vitest";

import { canAccessProject, canMutateProject } from "./authorization";
import type { AuthUser } from "./contracts";
import type { PersistedProject } from "../persistence/repositories";

describe("Security & IDOR Isolation Test Suite", () => {
  const victimUser: AuthUser = {
    id: "user-victim-uuid",
    email: "victim@example.com",
    name: "Victim Entrepreneur",
    role: "USER",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const attackerUser: AuthUser = {
    id: "user-attacker-uuid",
    email: "attacker@example.com",
    name: "Malicious Actor",
    role: "USER",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const adminUser: AuthUser = {
    id: "user-admin-uuid",
    email: "admin@example.test",
    name: "Platform Administrator",
    role: "ADMIN",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const victimProject: PersistedProject = {
    id: "proj-victim-777",
    name: "Secret Proprietary Solar Farm",
    mode: "BANKABLE",
    industryActivity: "Renewable Energy",
    stage: "PLANNING",
    status: "DRAFT",
    areaClassification: "RURAL",
    location: null,
    projectionPeriodYears: 7,
    implementationFrom: null,
    implementationUntil: null,
    currentInputSnapshotId: null,
    ownerId: victimUser.id,
    revision: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("prevents IDOR: Attacker cannot access victim project", () => {
    const isAllowed = canAccessProject(attackerUser, victimProject);
    expect(isAllowed).toBe(false);
  });

  it("prevents IDOR: Attacker cannot mutate victim project", () => {
    const isAllowed = canMutateProject(attackerUser, victimProject);
    expect(isAllowed).toBe(false);
  });

  it("permits Owner: Victim can read and mutate their own project", () => {
    expect(canAccessProject(victimUser, victimProject)).toBe(true);
    expect(canMutateProject(victimUser, victimProject)).toBe(true);
  });

  it("permits Admin: Platform admin can read and manage all tenant projects", () => {
    expect(canAccessProject(adminUser, victimProject)).toBe(true);
    expect(canMutateProject(adminUser, victimProject)).toBe(true);
  });
});
