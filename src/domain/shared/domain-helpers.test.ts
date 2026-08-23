import { describe, expect, it } from "vitest";

import { isProjectionYear } from "./types";
import { hasValidationErrors, type ValidationResult } from "./validation";

describe("isProjectionYear", () => {
  it.each([1, 5, 25])("accepts positive integer year %i", (year) => {
    expect(isProjectionYear(year)).toBe(true);
  });

  it.each([0, -1, 1.5, Number.NaN])("rejects invalid year %s", (year) => {
    expect(isProjectionYear(year)).toBe(false);
  });
});

describe("hasValidationErrors", () => {
  it("distinguishes blocking errors from non-blocking issues", () => {
    const warningsOnly: ValidationResult = {
      issues: [
        {
          severity: "WARNING",
          code: "DEMO_WARNING",
          message: "Synthetic warning",
        },
      ],
    };
    const withError: ValidationResult = {
      issues: [
        { severity: "ERROR", code: "DEMO_ERROR", message: "Synthetic error" },
      ],
    };

    expect(hasValidationErrors(warningsOnly)).toBe(false);
    expect(hasValidationErrors(withError)).toBe(true);
  });
});
