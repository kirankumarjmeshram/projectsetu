import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { StorageGetResult, StoragePutResult } from "./contracts";
import { validateUploadedDocument } from "./validation";

export interface DocumentStorage {
  put(
    projectId: string,
    filename: string,
    content: Buffer | Uint8Array,
    mimeType?: string,
  ): Promise<StoragePutResult>;
  get(storageKey: string): Promise<StorageGetResult | null>;
  delete(storageKey: string): Promise<boolean>;
  exists(storageKey: string): Promise<boolean>;
}

export class InvalidStorageKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStorageKeyError";
  }
}

export class LocalDocumentStorage implements DocumentStorage {
  private readonly baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.resolve(process.cwd(), "data", "documents");
  }

  private sanitizeFilename(filename: string): string {
    // Strip path elements, spaces, and non-alphanumeric characters except dot and hyphen
    const base = path.basename(filename);
    const clean = base.replace(/[^a-zA-Z0-9._-]/g, "_");
    return clean.slice(0, 100) || "document";
  }

  public validateStorageKey(storageKey: string): void {
    if (!storageKey || typeof storageKey !== "string") {
      throw new InvalidStorageKeyError("Storage key is required.");
    }
    // Prevent traversal attacks
    if (
      storageKey.includes("..") ||
      storageKey.includes("\0") ||
      storageKey.includes(":") ||
      path.isAbsolute(storageKey) ||
      storageKey.startsWith("/") ||
      storageKey.startsWith("\\")
    ) {
      throw new InvalidStorageKeyError(
        `Invalid storage key '${storageKey}': Path traversal or absolute paths are strictly prohibited.`,
      );
    }
    if (!storageKey.startsWith("projects/")) {
      throw new InvalidStorageKeyError(
        `Invalid storage key '${storageKey}': Key must be scoped under projects/.`,
      );
    }
  }

  private getAbsolutePath(storageKey: string): string {
    this.validateStorageKey(storageKey);
    const resolved = path.resolve(this.baseDir, storageKey);
    // Double-check resolved path is strictly within baseDir
    if (!resolved.startsWith(this.baseDir)) {
      throw new InvalidStorageKeyError(
        "Resolved storage path escapes root storage directory.",
      );
    }
    return resolved;
  }

  async put(
    projectId: string,
    filename: string,
    content: Buffer | Uint8Array,
    declaredMimeType?: string,
  ): Promise<StoragePutResult> {
    if (
      !projectId ||
      typeof projectId !== "string" ||
      projectId.trim() === ""
    ) {
      throw new Error("Project ID is required for document storage.");
    }

    const validation = validateUploadedDocument(
      filename,
      content,
      declaredMimeType,
    );
    if (!validation.valid) {
      throw new Error(validation.error || "Invalid document upload.");
    }

    const checksumSha256 = crypto
      .createHash("sha256")
      .update(content)
      .digest("hex");

    const sanitized = this.sanitizeFilename(filename);
    const timestamp = Date.now();
    const randomSuffix = crypto.randomUUID().slice(0, 8);
    const storageKey = `projects/${projectId}/${timestamp}_${randomSuffix}_${sanitized}`;

    const filePath = this.getAbsolutePath(storageKey);
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content);

    return {
      storageKey,
      checksumSha256,
      sizeBytes: content.length.toString(),
      mimeType: validation.mimeType,
    };
  }

  async get(storageKey: string): Promise<StorageGetResult | null> {
    try {
      const filePath = this.getAbsolutePath(storageKey);
      const content = await fs.readFile(filePath);
      return {
        storageKey,
        content,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async delete(storageKey: string): Promise<boolean> {
    try {
      const filePath = this.getAbsolutePath(storageKey);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }
      throw error;
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      const filePath = this.getAbsolutePath(storageKey);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// Global default storage instance
let defaultStorage: DocumentStorage | null = null;

export function getDocumentStorage(): DocumentStorage {
  if (!defaultStorage) {
    defaultStorage = new LocalDocumentStorage();
  }
  return defaultStorage;
}
