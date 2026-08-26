import { describe, expect, it } from "vitest";

import { SlidingWindowRateLimiter } from "./rate-limiter";

describe("Rate Limiter", () => {
  it("allows requests within configured limit", () => {
    const limiter = new SlidingWindowRateLimiter(1000, 3);

    const r1 = limiter.check("ip-1");
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = limiter.check("ip-1");
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = limiter.check("ip-1");
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);

    // 4th request exceeds limit
    const r4 = limiter.check("ip-1");
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
    expect(r4.resetAfterMs).toBeGreaterThan(0);

    limiter.dispose();
  });

  it("isolates rate limits between distinct keys", () => {
    const limiter = new SlidingWindowRateLimiter(1000, 2);

    limiter.check("user-A");
    limiter.check("user-A");
    expect(limiter.check("user-A").allowed).toBe(false);

    // User B should not be blocked
    expect(limiter.check("user-B").allowed).toBe(true);

    limiter.dispose();
  });

  it("resets limits when explicitly commanded", () => {
    const limiter = new SlidingWindowRateLimiter(1000, 2);

    limiter.check("user-C");
    limiter.check("user-C");
    expect(limiter.check("user-C").allowed).toBe(false);

    limiter.reset("user-C");
    expect(limiter.check("user-C").allowed).toBe(true);

    limiter.dispose();
  });
});
