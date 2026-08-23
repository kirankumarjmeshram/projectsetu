import { describe, expect, it } from "vitest";

import { isProjectStatus } from "./project-status";

describe("isProjectStatus", () => {
  it("accepts a known project status", () => {
    expect(isProjectStatus("draft")).toBe(true);
  });

  it("rejects an unknown project status", () => {
    expect(isProjectStatus("approved")).toBe(false);
  });
});
