import { describe, expect, it } from "vitest";

import { generateId } from "./id";

describe("generateId", () => {
  it("returns a valid UUID v4 string", () => {
    const id = generateId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it("returns a string compatible with the domain Identifier type", () => {
    const id: string = generateId();
    expect(typeof id).toBe("string");
    expect(id.length).toBe(36);
  });
});
