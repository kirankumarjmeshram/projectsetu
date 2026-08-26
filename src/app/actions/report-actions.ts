"use server";

import { revalidatePath } from "next/cache";

import { canAccessProject, canMutateProject } from "@/lib/auth/authorization";
import { getCurrentUser } from "@/lib/auth/session";
import type {
  ProjectCalculationResult,
  ProjectWizardInput,
} from "@/lib/application/orchestrator/orchestrator-types";
import type { NormalizedQuotation } from "@/lib/documents/quotation/contracts";
import { getDb } from "@/lib/persistence/db";
import {
  PgCalculationRunRepository,
  PgCalculationSnapshotRepository,
  PgDocumentMetadataRepository,
  PgFundingSnapshotRepository,
  PgInputSnapshotRepository,
  PgProjectRepository,
  PgQuotationLineMappingRepository,
  PgQuotationReviewRepository,
  PgReportMetadataRepository,
} from "@/lib/persistence/repositories";
import { buildDprReportModel } from "@/lib/reports/builder";
import {
  DPR_CONTENT_SCHEMA_VERSION,
  DPR_TEMPLATE_VERSION,
  type DprReportModel,
  type NarrativeOverrides,
  type QuotationReportReference,
} from "@/lib/reports/contracts";
import { renderDocx, renderExcel, renderPdf } from "@/lib/reports/renderers";
import { getReportArtifactStorage } from "@/lib/reports/storage";
import { validateDprReport } from "@/lib/reports/validation";

async function loadReportSources(
  projectId: string,
  reportId: string,
  reportVersion: number,
  overrides?: NarrativeOverrides,
) {
  const db = getDb();
  const project = await new PgProjectRepository(db).findById(projectId);
  if (!project) throw new Error("Project not found.");
  const runs = (
    await new PgCalculationRunRepository(db).findByProjectId(projectId)
  )
    .filter((run) => run.status === "COMPLETED")
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  const run = runs[0];
  if (!run)
    throw new Error(
      "A completed, persisted calculation run is required before report generation.",
    );
  const inputSnapshot = await new PgInputSnapshotRepository(db).findById(
    run.inputSnapshotId,
  );
  if (!inputSnapshot || inputSnapshot.projectId !== projectId)
    throw new Error(
      "The calculation input snapshot is missing or belongs to another project.",
    );
  const calculationSnapshot = (
    await new PgCalculationSnapshotRepository(db).findByCalculationRunId(run.id)
  )[0];
  if (!calculationSnapshot)
    throw new Error(
      "Authoritative calculation output snapshot is missing for this run.",
    );
  const fundingSnapshot = (
    await new PgFundingSnapshotRepository(db).findByCalculationRunId(run.id)
  ).find((snapshot) => snapshot.snapshotType === "FUNDING_COMPOSER");
  const reviews = (
    await new PgQuotationReviewRepository(db).findByProjectId(projectId)
  ).filter((review) => review.status === "APPROVED");
  const mappings = (
    await new PgQuotationLineMappingRepository(db).findByProjectId(projectId)
  ).filter(
    (mapping) => mapping.status === "ACTIVE" && mapping.projectCostItemId,
  );
  const documents = await new PgDocumentMetadataRepository(db).findByProjectId(
    projectId,
  );
  const quotationReferences: QuotationReportReference[] = [];
  for (const mapping of mappings) {
    const review = reviews.find(
      (candidate) =>
        (candidate.reviewedData as NormalizedQuotation).documentId ===
        mapping.documentId,
    );
    if (!review) continue;
    const quotation = review.reviewedData as NormalizedQuotation;
    const line = quotation.lineItems.find(
      (candidate) => candidate.lineId === mapping.quotationLineId,
    );
    const document = documents.find(
      (candidate) => candidate.id === mapping.documentId,
    );
    if (!line || !document || document.status !== "APPROVED") continue;
    quotationReferences.push({
      projectCostItemId: mapping.projectCostItemId!,
      documentId: document.id,
      documentVersion: document.version ?? "1",
      supplierName: quotation.supplier.name,
      quotationNumber: quotation.quotationNumber ?? undefined,
      lineDescription: line.description,
      approved: true,
      mapped: true,
    });
  }
  const wizardInput = inputSnapshot.data as ProjectWizardInput;
  const calculation = calculationSnapshot.data as ProjectCalculationResult;
  const model = await buildDprReportModel({
    identity: {
      reportId,
      reportVersion,
      projectId,
      inputSnapshotId: inputSnapshot.id,
      calculationRunId: run.id,
      fundingSnapshotId: fundingSnapshot?.id,
      templateVersion: DPR_TEMPLATE_VERSION,
      contentSchemaVersion: DPR_CONTENT_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      language: "en",
    },
    project: wizardInput,
    calculation,
    quotationReferences,
    narrativeOverrides: overrides,
  });
  return {
    model,
    validation: validateDprReport(model),
    inputSnapshot,
    run,
    fundingSnapshot,
  };
}

