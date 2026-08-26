import { describe, expect, it } from "vitest";

import {
  generateSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "./session";

describe("Session Utilities", () => {
  it("generates 64-character random hex session tokens", () => {
    const token1 = generateSessionToken();
    const token2 = generateSessionToken();

    expect(token1).toHaveLength(64);
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);
  });

  it("uses standard secure cookie parameters", () => {
    expect(SESSION_COOKIE_NAME).toBe("projectsetu_session");
    expect(SESSION_MAX_AGE_SECONDS).toBe(30 * 24 * 60 * 60);
  });
});
