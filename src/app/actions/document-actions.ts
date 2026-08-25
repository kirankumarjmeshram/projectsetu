"use server";

import { revalidatePath } from "next/cache";

import type { DocumentKind } from "@/lib/documents/contracts";
import { getDocumentStorage } from "@/lib/documents/storage";
import { getDb } from "@/lib/persistence/db";
import {
  PgDocumentMetadataRepository,
  PgProjectRepository,
} from "@/lib/persistence/repositories";

export async function uploadDocumentAction(formData: FormData) {
  try {
    const projectId = formData.get("projectId") as string;
    const kind = (formData.get("kind") as DocumentKind) || "OTHER";
    const displayName = (formData.get("displayName") as string) || null;
    const file = formData.get("file") as File | null;

    if (!projectId || typeof projectId !== "string") {
      return { success: false, error: "Project ID is required." };
    }

    if (!file || typeof file.arrayBuffer !== "function") {
      return { success: false, error: "No document file was uploaded." };
    }

    const db = getDb();
    const projectRepo = new PgProjectRepository(db);
    const existingProject = await projectRepo.findById(projectId);
    if (!existingProject) {
      return { success: false, error: "Project not found." };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const storage = getDocumentStorage();
    const storageResult = await storage.put(
      projectId,
      file.name,
      buffer,
      file.type,
    );

    const docRepo = new PgDocumentMetadataRepository(db);

    // Check for exact duplicate upload in this project
    const projectDocs = await docRepo.findByProjectId(projectId);
    const duplicate = projectDocs.find(
      (d) =>
        d.checksumSha256 === storageResult.checksumSha256 &&
        d.status !== "ARCHIVED",
    );

    const doc = await docRepo.create({
      projectId,
      kind,
      displayName: displayName || file.name,
      originalFilename: file.name,
      storageKey: storageResult.storageKey,
      mimeType: storageResult.mimeType,
      sizeBytes: storageResult.sizeBytes,
      checksumSha256: storageResult.checksumSha256,
      status: "UPLOADED",
    });

    revalidatePath(`/projects/${projectId}`);
    return {
      success: true,
      document: doc,
      warning: duplicate
        ? `Duplicate document detected: Identical file already exists as '${duplicate.displayName || duplicate.originalFilename}'.`
        : undefined,
    };
  } catch (error) {
    console.error("Failed to upload document:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function listProjectDocumentsAction(projectId: string) {
  try {
    const db = getDb();
    const docRepo = new PgDocumentMetadataRepository(db);
    const docs = await docRepo.findByProjectId(projectId);
    return { success: true, documents: docs };
  } catch (error) {
    console.error(`Failed to list documents for project ${projectId}:`, error);
    return { success: false, error: (error as Error).message, documents: [] };
  }
}

export async function getDocumentFileAction(documentId: string) {
  try {
    const db = getDb();
    const docRepo = new PgDocumentMetadataRepository(db);
    const doc = await docRepo.findById(documentId);
    if (!doc || !doc.storageKey) {
      return {
        success: false,
        error: "Document not found or has no stored file.",
      };
    }

    const storage = getDocumentStorage();
    const fileResult = await storage.get(doc.storageKey);
    if (!fileResult) {
      return {
        success: false,
        error: "Physical file could not be located in storage.",
      };
    }

    const base64 = fileResult.content.toString("base64");
    return {
      success: true,
      filename: doc.originalFilename || doc.displayName || "document",
      mimeType: doc.mimeType || "application/octet-stream",
      base64,
    };
  } catch (error) {
    console.error(`Failed to retrieve file for document ${documentId}:`, error);
    return { success: false, error: (error as Error).message };
  }
}

export async function archiveDocumentAction(documentId: string) {
  try {
    const db = getDb();
    const docRepo = new PgDocumentMetadataRepository(db);
    const updated = await docRepo.update(documentId, { status: "ARCHIVED" });
    if (!updated) {
      return { success: false, error: "Document not found." };
    }
    revalidatePath(`/projects/${updated.projectId}`);
    return { success: true, document: updated };
  } catch (error) {
    console.error(`Failed to archive document ${documentId}:`, error);
    return { success: false, error: (error as Error).message };
  }
}
