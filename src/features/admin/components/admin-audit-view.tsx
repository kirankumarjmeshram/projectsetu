"use client";

import React, { useEffect, useState, useTransition } from "react";

import { adminListAuditLogsAction } from "@/app/actions/admin-actions";

interface AuditLogEntry {
  id: string;
  actorUserId: string;
  actorEmail?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: unknown;
  createdAt: Date;
}

export function AdminAuditView() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadLogs = () => {
    startTransition(async () => {
      const res = await adminListAuditLogsAction(100);
      if (res.success && res.logs) {
        setLogs(res.logs as AuditLogEntry[]);
      } else {
        setError(res.error || "Failed to load audit trail.");
      }
    });
  };

  useEffect(() => {
    let mounted = true;
    void adminListAuditLogsAction(100).then((res) => {
      if (mounted && res.success && res.logs) {
        setLogs(res.logs as AuditLogEntry[]);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Administrative Audit Trail & Access Logs
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Immutable, append-only security logs of all administrative mutations
            and role adjustments.
          </p>
        </div>
        <button
          type="button"
          onClick={loadLogs}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              <tr>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Actor</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Entity Type</th>
                <th className="px-6 py-4">Entity ID</th>
                <th className="px-6 py-4">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 && !isPending && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-slate-400"
                  >
                    No administrative audit events recorded yet.
                  </td>
                </tr>
              )}
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 font-mono whitespace-nowrap text-slate-500">
                    {new Date(log.createdAt).toLocaleString("en-IN")}
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-800">
                    {log.actorEmail || log.actorUserId}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-700">
                    {log.entityType}
                  </td>
                  <td className="px-6 py-4 font-mono text-[11px] text-slate-400">
                    {log.entityId}
                  </td>
                  <td className="px-6 py-4 font-mono text-[11px] text-slate-500">
                    {log.metadata ? JSON.stringify(log.metadata) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
