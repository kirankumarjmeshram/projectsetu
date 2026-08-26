"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";

import { adminListProjectsAction } from "@/app/actions/admin-actions";

interface ProjectRow {
  id: string;
  name: string;
  mode: string;
  stage: string;
  status: string;
  industryActivity: string;
  ownerId?: string | null;
  ownerEmail?: string;
  revision: number;
  createdAt: Date;
}

export function AdminProjectsView() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const loadProjects = () => {
    startTransition(async () => {
      const res = await adminListProjectsAction();
      if (res.success && res.projects) {
        setProjects(res.projects as ProjectRow[]);
      } else {
        setError(res.error || "Failed to load tenant projects.");
      }
    });
  };

  useEffect(() => {
    let mounted = true;
    void adminListProjectsAction().then((res) => {
      if (mounted && res.success && res.projects) {
        setProjects(res.projects as ProjectRow[]);
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
            Tenant Projects & Portfolio Explorer
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Global view of all project financial models across registered tenant
            accounts.
          </p>
        </div>
        <button
          type="button"
          onClick={loadProjects}
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
                <th className="px-6 py-4">Project Name</th>
                <th className="px-6 py-4">Owner / Tenant</th>
                <th className="px-6 py-4">Mode</th>
                <th className="px-6 py-4">Activity</th>
                <th className="px-6 py-4">Stage</th>
                <th className="px-6 py-4">Revision</th>
                <th className="px-6 py-4">Created</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 font-bold text-slate-900">
                    <Link
                      href={`/projects/${p.id}`}
                      className="underline-offset-2 hover:text-indigo-600 hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-600">
                    {p.ownerEmail || "Unassigned"}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                      {p.mode}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-700">
                    {p.industryActivity}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                      {p.stage}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-500">
                    v{p.revision}
                  </td>
                  <td className="px-6 py-4 text-slate-400">
                    {new Date(p.createdAt).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/projects/${p.id}`}
                      className="rounded bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-100"
                    >
                      Inspect →
                    </Link>
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
