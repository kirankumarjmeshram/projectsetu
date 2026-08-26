import { NextResponse } from "next/server";

import { getAppConfig } from "@/lib/env";

/**
 * Process Liveness Probe (/api/health)
 *
 * Used by orchestrators (Docker, Kubernetes, load balancers) to determine
 * whether the Next.js Node process is running and accepting HTTP requests.
 *
 * Responds immediately with 200 OK without invoking external dependencies.
 */
export async function GET() {
  const config = getAppConfig();

  return NextResponse.json(
    {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: config.appVersion,
      uptimeSeconds: Math.floor(process.uptime()),
    },
    { status: 200 },
  );
}
