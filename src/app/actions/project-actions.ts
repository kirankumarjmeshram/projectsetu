"use server";

import { revalidatePath } from "next/cache";

import type {
  AreaClassification,
  ProjectMode,
  ProjectStage,
  ProjectStatus,
} from "@/domain/project/project";
import { canAccessProject, canMutateProject } from "@/lib/auth/authorization";
import { getCurrentUser } from "@/lib/auth/session";
import type {
  ProjectCalculationResult,
  ProjectWizardInput,
} from "@/lib/application/orchestrator/orchestrator-types";
import { orchestrateProjectCalculation } from "@/lib/application/orchestrator/calculation-orchestrator";
import { createEmptyProjectWizardInput } from "@/lib/application/orchestrator/orchestrator-defaults";
import { getDb } from "@/lib/persistence/db";
import {
  PgCalculationRunRepository,
  PgCalculationSnapshotRepository,
  PgFundingSnapshotRepository,
  PgInputSnapshotRepository,
  PgProjectRepository,
} from "@/lib/persistence/repositories";

export async function getProjectsAction() {
  try {
    const user = await getCurrentUser();
    if (!user)
      return {
        success: false,
        error: "Please sign in to view your projects.",
        projects: [],
      };
    const db = getDb();
    const projectRepo = new PgProjectRepository(db);

    const allProjects = await projectRepo.findAll();

    // Authorization filter
    const visibleProjects = allProjects.filter((p) =>
      canAccessProject(user, p),
    );

    return { success: true, projects: visibleProjects };
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return { success: false, error: (error as Error).message, projects: [] };
  }
}

export async function getProjectAction(projectId: string) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return {
        success: false,
        error: "Please sign in to view this project.",
        data: null,
      };
    const db = getDb();
    const projectRepo = new PgProjectRepository(db);
    const snapshotRepo = new PgInputSnapshotRepository(db);
    const runRepo = new PgCalculationRunRepository(db);
    const calculationSnapshotRepo = new PgCalculationSnapshotRepository(db);

    const project = await projectRepo.findById(projectId);
    if (!project) {
      return { success: false, error: "Project not found", data: null };
    }

    // Enforce tenant authorization
    if (!canAccessProject(user, project)) {
      return {
        success: false,
        error:
          "Access denied. You do not have permission to view this project.",
        data: null,
      };
    }

    const latestSnapshot = await snapshotRepo.findLatestByProjectId(projectId);
    let wizardInput: ProjectWizardInput;

    if (latestSnapshot && latestSnapshot.data) {
      const data = latestSnapshot.data as ProjectWizardInput;
      wizardInput = {
        ...data,
        project: {
          ...data.project,
          id: project.id,
          name: project.name,
        },
      };
    } else {
      wizardInput = createEmptyProjectWizardInput({
        id: project.id,
        name: project.name,
        mode: project.mode as ProjectMode,
        industryActivity: project.industryActivity,
        stage: project.stage as ProjectStage,
        status: project.status as ProjectStatus,
        areaClassification: project.areaClassification as AreaClassification,
        address: (
          project.location as {
            postalAddress?: ProjectWizardInput["project"]["address"];
          }
        )?.postalAddress,
        projectionPeriodYears: project.projectionPeriodYears,
      });
    }

    const latestCompletedRun = (await runRepo.findByProjectId(projectId))
      .filter(
        (run) =>
          run.status === "COMPLETED" &&
          run.inputSnapshotId === project.currentInputSnapshotId,
      )
      .sort(
        (left, right) => right.startedAt.getTime() - left.startedAt.getTime(),
      )
      .at(0);
    const calculationSnapshot = latestCompletedRun
      ? (
          await calculationSnapshotRepo.findByCalculationRunId(
            latestCompletedRun.id,
          )
        )[0]
      : undefined;

    return {
      success: true,
      data: {
        project,
        wizardInput,
        calculationResult:
          (calculationSnapshot?.data as ProjectCalculationResult | undefined) ??
          null,
      },
    };
  } catch (error) {
    console.error(`Failed to load project ${projectId}:`, error);
    return { success: false, error: (error as Error).message, data: null };
  }
}

