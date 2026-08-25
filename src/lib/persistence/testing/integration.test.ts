/**
 * Database integration tests for the PostgreSQL persistence layer.
 *
 * Requirements:
 * - Real PostgreSQL instance running on TEST_DATABASE_URL
 * - All tests use transaction rollback isolation via TestTransactionContext
 * - All repository operations within a test share the SAME transaction client
 */

import "dotenv/config";

import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { generateId } from "../id";
import { parsePersistedDecimal, serializeDecimal } from "../decimal";
import { PgProjectRepository } from "../repositories/pg-project-repository";
import { PgInputSnapshotRepository } from "../repositories/pg-snapshot-repository";
import { PgProgramSelectionRepository } from "../repositories/pg-program-selection-repository";
import {
  PgCalculationRunRepository,
  PgCalculationSnapshotRepository,
  PgFundingSnapshotRepository,
} from "../repositories/pg-calculation-repository";
import { PgDocumentMetadataRepository } from "../repositories/pg-document-repository";
import { PgReportMetadataRepository } from "../repositories/pg-report-repository";

import type { TestTransactionContext } from "./test-db";
import { closeTestPool, createTestTransaction } from "./test-db";

afterAll(async () => {
  await closeTestPool();
});

// ── Test helpers ──────────────────────────────────────────────────────────
function makeProjectInput(overrides = {}) {
  return {
    name: "Commercial Solar Power Project",
    mode: "BANKABLE",
    industryActivity: "Renewable Energy",
    stage: "PLANNING" as const,
    status: "DRAFT" as const,
    areaClassification: "RURAL" as const,
    location: {
      address: {
        lines: ["Plot 42, MIDC Industrial Area"],
        villageTownCity: "Baramati",
        district: "Pune",
        state: "Maharashtra",
        pinCode: "413102",
      },
      areaClassification: "RURAL",
    },
    projectionPeriodYears: 7,
    ...overrides,
  };
}

function makeSnapshotData(overrides = {}) {
  return {
    snapshotType: "PROJECT_INPUT",
    schemaVersion: 1,
    project: {
      name: "Commercial Solar Power Project",
      mode: "BANKABLE",
      industryActivity: "Renewable Energy",
      stage: "PLANNING",
      status: "DRAFT",
      projectionPeriodYears: 7,
      location: {
        address: {
          lines: ["Plot 42, MIDC Industrial Area"],
          district: "Pune",
          state: "Maharashtra",
        },
        areaClassification: "RURAL",
      },
    },
    ...overrides,
  };
}

// ── 1. Transaction Isolation Verification ─────────────────────────────────

describe("Transaction Isolation & Rollback Verification", () => {
  it("proves transaction rollback ensures dirty writes are completely invisible to subsequent transactions", async () => {
    const uniqueProjectId = generateId();

    // 1. Transaction A: create project, verify it exists inside Transaction A, then rollback
    const txA = await createTestTransaction();
    const repoA = new PgProjectRepository(txA.db);
    const createdA = await repoA.create(
      makeProjectInput({ id: uniqueProjectId, name: "Temporary Project A" }),
    );
    expect(createdA.id).toBe(uniqueProjectId);

    const foundInA = await repoA.findById(uniqueProjectId);
    expect(foundInA).not.toBeNull();
    expect(foundInA?.name).toBe("Temporary Project A");

    // Rollback Transaction A
    await txA.rollback();

    // 2. Independent Transaction B: verify the project created in A does NOT exist
    const txB = await createTestTransaction();
    const repoB = new PgProjectRepository(txB.db);
    const foundInB = await repoB.findById(uniqueProjectId);
    expect(foundInB).toBeNull();

    await txB.rollback();
  });
});

// ── 2. Project Repository & Optimistic Concurrency ────────────────────────

