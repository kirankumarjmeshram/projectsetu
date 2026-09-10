import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  closeTestPool,
  createTestTransaction,
  type TestTransactionContext,
} from "./test-db";
import type { AuthUser } from "@/lib/auth/contracts";
import {
  PgProjectRepository,
  PgUserRepository,
  PgInputSnapshotRepository,
  PgCalculationRunRepository,
  PgCalculationSnapshotRepository,
  PgDocumentMetadataRepository,
} from "../repositories";
import { professionalFixture } from "@/lib/application/orchestrator/testing/professional-fixture";
import { orchestrateProjectCalculation } from "@/lib/application/orchestrator/calculation-orchestrator";
import { LocalReportArtifactStorage } from "@/lib/reports/storage";
import {
  generateReportVersionAction,
  downloadReportArtifactAction,
  buildReportPreviewAction,
} from "@/app/actions/report-actions";
import { saveProjectDraftAction } from "@/app/actions/project-actions";
import {
  createManualQuotationAction,
  saveQuotationReviewAction,
  approveQuotationAction,
  mapQuotationLinesAction,
} from "@/app/actions/quotation-actions";

// Only request-session/framework boundaries are stubbed. Repositories, SQL,
// report builders/renderers and artifact storage are real.
const request = vi.hoisted(() => ({
  user: null as AuthUser | null,
  db: null as unknown,
}));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: async () => request.user,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/persistence/db", async (original) => ({
  ...(await original<object>()),
  getDb: () => request.db,
}));
vi.mock("@/lib/reports/storage", async (original) => ({
  ...(await original<object>()),
  getReportArtifactStorage: () =>
    new LocalReportArtifactStorage("tmp/professional-qa/action-artifacts"),
}));

let ctx: TestTransactionContext;
beforeEach(async () => {
  ctx = await createTestTransaction();
  request.db = ctx.db;
  request.user = await new PgUserRepository(ctx.db).create({
    email: "action-fixture@example.test",
    name: "Test owner",
    passwordHash: "test-only-unused",
    role: "USER",
  });
});
afterEach(async () => {
  await ctx?.rollback();
});
afterAll(closeTestPool);

async function completedProject() {
  const fixture = professionalFixture();
  const repo = new PgProjectRepository(ctx.db);
  const project = await repo.create({
    name: fixture.project.name,
    mode: "BANKABLE",
    industryActivity: fixture.project.industryActivity,
    stage: "PLANNING",
    projectionPeriodYears: 5,
    ownerId: request.user!.id,
  });
  const input = { ...fixture, project: { ...fixture.project, id: project.id } };
  const snapshot = await new PgInputSnapshotRepository(ctx.db).create({
    projectId: project.id,
    revision: 1,
    data: input,
  });
  await repo.update(project.id, project.revision, {
    currentInputSnapshotId: snapshot.id,
  });
  const run = await new PgCalculationRunRepository(ctx.db).create({
    projectId: project.id,
    inputSnapshotId: snapshot.id,
    status: "COMPLETED",
  });
  await new PgCalculationSnapshotRepository(ctx.db).create({
    projectId: project.id,
    calculationRunId: run.id,
    snapshotType: "PROJECT_CALCULATION",
    data: orchestrateProjectCalculation(input, "2026-09-09"),
  });
  return { input, project, snapshot };
}