export async function createProjectAction(data: {
  name: string;
  mode?: "SUBSIDY" | "BANKABLE" | "SELF_FUNDED";
  industryActivity?: string;
  projectionPeriodYears?: number;
  areaClassification?: "RURAL" | "URBAN" | "UNCLASSIFIED";
  enterpriseName?: string;
  applicantName?: string;
  applicantType?: ProjectWizardInput["applicant"]["applicantType"];
  projectDescription?: string;
  state?: string;
  district?: string;
}) {
  try {
    if (
      !data.name ||
      typeof data.name !== "string" ||
      data.name.trim() === ""
    ) {
      return { success: false, error: "Project name is required." };
    }
    const projectionPeriod = data.projectionPeriodYears || 5;
    if (
      !Number.isInteger(projectionPeriod) ||
      projectionPeriod < 1 ||
      projectionPeriod > 30
    ) {
      return {
        success: false,
        error: "Projection period must be between 1 and 30 years.",
      };
    }

    const user = await getCurrentUser();
    if (!user)
      return { success: false, error: "Please sign in to create a project." };
    const db = getDb();
    const projectRepo = new PgProjectRepository(db);
    const snapshotRepo = new PgInputSnapshotRepository(db);

    const newProject = await projectRepo.create({
      name: data.name.trim(),
      mode: data.mode || "BANKABLE",
      industryActivity: data.industryActivity?.trim() || "Not specified",
      stage: "PLANNING",
      status: "DRAFT",
      areaClassification: data.areaClassification || "UNCLASSIFIED",
      projectionPeriodYears: projectionPeriod,
      ownerId: user.id,
    });

    const defaultInput = createEmptyProjectWizardInput(
      {
        id: newProject.id,
        name: newProject.name,
        mode: newProject.mode as ProjectMode,
        industryActivity: newProject.industryActivity,
        stage: newProject.stage as ProjectStage,
        status: newProject.status as ProjectStatus,
        areaClassification: newProject.areaClassification as AreaClassification,
        enterpriseName: data.enterpriseName?.trim() || data.name.trim(),
        projectDescription: data.projectDescription?.trim() || "",
        address:
          data.state?.trim() || data.district?.trim()
            ? {
                lines: [],
                district: data.district?.trim() || "",
                state: data.state?.trim() || "",
              }
            : undefined,
        projectionPeriodYears: newProject.projectionPeriodYears,
      },
      {
        applicantName: data.applicantName?.trim(),
        applicantType: data.applicantType,
        projectDescription: data.projectDescription?.trim(),
      },
    );

    const snapshot = await snapshotRepo.create({
      projectId: newProject.id,
      snapshotType: "PROJECT_INPUT",
      schemaVersion: 1,
      revision: 1,
      data: defaultInput,
    });

    await projectRepo.update(newProject.id, newProject.revision, {
      currentInputSnapshotId: snapshot.id,
    });

    revalidatePath("/");
    revalidatePath("/projects");
    return { success: true, projectId: newProject.id };
  } catch (error) {
    console.error("Failed to create project:", error);
    return {
      success: false,
      error: "Failed to create project. Please try again.",
    };
  }
}

