import { describe, expect, it } from "vitest";

import type { PersistedProject } from "../persistence/repositories";
import { canAccessProject, canMutateProject } from "./authorization";
import type { AuthUser } from "./contracts";

describe("Authorization Policies", () => {
  const adminUser: AuthUser = {
    id: "admin-1",
    email: "admin@projectsetu.org",
    name: "Admin User",
    role: "ADMIN",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const userA: AuthUser = {
    id: "user-a",
    email: "user_a@example.com",
    name: "User A",
    role: "USER",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const userB: AuthUser = {
    id: "user-b",
    email: "user_b@example.com",
    name: "User B",
    role: "USER",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const projectOwnedByA: PersistedProject = {
    id: "proj-101",
    name: "User A Poultry Farm",
    mode: "BANKABLE",
    industryActivity: "Agro",
    stage: "PLANNING",
    status: "DRAFT",
    areaClassification: "RURAL",
    location: null,
    projectionPeriodYears: 5,
    implementationFrom: null,
    implementationUntil: null,
    currentInputSnapshotId: null,
    ownerId: "user-a",
    revision: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const projectUnowned: PersistedProject = {
    id: "proj-unowned",
    name: "Demo Project",
    mode: "BANKABLE",
    industryActivity: "Manufacturing",
    stage: "PLANNING",
    status: "DRAFT",
    areaClassification: "RURAL",
    location: null,
    projectionPeriodYears: 5,
    implementationFrom: null,
    implementationUntil: null,
    currentInputSnapshotId: null,
    ownerId: null,
    revision: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("canAccessProject (Read Authorization)", () => {
    it("allows owner to read project", () => {
      expect(canAccessProject(userA, projectOwnedByA)).toBe(true);
    });

    it("denies non-owner regular user from reading project", () => {
      expect(canAccessProject(userB, projectOwnedByA)).toBe(false);
    });

    it("allows ADMIN user to read any user's project", () => {
      expect(canAccessProject(adminUser, projectOwnedByA)).toBe(true);
    });

    it("allows all authenticated users to read unowned demo projects", () => {
      expect(canAccessProject(userA, projectUnowned)).toBe(true);
      expect(canAccessProject(userB, projectUnowned)).toBe(true);
      expect(canAccessProject(adminUser, projectUnowned)).toBe(true);
    });
  });

  describe("canMutateProject (Write Authorization)", () => {
    it("allows owner to mutate project", () => {
      expect(canMutateProject(userA, projectOwnedByA)).toBe(true);
    });

    it("denies non-owner regular user from mutating project", () => {
      expect(canMutateProject(userB, projectOwnedByA)).toBe(false);
    });

    it("allows ADMIN user to mutate any project", () => {
      expect(canMutateProject(adminUser, projectOwnedByA)).toBe(true);
    });

    it("allows authenticated user to mutate unowned project", () => {
      expect(canMutateProject(userA, projectUnowned)).toBe(true);
    });
  });
});
