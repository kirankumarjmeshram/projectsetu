import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { LocalReportArtifactStorage } from "./storage";

const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await fs.rm(directory, { recursive: true, force: true });
});

describe("LocalReportArtifactStorage", () => {
  it("stores generated artifacts outside PostgreSQL and retrieves only scoped keys", async () => {
    const directory = await fs.mkdtemp(
      path.join(os.tmpdir(), "projectsetu-report-"),
    );
    directories.push(directory);
    const storage = new LocalReportArtifactStorage(directory);
    const stored = await storage.put("project-1", {
      format: "PDF",
      filename: "ProjectSetu_Test_DPR_v1.pdf",
      mimeType: "application/pdf",
      content: Buffer.from("%PDF-test"),
    });
    expect(stored.storageKey).toMatch(/^projects\/project-1\/reports\//);
    expect((await storage.get(stored.storageKey))?.toString()).toBe(
      "%PDF-test",
    );
    await expect(storage.get("../secret")).rejects.toThrow(
      "Invalid report storage key",
    );
  });

  it("sanitizes artifact filenames and rejects untrusted project identifiers", async () => {
    const directory = await fs.mkdtemp(
      path.join(os.tmpdir(), "projectsetu-report-"),
    );
    directories.push(directory);
    const storage = new LocalReportArtifactStorage(directory);
    const stored = await storage.put("project-2", {
      format: "DOCX",
      filename: "../../unsafe report.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      content: Buffer.from("PK"),
    });
    expect(stored.storageKey).not.toContain("..");
    await expect(
      storage.put("../project", {
        format: "PDF",
        filename: "x.pdf",
        mimeType: "application/pdf",
        content: Buffer.from("x"),
      }),
    ).rejects.toThrow("Invalid project ID");
  });
});
