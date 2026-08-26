import { describe, expect, it } from "vitest";

import { GET as getHealth } from "./health/route";
import { GET as getReady } from "./ready/route";

describe("Operational Health & Readiness Endpoints", () => {
  it("GET /api/health returns 200 OK liveness status", async () => {
    const response = await getHealth();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.status).toBe("healthy");
    expect(json.version).toBeTruthy();
    expect(typeof json.uptimeSeconds).toBe("number");
    expect(json.timestamp).toBeTruthy();
  });

  it("GET /api/ready returns 200 OK readiness status against active database", async () => {
    const response = await getReady();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.status).toBe("ready");
    expect(json.database).toBe("connected");
    expect(typeof json.latencyMs).toBe("number");
    expect(json.pool).toBeDefined();
    expect(typeof json.pool.totalCount).toBe("number");
  });

  it("does not expose passwords, credentials or secrets in JSON responses", async () => {
    const healthRes = await getHealth();
    const readyRes = await getReady();

    const healthText = JSON.stringify(await healthRes.json());
    const readyText = JSON.stringify(await readyRes.json());

    expect(healthText).not.toContain("password");
    expect(healthText).not.toContain("AUTH_SECRET");
    expect(healthText).not.toContain("postgresql://");

    expect(readyText).not.toContain("password");
    expect(readyText).not.toContain("AUTH_SECRET");
    expect(readyText).not.toContain("postgresql://");
  });
});
