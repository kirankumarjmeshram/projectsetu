/**
 * Architecture verification: ensures the domain layer has ZERO imports from
 * the persistence layer or any database-related packages.
 *
 * This test runs without a database and is part of the normal `npm test` suite.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function getDomainTsFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...getDomainTsFiles(fullPath));
    } else if (entry.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("architecture boundary verification", () => {
  const domainDir = join(process.cwd(), "src", "domain");
  const allDomainFiles = getDomainTsFiles(domainDir);
  const domainSourceFiles = allDomainFiles.filter(
    (f) => !f.endsWith(".test.ts"),
  );

  it("domain layer has zero imports from persistence layer", () => {
    const persistenceImportPattern =
      /from\s+['"].*(?:persistence|drizzle-orm|pg['"])/;
    const violations: string[] = [];

    for (const file of domainSourceFiles) {
      const content = readFileSync(file, "utf-8");
      if (persistenceImportPattern.test(content)) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });

  it("domain layer does not import zod", () => {
    const zodImportPattern = /from\s+['"]zod['"]/;
    const violations: string[] = [];

    for (const file of domainSourceFiles) {
      const content = readFileSync(file, "utf-8");
      if (zodImportPattern.test(content)) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });

  it("domain layer does not import database client modules", () => {
    const dbImportPattern =
      /from\s+['"](?:pg|drizzle-orm|drizzle-kit|@neondatabase|postgres)['"]/;
    const violations: string[] = [];

    for (const file of allDomainFiles) {
      const content = readFileSync(file, "utf-8");
      if (dbImportPattern.test(content)) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });

  it("@paralleldrive/cuid2 is not installed", () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf-8"),
    );

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    expect(allDeps["@paralleldrive/cuid2"]).toBeUndefined();
  });
});
