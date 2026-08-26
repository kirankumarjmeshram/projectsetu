import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { RenderedReportArtifact } from "./contracts";

export interface StoredReportArtifact {
  readonly storageKey: string;
  readonly checksumSha256: string;
  readonly sizeBytes: string;
  readonly mimeType: string;
}

export interface ReportArtifactStorage {
  put(
    projectId: string,
    artifact: RenderedReportArtifact,
  ): Promise<StoredReportArtifact>;
  get(storageKey: string): Promise<Buffer | null>;
}

export class LocalReportArtifactStorage implements ReportArtifactStorage {
  constructor(
    private readonly baseDir = path.resolve(process.cwd(), "data", "reports"),
  ) {}

  private resolveKey(storageKey: string): string {
    if (!/^projects\/[a-zA-Z0-9-]+\/reports\/[a-zA-Z0-9._-]+$/.test(storageKey))
      throw new Error("Invalid report storage key.");
    const resolved = path.resolve(this.baseDir, storageKey);
    const relative = path.relative(this.baseDir, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative))
      throw new Error("Report storage key escapes the storage root.");
    return resolved;
  }

  async put(
    projectId: string,
    artifact: RenderedReportArtifact,
  ): Promise<StoredReportArtifact> {
    if (!/^[a-zA-Z0-9-]+$/.test(projectId))
      throw new Error("Invalid project ID for report storage.");
    const safeFilename = path
      .basename(artifact.filename)
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 120);
    const storageKey = `projects/${projectId}/reports/${Date.now()}_${crypto.randomUUID().slice(0, 8)}_${safeFilename}`;
    const target = this.resolveKey(storageKey);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, artifact.content);
    return {
      storageKey,
      checksumSha256: crypto
        .createHash("sha256")
        .update(artifact.content)
        .digest("hex"),
      sizeBytes: artifact.content.length.toString(),
      mimeType: artifact.mimeType,
    };
  }

  async get(storageKey: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.resolveKey(storageKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
}

let defaultStorage: ReportArtifactStorage | undefined;
export function getReportArtifactStorage(): ReportArtifactStorage {
  defaultStorage ??= new LocalReportArtifactStorage();
  return defaultStorage;
}