describe("real PostgreSQL report action security and immutable artifacts", () => {
  it("generates all formats with correct MIME, bytes and immutable downloads after a new snapshot", async () => {
    const { project, input, snapshot } = await completedProject();
    const generated = await generateReportVersionAction(project.id);
    expect(generated.success).toBe(true);
    if (!generated.success) throw new Error(generated.error);
    const contents = new Map<string, string>();
    for (const [format, mime] of [
      ["PDF", "application/pdf"],
      [
        "DOCX",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
      [
        "XLSX",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ],
    ] as const) {
      const artifact = await downloadReportArtifactAction(
        project.id,
        generated.report.id,
        format,
      );
      expect(artifact.success).toBe(true);
      if (!artifact.success) throw new Error(artifact.error);
      expect(artifact.mimeType).toBe(mime);
      expect(artifact.filename).toMatch(/^[a-zA-Z0-9_.-]+$/);
      expect(Buffer.from(artifact.base64, "base64").length).toBeGreaterThan(
        1000,
      );
      contents.set(format, artifact.base64);
    }
    // Saving unchanged input must preserve the current calculation pointer.
    expect((await saveProjectDraftAction(input)).success).toBe(true);
    expect(
      (await new PgProjectRepository(ctx.db).findById(project.id))!
        .currentInputSnapshotId,
    ).toBe(snapshot.id);
    const changed = {
      ...input,
      revenueProducts: input.revenueProducts.map((p, i) =>
        i === 0 ? { ...p, unitPriceYear1: "55" } : p,
      ),
    };
    expect((await saveProjectDraftAction(changed)).success).toBe(true);
    expect((await buildReportPreviewAction(project.id)).success).toBe(false);
    const stale = await generateReportVersionAction(project.id);
    expect(stale.success).toBe(false);
    for (const format of ["PDF", "DOCX", "XLSX"] as const) {
      const old = await downloadReportArtifactAction(
        project.id,
        generated.report.id,
        format,
      );
      expect(old.success).toBe(true);
      if (old.success) expect(old.base64).toBe(contents.get(format));
    }
  });
  it("denies other users and allows the owner/admin through actual report actions", async () => {
    const { project } = await completedProject();
    const generated = await generateReportVersionAction(project.id);
    expect(generated.success).toBe(true);
    if (!generated.success) throw new Error(generated.error);
    const owner = request.user!;
    request.user = { ...owner, id: crypto.randomUUID() };
    expect((await buildReportPreviewAction(project.id)).success).toBe(false);
    expect(
      (
        await downloadReportArtifactAction(
          project.id,
          generated.report.id,
          "PDF",
        )
      ).success,
    ).toBe(false);
    request.user = { ...request.user, role: "ADMIN" };
    expect(
      (
        await downloadReportArtifactAction(
          project.id,
          generated.report.id,
          "PDF",
        )
      ).success,
    ).toBe(true);
    request.user = null;
    expect(
      (
        await downloadReportArtifactAction(
          project.id,
          generated.report.id,
          "PDF",
        )
      ).success,
    ).toBe(false);
  });
  it("rejects cross-project quotation documents and report IDs even for the same owner", async () => {
    const a = await completedProject(),
      b = await completedProject();
    const doc = await new PgDocumentMetadataRepository(ctx.db).create({
      projectId: b.project.id,
      kind: "QUOTATION",
      displayName: "Test quote",
    });
    const quote = await createManualQuotationAction({
      projectId: a.project.id,
      documentId: doc.id,
      supplier: { name: "Fixture vendor" },
      lines: [],
    });
    expect(quote.success).toBe(false);
    const ownQuote = await createManualQuotationAction({
      projectId: b.project.id,
      supplier: { name: "Fixture vendor" },
      lines: [],
    });
    expect(ownQuote.success).toBe(true);
    if (!ownQuote.quotation || !ownQuote.extractionId)
      throw new Error("Missing test quotation");
    expect(
      (
        await saveQuotationReviewAction(
          a.project.id,
          ownQuote.extractionId,
          ownQuote.quotation,
        )
      ).success,
    ).toBe(false);
    expect(
      (
        await approveQuotationAction(
          a.project.id,
          ownQuote.extractionId,
          ownQuote.quotation,
        )
      ).success,
    ).toBe(false);
    expect(
      (
        await mapQuotationLinesAction(
          { ...ownQuote.quotation, projectId: a.project.id },
          [],
          a.input.costItems,
        )
      ).success,
    ).toBe(false);
    const report = await generateReportVersionAction(b.project.id);
    expect(report.success).toBe(true);
    if (!report.success) throw new Error(report.error);
    expect(
      (
        await downloadReportArtifactAction(
          a.project.id,
          report.report.id,
          "PDF",
        )
      ).success,
    ).toBe(false);
  });
  it("returns a sanitized message after a real SQL failure", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const input = professionalFixture();
      const response = await saveProjectDraftAction({
        ...input,
        project: { ...input.project, id: "invalid-uuid-with-sensitive-marker" },
      });
      expect(response.success).toBe(false);
      expect(JSON.stringify(response)).not.toMatch(
        /SELECT|insert|uuid|sensitive-marker|postgres|query/i,
      );
    } finally {
      spy.mockRestore();
    }
  });
});
