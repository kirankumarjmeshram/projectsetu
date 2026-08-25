import React from "react";

import type { OrchestrationIssue } from "@/lib/application/orchestrator/orchestrator-types";

interface IssuesViewProps {
  issues: readonly OrchestrationIssue[];
}

export function IssuesView({ issues }: IssuesViewProps) {
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">
          ✓
        </div>
        <div>
          <h4 className="text-sm font-bold text-emerald-950">
            All Assumptions & Balances Verified
          </h4>
          <p className="mt-0.5 text-xs text-emerald-800">
            Zero blocking errors. Financial statements, means of finance, and
            schedules are coherent.
          </p>
        </div>
      </div>
    );
  }

  const errors = issues.filter((i) => i.severity === "ERROR");
  const warnings = issues.filter((i) => i.severity === "WARNING");
  const manualReviews = issues.filter((i) => i.severity === "MANUAL_REVIEW");
  const infos = issues.filter((i) => i.severity === "INFO");

  return (
    <div className="space-y-4">
      {errors.length > 0 && (
        <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-rose-900">
            <span>⛔</span>
            <span>Blocking Errors ({errors.length})</span>
          </div>
          <ul className="list-inside list-disc space-y-1 text-xs text-rose-800">
            {errors.map((err, idx) => (
              <li key={idx}>
                <strong>{err.section ? `[${err.section}] ` : ""}</strong>
                {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
            <span>⚠️</span>
            <span>Warnings & Attention Items ({warnings.length})</span>
          </div>
          <ul className="list-inside list-disc space-y-1 text-xs text-amber-800">
            {warnings.map((warn, idx) => (
              <li key={idx}>
                <strong>{warn.section ? `[${warn.section}] ` : ""}</strong>
                {warn.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {manualReviews.length > 0 && (
        <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-blue-900">
            <span>📋</span>
            <span>Manual Review Flags ({manualReviews.length})</span>
          </div>
          <ul className="list-inside list-disc space-y-1 text-xs text-blue-800">
            {manualReviews.map((item, idx) => (
              <li key={idx}>
                <strong>{item.section ? `[${item.section}] ` : ""}</strong>
                {item.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {infos.length > 0 && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <span>ℹ️</span>
            <span>Informational Notices ({infos.length})</span>
          </div>
          <ul className="list-inside list-disc space-y-1 text-xs text-slate-700">
            {infos.map((info, idx) => (
              <li key={idx}>
                <strong>{info.section ? `[${info.section}] ` : ""}</strong>
                {info.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
