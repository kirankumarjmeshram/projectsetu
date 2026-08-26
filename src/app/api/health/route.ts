import { NextResponse } from "next/server";

import { getDb } from "@/lib/persistence/db";
import { PgProjectRepository } from "@/lib/persistence/repositories";

export async function GET() {
  const startTime = Date.now();
  try {
    const db = getDb();
    const projectRepo = new PgProjectRepository(db);
    // Safe connectivity probe
    await projectRepo.findById("00000000-0000-0000-0000-000000000000");

    const latencyMs = Date.now() - startTime;

    return NextResponse.json(
      {
        status: "healthy",
        timestamp: new Date().toISOString(),
        database: "connected",
        latencyMs,
        version: "0.1.0",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Health check failure:", error);
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        database: "disconnected",
        error: "Database connectivity check failed.",
      },
      { status: 503 },
    );
  }
}
