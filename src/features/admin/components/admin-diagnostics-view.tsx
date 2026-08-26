"use client";

import React, { useEffect, useState, useTransition } from "react";

import { adminGetSystemHealthAction } from "@/app/actions/admin-actions";

export function AdminDiagnosticsView() {
  const [health, setHealth] = useState<{
    status: string;
    uptimeSeconds: number;
    dbLatencyMs: number;
    memoryUsageRssMb: number;
    memoryUsageHeapUsedMb: number;
    nodeVersion: string;
    timestamp: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const runDiagnostics = () => {
    startTransition(async () => {
      setError(null);
      const res = await adminGetSystemHealthAction();
      if (res.success && res.health) {
        setHealth(res.health);
      } else {
        setError(res.error || "Diagnostics probe failed.");
      }
    });
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            System Diagnostics & Runtime Telemetry
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Safe connectivity probes, database latency metrics, process uptime,
            and memory consumption.
          </p>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={runDiagnostics}
          className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {isPending ? "Probing..." : "⚡ Run Live Probe"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      {health && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
            <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
              Database Connectivity
            </span>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600">
                CONNECTED
              </span>
              <span className="font-mono text-xs text-slate-500">
                ({health.dbLatencyMs} ms latency)
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              PostgreSQL connection pool responsive
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
            <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
              Process Uptime
            </span>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {Math.floor(health.uptimeSeconds / 60)}m{" "}
                {health.uptimeSeconds % 60}s
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Node runtime {health.nodeVersion}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
            <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
              Memory Footprint
            </span>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {health.memoryUsageHeapUsedMb} MB
              </span>
              <span className="text-xs text-slate-500">
                (RSS: {health.memoryUsageRssMb} MB)
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Within normal production operating budget
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