export async function saveProjectDraftAction(input: ProjectWizardInput) {
  try {
    if (!input?.project?.id || typeof input.project.id !== "string") {
      return { success: false, error: "Invalid project identifier." };
    }
    if (
      !input.project.name ||
      typeof input.project.name !== "string" ||
      input.project.name.trim() === ""
    ) {
      return { success: false, error: "Project name cannot be empty." };
    }

    const user = await getCurrentUser();
    if (!user)
      return { success: false, error: "Please sign in to save this project." };
    const db = getDb();
    const projectRepo = new PgProjectRepository(db);
    const snapshotRepo = new PgInputSnapshotRepository(db);

    const existing = await projectRepo.findById(input.project.id);
    if (!existing) {
      return { success: false, error: "Project not found." };
    }

    // Authorization check
    if (!canMutateProject(user, existing)) {
      return {
        success: false,
        error:
          "Access denied. You do not have permission to modify this project.",
      };
    }

    const nextRevision = existing.revision + 1;

    // Create immutable input snapshot
    const snapshot = await snapshotRepo.create({
      projectId: existing.id,
      snapshotType: "PROJECT_INPUT",
      schemaVersion: 1,
      revision: nextRevision,
      data: input,
    });

    // Update project metadata with optimistic concurrency
    const updateRes = await projectRepo.update(existing.id, existing.revision, {
      name: input.project.name,
      mode: input.project.mode,
      industryActivity: input.project.industryActivity,
      stage: input.project.stage,
      status: input.project.status,
      areaClassification: input.project.areaClassification,
      location: input.project.address
        ? {
            postalAddress: input.project.address,
            classificationSource: {
              sourceType: "USER_INPUT",
              title: "User Declared Location",
              documentKind: "OTHER",
            },
          }
        : undefined,
      projectionPeriodYears: input.project.projectionPeriodYears,
      currentInputSnapshotId: snapshot.id,
    });

    if (!updateRes.ok) {
      return { success: false, error: updateRes.error.message };
    }

    revalidatePath(`/projects/${input.project.id}`);
    revalidatePath("/");
    return { success: true, revision: nextRevision };
  } catch (error) {
    console.error("Failed to save project draft:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function runProjectCalculationAction(
  input: ProjectWizardInput,
): Promise<{
  success: boolean;
  result: ProjectCalculationResult;
  error?: string;
  inputSnapshotId?: string;
  calculationRunId?: string;
  calculationSnapshotId?: string;
  fundingSnapshotId?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Please sign in to calculate this project.");
    const db = getDb();
    const projectRepo = new PgProjectRepository(db);

    const existing = await projectRepo.findById(input.project.id);
    if (!existing) throw new Error("Project not found.");
    if (!canMutateProject(user, existing)) {
      throw new Error(
        "Access denied. You do not have permission to calculate projections for this project.",
      );
    }

    const result = orchestrateProjectCalculation(input);

    const runRepo = new PgCalculationRunRepository(db);
    const calcSnapshotRepo = new PgCalculationSnapshotRepository(db);
    const fundingSnapshotRepo = new PgFundingSnapshotRepository(db);

    const inputSnapshotId = existing?.currentInputSnapshotId;

    if (inputSnapshotId) {
      const run = await runRepo.create({
        projectId: input.project.id,
        inputSnapshotId,
        status: result.success ? "COMPLETED" : "FAILED",
        triggeredBy: user.email,
      });

      if (run) {
        const calculationSnapshot = await calcSnapshotRepo.create({
          projectId: input.project.id,
          calculationRunId: run.id,
          snapshotType: "FULL_FINANCIAL_PROJECTIONS",
          schemaVersion: 1,
          data: result,
        });

        let fundingSnapshotId: string | undefined;
        if (result.fundingComposer) {
          const fundingSnapshot = await fundingSnapshotRepo.create({
            projectId: input.project.id,
            calculationRunId: run.id,
            snapshotType: "FUNDING_COMPOSER",
            schemaVersion: 1,
            data: result.fundingComposer,
          });
          fundingSnapshotId = fundingSnapshot.id;
        }
        const blockingIssues = result.issues.filter(
          (issue) => issue.severity === "ERROR",
        );
        return {
          success: result.success,
          result,
          error:
            blockingIssues.length > 0
              ? blockingIssues.map((issue) => issue.message).join(" ")
              : undefined,
          inputSnapshotId,
          calculationRunId: run.id,
          calculationSnapshotId: calculationSnapshot.id,
          fundingSnapshotId,
        };
      }
    }

    return {
      success: false,
      result,
      error:
        "The saved project revision could not be identified. Save the draft and retry the calculation.",
    };
  } catch (error) {
    console.error("Failed to execute calculation run:", error);
    const fallbackResult = orchestrateProjectCalculation(input);
    return {
      success: false,
      result: fallbackResult,
      error:
        "The calculation could not be saved. Your draft remains available; please retry.",
    };
  }
}
