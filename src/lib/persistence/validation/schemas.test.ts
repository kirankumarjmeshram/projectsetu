import { describe, expect, it } from "vitest";

import {
  validateCalculationSnapshot,
  validateDecimalString,
  validateFundingSnapshot,
  validateProjectInputSnapshot,
  validateReportSections,
} from "./schemas";

describe("validateProjectInputSnapshot", () => {
  const validSnapshot = {
    project: {
      name: "Test Project",
      mode: "BANKABLE",
      industryActivity: "Food Processing",
      stage: "CONCEPT",
      status: "DRAFT",
      projectionPeriodYears: 5,
      location: {
        address: {
          lines: ["123 Main St"],
          district: "Mumbai",
          state: "Maharashtra",
        },
        areaClassification: "URBAN",
      },
    },
  };

  it("accepts a valid project input snapshot", () => {
    const result = validateProjectInputSnapshot(validSnapshot);
    expect(result.project.name).toBe("Test Project");
    expect(result.project.mode).toBe("BANKABLE");
  });

  it("accepts snapshot with optional fields", () => {
    const snapshot = {
      ...validSnapshot,
      applicant: { name: "Test Applicant" },
      costItems: [{ id: "1", amount: "1000" }],
    };
    const result = validateProjectInputSnapshot(snapshot);
    expect(result.applicant).toBeDefined();
  });

  it("rejects snapshot missing required project fields", () => {
    expect(() =>
      validateProjectInputSnapshot({ project: { name: "Test" } }),
    ).toThrow();
  });

  it("rejects snapshot with invalid project mode", () => {
    expect(() =>
      validateProjectInputSnapshot({
        ...validSnapshot,
        project: { ...validSnapshot.project, mode: "INVALID" },
      }),
    ).toThrow();
  });

  it("rejects snapshot with invalid area classification", () => {
    expect(() =>
      validateProjectInputSnapshot({
        ...validSnapshot,
        project: {
          ...validSnapshot.project,
          location: {
            ...validSnapshot.project.location,
            areaClassification: "SUBURBAN",
          },
        },
      }),
    ).toThrow();
  });
});

describe("validateCalculationSnapshot", () => {
  it("accepts a valid calculation snapshot envelope", () => {
    const result = validateCalculationSnapshot({
      snapshotType: "DEPRECIATION",
      schemaVersion: 1,
      data: { some: "calculation result" },
    });
    expect(result.snapshotType).toBe("DEPRECIATION");
    expect(result.schemaVersion).toBe(1);
  });

  it("rejects missing snapshot type", () => {
    expect(() => validateCalculationSnapshot({ schemaVersion: 1 })).toThrow();
  });

  it("rejects non-positive schema version", () => {
    expect(() =>
      validateCalculationSnapshot({ snapshotType: "TEST", schemaVersion: 0 }),
    ).toThrow();
  });
});

describe("validateFundingSnapshot", () => {
  it("accepts a valid funding snapshot", () => {
    const result = validateFundingSnapshot({
      snapshotType: "FUNDING_COMPOSER",
      schemaVersion: 1,
      projectId: "test-project-id",
      evaluationAsOfDate: "2024-01-01",
      mode: "MULTI_PROGRAM",
      resolutionStatus: "RESOLVED",
    });
    expect(result.mode).toBe("MULTI_PROGRAM");
  });

  it("rejects missing required fields", () => {
    expect(() =>
      validateFundingSnapshot({
        snapshotType: "FUNDING_COMPOSER",
        schemaVersion: 1,
      }),
    ).toThrow();
  });
});

describe("validateReportSections", () => {
  it("accepts a valid sections array", () => {
    const result = validateReportSections([
      { sectionCode: "EXECUTIVE_SUMMARY", included: true, order: 1 },
      { sectionCode: "FINANCIAL_ANALYSIS", included: false },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].sectionCode).toBe("EXECUTIVE_SUMMARY");
  });

  it("rejects non-array input", () => {
    expect(() => validateReportSections("not an array")).toThrow();
  });

  it("rejects sections with missing required fields", () => {
    expect(() => validateReportSections([{ sectionCode: "TEST" }])).toThrow();
  });
});

describe("validateDecimalString", () => {
  it("accepts valid decimal strings", () => {
    expect(validateDecimalString("0")).toBe("0");
    expect(validateDecimalString("1234.56")).toBe("1234.56");
    expect(validateDecimalString("-99.99")).toBe("-99.99");
  });

  it("rejects NaN", () => {
    expect(() => validateDecimalString("NaN")).toThrow();
  });

  it("rejects scientific notation", () => {
    expect(() => validateDecimalString("1e5")).toThrow();
  });

  it("rejects non-string input", () => {
    expect(() => validateDecimalString(42)).toThrow();
  });
});