export async function buildReportPreviewAction(projectId: string) {
  try {
    const user = await getCurrentUser();
    const db = getDb();
    const project = await new PgProjectRepository(db).findById(projectId);
    if (!project)
      return { success: false as const, error: "Project not found." };

    if (user && !canAccessProject(user, project)) {
      return {
        success: false as const,
        error:
          "Access denied. You do not have permission to view reports for this project.",
      };
    }

    const reports = await new PgReportMetadataRepository(db).findByProjectId(
      projectId,
    );
    const { model, validation } = await loadReportSources(
      projectId,
      crypto.randomUUID(),
      (reports[0]?.reportVersion ?? 0) + 1,
    );
    return { success: true as const, model, validation };
  } catch (error) {
    return { success: false as const, error: (error as Error).message };
  }
}

export async function generateReportVersionAction(
  projectId: string,
  overrides?: NarrativeOverrides,
) {
  const user = await getCurrentUser();
  const db = getDb();
  const project = await new PgProjectRepository(db).findById(projectId);
  if (!project) return { success: false as const, error: "Project not found." };

  if (user && !canMutateProject(user, project)) {
    return {
      success: false as const,
      error:
        "Access denied. You do not have permission to generate reports for this project.",
    };
  }

  const reportRepo = new PgReportMetadataRepository(db);
  const documentRepo = new PgDocumentMetadataRepository(db);
  const existing = await reportRepo.findByProjectId(projectId);
  const version = (existing[0]?.reportVersion ?? 0) + 1;
  const reportId = crypto.randomUUID();
  let report = await reportRepo.create({
    id: reportId,
    projectId,
    reportType: "DPR",
    reportVersion: version,
    templateReference: DPR_TEMPLATE_VERSION,
    templateVersion: DPR_TEMPLATE_VERSION,
    contentSchemaVersion: DPR_CONTENT_SCHEMA_VERSION,
    status: "GENERATING",
    narrativeOverrides: overrides,
  });
  try {
    const { model, validation } = await loadReportSources(
      projectId,
      reportId,
      version,
      overrides,
    );
    if (!validation.validForExport) {
      await reportRepo.update(reportId, {
        status: "FAILED",
        content: model,
        sections: model.sections,
      });
      return {
        success: false as const,
        error: "Report validation contains blocking issues.",
        validation,
      };
    }
    const artifacts = await Promise.all([
      renderPdf(model),
      renderDocx(model),
      renderExcel(model),
    ]);
    const ids: Partial<Record<"PDF" | "DOCX" | "XLSX", string>> = {};
    for (const artifact of artifacts) {
      const stored = await getReportArtifactStorage().put(projectId, artifact);
      const document = await documentRepo.create({
        projectId,
        kind: "PROJECT_REPORT",
        displayName: artifact.filename,
        originalFilename: artifact.filename,
        version: String(version),
        storageKey: stored.storageKey,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        checksumSha256: stored.checksumSha256,
        status: "APPROVED",
      });
      ids[artifact.format] = document.id;
    }
    report = (await reportRepo.update(reportId, {
      inputSnapshotId: model.identity.inputSnapshotId,
      calculationRunId: model.identity.calculationRunId,
      fundingSnapshotId: model.identity.fundingSnapshotId,
      programContext: model.project.selectedPrograms,
      sections: model.sections,
      content: model,
      narrativeOverrides: overrides,
      status: "READY",
      generatedDocumentId: ids.PDF,
      pdfDocumentId: ids.PDF,
      docxDocumentId: ids.DOCX,
      excelDocumentId: ids.XLSX,
      generatedAt: new Date(model.identity.generatedAt),
    }))!;
    revalidatePath(`/projects/${projectId}`);
    return { success: true as const, report, validation };
  } catch (error) {
    await reportRepo.update(reportId, { status: "FAILED" });
    return { success: false as const, error: (error as Error).message };
  }
}

