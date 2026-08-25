import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { InvalidStorageKeyError, LocalDocumentStorage } from "./storage";
import {
  detectMimeTypeFromBuffer,
  MAX_DOCUMENT_UPLOAD_BYTES,
  validateUploadedDocument,
} from "./validation";

describe("Document Storage & Validation Tests", () => {
  let tempDir: string;
  let storage: LocalDocumentStorage;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "projectsetu-doc-test-"));
    storage = new LocalDocumentStorage(tempDir);
  });

  afterAll(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  describe("File Validation & Magic Bytes", () => {
    it("detects PDF magic bytes (%PDF)", () => {
      const pdfHeader = Buffer.from([
        0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34,
      ]);
      expect(detectMimeTypeFromBuffer(pdfHeader)).toBe("application/pdf");
    });

    it("detects PNG magic bytes", () => {
      const pngHeader = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      expect(detectMimeTypeFromBuffer(pngHeader)).toBe("image/png");
    });

    it("detects JPEG magic bytes", () => {
      const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      expect(detectMimeTypeFromBuffer(jpegHeader)).toBe("image/jpeg");
    });

    it("detects WebP magic bytes", () => {
      const webpHeader = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      ]);
      expect(detectMimeTypeFromBuffer(webpHeader)).toBe("image/webp");
    });

    it("rejects empty files", () => {
      const res = validateUploadedDocument("test.pdf", Buffer.alloc(0));
      expect(res.valid).toBe(false);
      expect(res.error).toContain("empty");
    });

    it("rejects oversized files exceeding MAX_DOCUMENT_UPLOAD_BYTES", () => {
      const fakeContent = Buffer.alloc(MAX_DOCUMENT_UPLOAD_BYTES + 10);
      const res = validateUploadedDocument("large.pdf", fakeContent);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("exceeds the maximum allowed limit");
    });

    it("rejects unsupported executable extensions/formats", () => {
      const exeContent = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ executable
      const res = validateUploadedDocument("malicious.exe", exeContent);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Unsupported");
    });
  });

  describe("Local Document Storage Operations", () => {
    it("stores document with server-controlled key and computes sha256 checksum", async () => {
      const projectId = "proj-1234";
      const pdfContent = Buffer.from(
        "%PDF-1.4 sample quotation data for testing",
      );
      const result = await storage.put(
        projectId,
        "my quotation.pdf",
        pdfContent,
      );

      expect(result.storageKey).toMatch(
        /^projects\/proj-1234\/\d+_[a-f0-9-]+_my_quotation\.pdf$/,
      );
      expect(result.checksumSha256).toHaveLength(64);
      expect(result.sizeBytes).toBe(pdfContent.length.toString());
      expect(result.mimeType).toBe("application/pdf");

      const exists = await storage.exists(result.storageKey);
      expect(exists).toBe(true);

      const retrieved = await storage.get(result.storageKey);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.content.toString()).toBe(pdfContent.toString());

      const deleted = await storage.delete(result.storageKey);
      expect(deleted).toBe(true);
      expect(await storage.exists(result.storageKey)).toBe(false);
    });

    it("rejects path traversal attempts strictly", async () => {
      expect(() =>
        storage.validateStorageKey("projects/proj-1234/../../etc/passwd"),
      ).toThrow(InvalidStorageKeyError);

      expect(() => storage.validateStorageKey("/etc/passwd")).toThrow(
        InvalidStorageKeyError,
      );

      expect(() => storage.validateStorageKey("C:\\Windows\\System32")).toThrow(
        InvalidStorageKeyError,
      );

      expect(() =>
        storage.validateStorageKey("projects/proj-1234/null\0byte"),
      ).toThrow(InvalidStorageKeyError);
    });

    it("returns null for non-existent storage keys", async () => {
      const nonExistent = await storage.get(
        "projects/proj-1234/non_existent.pdf",
      );
      expect(nonExistent).toBeNull();
    });
  });
});