describe("PgProjectRepository — CRUD & Optimistic Concurrency", () => {
  let ctx: TestTransactionContext;
  let repo: PgProjectRepository;

  beforeEach(async () => {
    ctx = await createTestTransaction();
    repo = new PgProjectRepository(ctx.db);
  });

  afterEach(async () => {
    if (ctx) await ctx.rollback();
  });

  it("creates a project and assigns a native PostgreSQL UUID", async () => {
    const project = await repo.create(makeProjectInput());

    expect(project.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(project.name).toBe("Commercial Solar Power Project");
    expect(project.mode).toBe("BANKABLE");
    expect(project.status).toBe("DRAFT");
    expect(project.revision).toBe(1);
    expect(project.createdAt).toBeInstanceOf(Date);
  });

  it("creates a project with a pre-generated application UUID", async () => {
    const id = generateId();
    const project = await repo.create(makeProjectInput({ id }));
    expect(project.id).toBe(id);
  });

  it("finds a project by ID and preserves structured location JSONB", async () => {
    const created = await repo.create(makeProjectInput());
    const found = await repo.findById(created.id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
    expect(found!.name).toBe("Commercial Solar Power Project");
    expect(found!.location).toEqual(makeProjectInput().location);
  });

  it("returns null for non-existent project", async () => {
    const found = await repo.findById(generateId());
    expect(found).toBeNull();
  });

  it("lists all projects ordered by createdAt", async () => {
    await repo.create(makeProjectInput({ name: "Solar Phase 1" }));
    await repo.create(makeProjectInput({ name: "Solar Phase 2" }));

    const all = await repo.findAll();
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  it("proves optimistic concurrency: revision N succeeds, stale revision fails, revision N+1 succeeds", async () => {
    const created = await repo.create(makeProjectInput());
    expect(created.revision).toBe(1);

    // Step 1: Update at expected revision 1 -> succeeds, becomes revision 2
    const update1 = await repo.update(created.id, 1, {
      name: "Solar Project Revised",
      status: "IN_REVIEW",
    });
    expect(update1.ok).toBe(true);
    if (update1.ok) {
      expect(update1.value.revision).toBe(2);
      expect(update1.value.name).toBe("Solar Project Revised");
      expect(update1.value.status).toBe("IN_REVIEW");
    }

    // Step 2: Update with stale expected revision 1 -> fails deterministically with CONCURRENCY_CONFLICT
    const staleUpdate = await repo.update(created.id, 1, {
      name: "Stale Concurrent Update",
    });
    expect(staleUpdate.ok).toBe(false);
    if (!staleUpdate.ok) {
      expect(staleUpdate.error.code).toBe("CONCURRENCY_CONFLICT");
      if (staleUpdate.error.code === "CONCURRENCY_CONFLICT") {
        expect(staleUpdate.error.expectedRevision).toBe(1);
      }
    }

    // Step 3: Update with current expected revision 2 -> succeeds, becomes revision 3
    const update2 = await repo.update(created.id, 2, {
      name: "Solar Project Finalized",
      status: "FINALIZED",
    });
    expect(update2.ok).toBe(true);
    if (update2.ok) {
      expect(update2.value.revision).toBe(3);
      expect(update2.value.status).toBe("FINALIZED");
    }
  });

  it("archives a project (soft delete) using optimistic revision check", async () => {
    const created = await repo.create(makeProjectInput());
    const result = await repo.archive(created.id, 1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("ARCHIVED");
      expect(result.value.revision).toBe(2);
    }
  });

  it("hard deletes a project for maintenance/tests", async () => {
    const created = await repo.create(makeProjectInput());
    const deleted = await repo.hardDelete(created.id);
    expect(deleted).toBe(true);

    const found = await repo.findById(created.id);
    expect(found).toBeNull();
  });

  it("hard delete returns false for non-existent project", async () => {
    const deleted = await repo.hardDelete(generateId());
    expect(deleted).toBe(false);
  });
});

// ── 3. Immutable Input Snapshots & Historical Retrievability ──────────────

describe("PgInputSnapshotRepository — Immutability & Historical Revisions", () => {
  let ctx: TestTransactionContext;
  let projectRepo: PgProjectRepository;
  let snapshotRepo: PgInputSnapshotRepository;

  beforeEach(async () => {
    ctx = await createTestTransaction();
    projectRepo = new PgProjectRepository(ctx.db);
    snapshotRepo = new PgInputSnapshotRepository(ctx.db);
  });

  afterEach(async () => {
    if (ctx) await ctx.rollback();
  });

  it("persists immutable input snapshots and retrieves historical revisions without mutation", async () => {
    const project = await projectRepo.create(makeProjectInput());

    // Revision 1 snapshot
    const dataRev1 = makeSnapshotData({ cost: "1000000" });
    const snap1 = await snapshotRepo.create({
      projectId: project.id,
      revision: 1,
      data: dataRev1,
    });

    // Revision 2 snapshot
    const dataRev2 = makeSnapshotData({ cost: "1500000" });
    const snap2 = await snapshotRepo.create({
      projectId: project.id,
      revision: 2,
      data: dataRev2,
    });

    // Verify both snapshots exist and remain unaltered
    const allSnapshots = await snapshotRepo.findByProjectId(project.id);
    expect(allSnapshots).toHaveLength(2);
    expect(allSnapshots[0].revision).toBe(2);
    expect(allSnapshots[0].data).toEqual(dataRev2);
    expect(allSnapshots[1].revision).toBe(1);
    expect(allSnapshots[1].data).toEqual(dataRev1);

    // Latest snapshot is revision 2
    const latest = await snapshotRepo.findLatestByProjectId(project.id);
    expect(latest).not.toBeNull();
    expect(latest!.id).toBe(snap2.id);
    expect(latest!.revision).toBe(2);

    // Original snapshot 1 is still independently retrievable
    const retrieved1 = await snapshotRepo.findById(snap1.id);
    expect(retrieved1).not.toBeNull();
    expect(retrieved1!.data).toEqual(dataRev1);
  });
});

// ── 4. Atomic Project Creation & Snapshot Pointer ─────────────────────────

describe("Atomic Project Creation & Pointer Updates", () => {
  let ctx: TestTransactionContext;

  beforeEach(async () => {
    ctx = await createTestTransaction();
  });

  afterEach(async () => {
    if (ctx) await ctx.rollback();
  });

  it("creates Project + Initial Input Snapshot + current pointer atomically", async () => {
    const projectRepo = new PgProjectRepository(ctx.db);
    const snapshotRepo = new PgInputSnapshotRepository(ctx.db);

    // 1. Create project
    const project = await projectRepo.create(makeProjectInput());

    // 2. Create initial snapshot
    const snapshot = await snapshotRepo.create({
      projectId: project.id,
      revision: 1,
      data: makeSnapshotData(),
    });

    // 3. Set current snapshot pointer
    const updated = await projectRepo.update(project.id, 1, {
      currentInputSnapshotId: snapshot.id,
    });

    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.value.currentInputSnapshotId).toBe(snapshot.id);
      expect(updated.value.revision).toBe(2);
    }
  });

  it("rolls back partial state if atomic creation fails midway", async () => {
    const uniqueId = generateId();

    // Start isolated transaction
    const isolatedTx = await createTestTransaction();
    const projectRepo = new PgProjectRepository(isolatedTx.db);

    // 1. Create project
    await projectRepo.create(makeProjectInput({ id: uniqueId }));

    // 2. Simulate error before snapshot pointer is linked -> rollback transaction
    await isolatedTx.rollback();

    // 3. In a new transaction, verify no partial project exists
    const checkTx = await createTestTransaction();
    const checkRepo = new PgProjectRepository(checkTx.db);
    const found = await checkRepo.findById(uniqueId);
    expect(found).toBeNull();
    await checkTx.rollback();
  });
});

// ── 5. Exact Decimal Persistence Round-Trip via JSONB ─────────────────────

describe("Exact Decimal Round-Trip Fidelity in PostgreSQL JSONB", () => {
  let ctx: TestTransactionContext;
  let projectRepo: PgProjectRepository;
  let snapshotRepo: PgInputSnapshotRepository;
  let calcRunRepo: PgCalculationRunRepository;
  let calcSnapshotRepo: PgCalculationSnapshotRepository;

  beforeEach(async () => {
    ctx = await createTestTransaction();
    projectRepo = new PgProjectRepository(ctx.db);
    snapshotRepo = new PgInputSnapshotRepository(ctx.db);
    calcRunRepo = new PgCalculationRunRepository(ctx.db);
    calcSnapshotRepo = new PgCalculationSnapshotRepository(ctx.db);
  });

  afterEach(async () => {
    if (ctx) await ctx.rollback();
  });

  it("persists exact canonical decimal strings through PostgreSQL JSONB without Number conversion", async () => {
    const project = await projectRepo.create(makeProjectInput());
    const inputSnapshot = await snapshotRepo.create({
      projectId: project.id,
      revision: 1,
      data: makeSnapshotData(),
    });
    const run = await calcRunRepo.create({
      projectId: project.id,
      inputSnapshotId: inputSnapshot.id,
    });

    // Authoritative test cases required by prompt
    const testDecimalValues = {
      zero: serializeDecimal("0"),
      simpleDecimal: serializeDecimal("0.1"),
      highPrecisionLarge: serializeDecimal(
        "12345678901234567890.1234567890123456789",
      ),
      highPrecisionNegative: serializeDecimal(
        "-999999999999.0000000000000000001",
      ),
      subatomicSmall: serializeDecimal(
        "0.000000000000000000000000000000000000001",
      ),
      standardFinancial: serializeDecimal("5000000.50"),
    };

    const snapshot = await calcSnapshotRepo.create({
      projectId: project.id,
      calculationRunId: run.id,
      snapshotType: "FINANCIAL_CANONICAL_TEST",
      data: {
        snapshotType: "FINANCIAL_CANONICAL_TEST",
        schemaVersion: 1,
        decimals: testDecimalValues,
      },
    });

    // Retrieve from PostgreSQL
    const retrieved = await calcSnapshotRepo.findById(snapshot.id);
    expect(retrieved).not.toBeNull();

    const data = retrieved!.data as {
      decimals: Record<string, string>;
    };

    // Assert exact string equality (no float rounding or exponentiation)
    expect(data.decimals.zero).toBe("0");
    expect(data.decimals.simpleDecimal).toBe("0.1");
    expect(data.decimals.highPrecisionLarge).toBe(
      "12345678901234567890.1234567890123456789",
    );
    expect(data.decimals.highPrecisionNegative).toBe(
      "-999999999999.0000000000000000001",
    );
    expect(data.decimals.subatomicSmall).toBe(
      "0.000000000000000000000000000000000000001",
    );
    expect(data.decimals.standardFinancial).toBe("5000000.50");

    // Verify each passes parsePersistedDecimal
    for (const key of Object.keys(data.decimals)) {
      expect(parsePersistedDecimal(data.decimals[key])).toBe(
        testDecimalValues[key as keyof typeof testDecimalValues],
      );
    }
  });
});

// ── 6. Program Selection Persistence (Multi-Scheme) ───────────────────────

describe("PgProgramSelectionRepository — Multi-Program Selection", () => {
  let ctx: TestTransactionContext;
  let projectRepo: PgProjectRepository;
  let selectionRepo: PgProgramSelectionRepository;

  beforeEach(async () => {
    ctx = await createTestTransaction();
    projectRepo = new PgProjectRepository(ctx.db);
    selectionRepo = new PgProgramSelectionRepository(ctx.db);
  });

  afterEach(async () => {
    if (ctx) await ctx.rollback();
  });

  it("persists multiple program selections for a single project preserving exact identities", async () => {
    const project = await projectRepo.create(makeProjectInput());

    const selections = await selectionRepo.replaceForProject(project.id, [
      {
        projectId: project.id,
        programId: "GOI.NLM.POULTRY",
        versionId: "2024.1",
      },
      {
        projectId: project.id,
        programId: "GOI.MUDRA.TARUN",
        versionId: "2024.1",
      },
      {
        projectId: project.id,
        programId: "GOI.PMEGP",
        versionId: "2024-25.NATIONAL",
      },
    ]);

    expect(selections).toHaveLength(3);

    const found = await selectionRepo.findByProjectId(project.id);
    expect(found).toHaveLength(3);

    const ids = found.map((s) => s.programId).sort();
    expect(ids).toEqual(["GOI.MUDRA.TARUN", "GOI.NLM.POULTRY", "GOI.PMEGP"]);

    const versions = found.map((s) => s.versionId).sort();
    expect(versions).toEqual(["2024-25.NATIONAL", "2024.1", "2024.1"]);
  });
});

// ── 7. Calculation Run & Multi-Program Funding Snapshots ───────────────────

describe("Calculation Runs & Funding Snapshots", () => {
  let ctx: TestTransactionContext;
  let projectRepo: PgProjectRepository;
  let snapshotRepo: PgInputSnapshotRepository;
  let calcRunRepo: PgCalculationRunRepository;
  let fundingRepo: PgFundingSnapshotRepository;

  beforeEach(async () => {
    ctx = await createTestTransaction();
    projectRepo = new PgProjectRepository(ctx.db);
    snapshotRepo = new PgInputSnapshotRepository(ctx.db);
    calcRunRepo = new PgCalculationRunRepository(ctx.db);
    fundingRepo = new PgFundingSnapshotRepository(ctx.db);
  });

  afterEach(async () => {
    if (ctx) await ctx.rollback();
  });

  it("manages calculation run lifecycle and persists multi-program funding composition snapshots", async () => {
    const project = await projectRepo.create(makeProjectInput());
    const inputSnapshot = await snapshotRepo.create({
      projectId: project.id,
      revision: 1,
      data: makeSnapshotData(),
    });

    const run = await calcRunRepo.create({
      projectId: project.id,
      inputSnapshotId: inputSnapshot.id,
      triggeredBy: "consultant@example.com",
    });

    expect(run.status).toBe("PENDING");

    const completed = await calcRunRepo.complete(run.id, "COMPLETED");
    expect(completed?.status).toBe("COMPLETED");
    expect(completed?.completedAt).toBeInstanceOf(Date);

    // Persist MultiProgramFundingResult snapshot
    const fundingData = {
      snapshotType: "FUNDING_COMPOSER",
      schemaVersion: 1,
      projectId: project.id,
      evaluationAsOfDate: "2026-04-01",
      mode: "MULTI_PROGRAM",
      resolutionStatus: "RESOLVED",
      allocationLedger: [
        {
          allocationId: generateId(),
          programId: "GOI.PMEGP",
          costItemId: "cost-item-civil-work-1", // Authoritative costItemId preserved
          benefitAmount: "1250000",
        },
      ],
      summary: {
        totalProjectCost: "5000000",
        capitalSubsidy: "1250000",
      },
    };

    const fundingSnapshot = await fundingRepo.create({
      projectId: project.id,
      calculationRunId: run.id,
      data: fundingData,
    });

    expect(fundingSnapshot.id).toBeTruthy();
    expect(fundingSnapshot.calculationRunId).toBe(run.id);

    const retrieved = await fundingRepo.findById(fundingSnapshot.id);
    expect(retrieved?.data).toEqual(fundingData);
  });
});

// ── 8. Document & Report Metadata Reproducibility ─────────────────────────

describe("Document & Report Metadata — DPR Reproducibility", () => {
  let ctx: TestTransactionContext;
  let projectRepo: PgProjectRepository;
  let snapshotRepo: PgInputSnapshotRepository;
  let calcRunRepo: PgCalculationRunRepository;
  let docRepo: PgDocumentMetadataRepository;
  let reportRepo: PgReportMetadataRepository;

  beforeEach(async () => {
    ctx = await createTestTransaction();
    projectRepo = new PgProjectRepository(ctx.db);
    snapshotRepo = new PgInputSnapshotRepository(ctx.db);
    calcRunRepo = new PgCalculationRunRepository(ctx.db);
    docRepo = new PgDocumentMetadataRepository(ctx.db);
    reportRepo = new PgReportMetadataRepository(ctx.db);
  });

  afterEach(async () => {
    if (ctx) await ctx.rollback();
  });

  it("persists document metadata with provider-agnostic storage key", async () => {
    const project = await projectRepo.create(makeProjectInput());

    const doc = await docRepo.create({
      projectId: project.id,
      kind: "QUOTATION",
      displayName: "Solar Panels Quotation",
      version: "1.0",
      storageKey: "projects/solar-01/quotations/quote-solar.pdf",
      mimeType: "application/pdf",
      sizeBytes: "2097152",
    });

    expect(doc.id).toBeTruthy();
    expect(doc.storageKey).toBe("projects/solar-01/quotations/quote-solar.pdf");

    const updated = await docRepo.update(doc.id, {
      displayName: "Solar Panels Quotation v2",
      version: "2.0",
    });

    expect(updated?.displayName).toBe("Solar Panels Quotation v2");
    expect(updated?.version).toBe("2.0");
  });

  it("stores DPR report metadata referencing exact input, calc run, and program context", async () => {
    const project = await projectRepo.create(makeProjectInput());
    const inputSnapshot = await snapshotRepo.create({
      projectId: project.id,
      revision: 1,
      data: makeSnapshotData(),
    });
    const calcRun = await calcRunRepo.create({
      projectId: project.id,
      inputSnapshotId: inputSnapshot.id,
    });

    const report = await reportRepo.create({
      projectId: project.id,
      reportType: "BANKABLE",
      templateReference: "dpr-bankable-v2",
      inputSnapshotId: inputSnapshot.id,
      calculationRunId: calcRun.id,
      programContext: {
        selectedPrograms: [
          { programId: "GOI.PMEGP", versionId: "2024-25.NATIONAL" },
        ],
        evaluationAsOfDate: "2026-04-01",
      },
      sections: [
        { sectionCode: "EXECUTIVE_SUMMARY", included: true, order: 1 },
        { sectionCode: "FINANCIAL_PROJECTIONS", included: true, order: 2 },
      ],
    });

    expect(report.id).toBeTruthy();
    expect(report.inputSnapshotId).toBe(inputSnapshot.id);
    expect(report.calculationRunId).toBe(calcRun.id);
    expect(report.templateReference).toBe("dpr-bankable-v2");

    const retrieved = await reportRepo.findById(report.id);
    expect(retrieved?.programContext).toEqual({
      selectedPrograms: [
        { programId: "GOI.PMEGP", versionId: "2024-25.NATIONAL" },
      ],
      evaluationAsOfDate: "2026-04-01",
    });
  });
});

// ── 9. Foreign Key Integrity Constraints ──────────────────────────────────

describe("Foreign Key Integrity Verification", () => {
  let ctx: TestTransactionContext;

  beforeEach(async () => {
    ctx = await createTestTransaction();
  });

  afterEach(async () => {
    if (ctx) await ctx.rollback();
  });

  it("fails when creating project_input_snapshot with non-existent project_id", async () => {
    const snapshotRepo = new PgInputSnapshotRepository(ctx.db);
    const nonExistentProjectId = generateId();

    await expect(
      snapshotRepo.create({
        projectId: nonExistentProjectId,
        revision: 1,
        data: makeSnapshotData(),
      }),
    ).rejects.toThrow();
  });

  it("fails when creating calculation_run with non-existent project_id", async () => {
    const projectRepo = new PgProjectRepository(ctx.db);
    const snapshotRepo = new PgInputSnapshotRepository(ctx.db);
    const calcRunRepo = new PgCalculationRunRepository(ctx.db);

    const project = await projectRepo.create(makeProjectInput());
    const snapshot = await snapshotRepo.create({
      projectId: project.id,
      revision: 1,
      data: makeSnapshotData(),
    });

    const nonExistentProjectId = generateId();
    await expect(
      calcRunRepo.create({
        projectId: nonExistentProjectId,
        inputSnapshotId: snapshot.id,
      }),
    ).rejects.toThrow();
  });

  it("fails when creating calculation_run with non-existent input_snapshot_id", async () => {
    const projectRepo = new PgProjectRepository(ctx.db);
    const calcRunRepo = new PgCalculationRunRepository(ctx.db);

    const project = await projectRepo.create(makeProjectInput());
    const nonExistentSnapshotId = generateId();

    await expect(
      calcRunRepo.create({
        projectId: project.id,
        inputSnapshotId: nonExistentSnapshotId,
      }),
    ).rejects.toThrow();
  });

  it("fails when creating calculation_snapshot with non-existent calculation_run_id", async () => {
    const projectRepo = new PgProjectRepository(ctx.db);
    const calcSnapshotRepo = new PgCalculationSnapshotRepository(ctx.db);

    const project = await projectRepo.create(makeProjectInput());
    const nonExistentRunId = generateId();

    await expect(
      calcSnapshotRepo.create({
        projectId: project.id,
        calculationRunId: nonExistentRunId,
        snapshotType: "TEST",
        data: { test: true },
      }),
    ).rejects.toThrow();
  });

  it("fails when creating funding_snapshot with non-existent calculation_run_id", async () => {
    const projectRepo = new PgProjectRepository(ctx.db);
    const fundingRepo = new PgFundingSnapshotRepository(ctx.db);

    const project = await projectRepo.create(makeProjectInput());
    const nonExistentRunId = generateId();

    await expect(
      fundingRepo.create({
        projectId: project.id,
        calculationRunId: nonExistentRunId,
        data: { test: true },
      }),
    ).rejects.toThrow();
  });
});