export async function listReportVersionsAction(projectId: string) {
  try {
    const user = await getCurrentUser();
    const db = getDb();
    const project = await new PgProjectRepository(db).findById(projectId);
    if (project && user && !canAccessProject(user, project)) {
      return {
        success: false as const,
        error:
          "Access denied. You do not have permission to view reports for this project.",
        reports: [],
      };
    }

    return {
      success: true as const,
      reports: await new PgReportMetadataRepository(db).findByProjectId(
        projectId,
      ),
    };
  } catch (error) {
    return {
      success: false as const,
      error: (error as Error).message,
      reports: [],
    };
  }
}

export async function getReportVersionAction(
  projectId: string,
  reportId: string,
) {
  const user = await getCurrentUser();
  const db = getDb();
  const project = await new PgProjectRepository(db).findById(projectId);
  if (project && user && !canAccessProject(user, project)) {
    return {
      success: false as const,
      error: "Access denied. You do not have permission to view this report.",
    };
  }

  const report = await new PgReportMetadataRepository(db).findById(reportId);
  if (!report || report.projectId !== projectId)
    return {
      success: false as const,
      error: "Report not found for this project.",
    };
  return {
    success: true as const,
    report,
    model: report.content as DprReportModel | null,
  };
}

export async function downloadReportArtifactAction(
  projectId: string,
  reportId: string,
  format: "PDF" | "DOCX" | "XLSX",
) {
  const user = await getCurrentUser();
  const db = getDb();
  const project = await new PgProjectRepository(db).findById(projectId);
  if (project && user && !canAccessProject(user, project)) {
    return {
      success: false as const,
      error:
        "Access denied. You do not have permission to download reports for this project.",
    };
  }

  const report = await new PgReportMetadataRepository(db).findById(reportId);
  if (!report || report.projectId !== projectId || report.status !== "READY")
    return {
      success: false as const,
      error: "Ready report not found for this project.",
    };
  const documentId =
    format === "PDF"
      ? report.pdfDocumentId
      : format === "DOCX"
        ? report.docxDocumentId
        : report.excelDocumentId;
  if (!documentId)
    return {
      success: false as const,
      error: `${format} artifact is unavailable.`,
    };
  const document = await new PgDocumentMetadataRepository(db).findById(
    documentId,
  );
  if (
    !document ||
    document.projectId !== projectId ||
    !document.storageKey ||
    document.kind !== "PROJECT_REPORT"
  )
    return {
      success: false as const,
      error: "Artifact association check failed.",
    };
  const content = await getReportArtifactStorage().get(document.storageKey);
  if (!content)
    return { success: false as const, error: "Artifact file is unavailable." };
  return {
    success: true as const,
    filename:
      document.originalFilename ?? `ProjectSetu_DPR.${format.toLowerCase()}`,
    mimeType: document.mimeType ?? "application/octet-stream",
    base64: content.toString("base64"),
  };
}
