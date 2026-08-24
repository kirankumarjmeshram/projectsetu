import { describe, expect, it } from "vitest";

import { isSchemeVersionStatus } from "./scheme";

describe("isSchemeVersionStatus", () => {
  it("recognizes supported lifecycle states", () => {
    expect(isSchemeVersionStatus("ACTIVE")).toBe(true);
    expect(isSchemeVersionStatus("RETIRED")).toBe(true);
  });

  it("rejects invented lifecycle states", () => {
    expect(isSchemeVersionStatus("CURRENT")).toBe(false);
  });
});
