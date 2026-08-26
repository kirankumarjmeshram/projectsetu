import { NextResponse } from "next/server";

import { getAppConfig } from "@/lib/env";
import { getPool } from "@/lib/persistence/db";

/**
 * Dependency Readiness Probe (/api/ready)
 *
 * Used by load balancers and deployment routers to determine whether
 * ProjectSetu is fully ready to serve user traffic by validating
 * PostgreSQL database connectivity and pool responsiveness.
 *
 * Returns 200 OK if PostgreSQL is connected, or 503 Service Unavailable
 * if database connectivity fails.
 *
 * SECURITY: Never exposes database credentials, host IPs, or raw error stacks.
 */
export async function GET() {
  const config = getAppConfig();
  const startTime = Date.now();

  try {
    const pool = getPool();

    // Fast and safe connection probe
    const client = await pool.connect();
    try {
      await client.query("SELECT 1 as readiness_probe;");
    } finally {
      client.release();
    }

    const latencyMs = Date.now() - startTime;

    return NextResponse.json(
      {
        status: "ready",
        timestamp: new Date().toISOString(),
        database: "connected",
        latencyMs,
        version: config.appVersion,
        pool: {
          totalCount: pool.totalCount,
          idleCount: pool.idleCount,
          waitingCount: pool.waitingCount,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    // Sanitized server logging
    console.error(
      "[Readiness Check Failure] PostgreSQL connection error:",
      (error as Error).message,
    );

    return NextResponse.json(
      {
        status: "not_ready",
        timestamp: new Date().toISOString(),
        database: "disconnected",
        error: "Database connectivity check failed.",
      },
      { status: 503 },
    );
  }
}
