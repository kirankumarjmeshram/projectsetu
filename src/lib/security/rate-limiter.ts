/**
 * In-Memory Sliding Window Rate Limiter.
 *
 * Lightweight, zero-external-dependency rate limiter designed to protect
 * authentication actions and expensive operations against brute-force and abuse.
 */

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly resetAfterMs: number;
}

interface RateLimitEntry {
  timestamps: number[];
}

export class SlidingWindowRateLimiter {
  private readonly store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly windowMs: number = 60 * 1000,
    private readonly maxRequests: number = 10,
  ) {
    // Periodic garbage collection of expired keys
    if (typeof setInterval !== "undefined") {
      this.cleanupInterval = setInterval(
        () => this.cleanup(),
        this.windowMs * 2,
      );
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref();
      }
    }
  }

  /**
   * Evaluates whether an action identified by `key` is allowed within the current window.
   */
  check(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let entry = this.store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.store.set(key, entry);
    }

    // Filter out timestamps outside the active sliding window
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

    if (entry.timestamps.length >= this.maxRequests) {
      const oldestTimestamp = entry.timestamps[0];
      const resetAfterMs = Math.max(0, oldestTimestamp + this.windowMs - now);

      return {
        allowed: false,
        limit: this.maxRequests,
        remaining: 0,
        resetAfterMs,
      };
    }

    entry.timestamps.push(now);
    const remaining = this.maxRequests - entry.timestamps.length;

    return {
      allowed: true,
      limit: this.maxRequests,
      remaining,
      resetAfterMs: this.windowMs,
    };
  }

  /**
   * Resets rate limit counts for a given key (e.g., on successful authentication).
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Removes stale keys to prevent memory leaks.
   */
  cleanup(): void {
    const windowStart = Date.now() - this.windowMs;
    for (const [key, entry] of this.store.entries()) {
      entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);
      if (entry.timestamps.length === 0) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Destroys timer on shutdown.
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

/** Rate limiter instance for authentication attempts: 5 requests per 60 seconds per IP/Email. */
export const authRateLimiter = new SlidingWindowRateLimiter(60 * 1000, 5);

/** Rate limiter instance for report generation: 10 requests per 60 seconds per user. */
export const reportRateLimiter = new SlidingWindowRateLimiter(60 * 1000, 10);
