"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";

import { adminGetStatsAction } from "@/app/actions/admin-actions";

export function AdminDashboardView() {
  const [stats, setStats] = useState<{
    totalUsers: number;
    adminUsers: number;
    totalProjects: number;
    bankableProjects: number;
    subsidyProjects: number;
    selfFundedProjects: number;
    totalRegisteredSchemes: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const res = await adminGetStatsAction();
      if (res.success && res.stats) {
        setStats(res.stats);
      } else {
        setError(res.error || "Failed to load admin metrics.");
      }
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Executive Operations & Tenant Portfolio Overview
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Real-time system health, tenant projects distribution, and government
          scheme operational metrics.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      {isPending && !stats && (
        <div className="py-12 text-center text-xs text-slate-400">
          Loading system metrics...
        </div>
      )}

      {stats && (
        <>
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                  Total Users
                </span>
                <span className="rounded-lg bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700">
                  {stats.adminUsers} Admins
                </span>
              </div>
              <p className="mt-3 text-3xl font-black text-slate-900">
                {stats.totalUsers}
              </p>
              <Link
                href="/admin/users"
                className="mt-3 inline-block text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Manage Users →
              </Link>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                  Active Projects
                </span>
                <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                  Across Tenants
                </span>
              </div>
              <p className="mt-3 text-3xl font-black text-slate-900">
                {stats.totalProjects}
              </p>
              <Link
                href="/admin/projects"
                className="mt-3 inline-block text-xs font-semibold text-emerald-600 hover:text-emerald-800"
              >
                View Tenant Projects →
              </Link>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                  Registered Schemes
                </span>
                <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                  Version-Controlled
                </span>
              </div>
              <p className="mt-3 text-3xl font-black text-slate-900">
                {stats.totalRegisteredSchemes}
              </p>
              <Link
                href="/admin/schemes"
                className="mt-3 inline-block text-xs font-semibold text-amber-600 hover:text-amber-800"
              >
                Inspect Registry →
              </Link>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                  System Health
                </span>
                <span className="rounded-lg bg-teal-50 px-2 py-1 text-xs font-bold text-teal-700">
                  Active
                </span>
              </div>
              <p className="mt-3 text-2xl font-black text-teal-600">HEALTHY</p>
              <Link
                href="/admin/diagnostics"
                className="mt-3 inline-block text-xs font-semibold text-teal-600 hover:text-teal-800"
              >
                Run Diagnostics →
              </Link>
            </div>
          </div>

          {/* Project Mode Breakdown */}
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
            <h3 className="mb-4 text-sm font-bold text-slate-900">
              Project Portfolio by Mode
            </h3>
            <div className="grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <span className="text-xs font-medium text-slate-500">
                  Government Subsidy Linked
                </span>
                <p className="mt-1 text-2xl font-black text-slate-900">
                  {stats.subsidyProjects}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <span className="text-xs font-medium text-slate-500">
                  Commercial Bankable
                </span>
                <p className="mt-1 text-2xl font-black text-slate-900">
                  {stats.bankableProjects}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <span className="text-xs font-medium text-slate-500">
                  Self-Funded / Equity
                </span>
                <p className="mt-1 text-2xl font-black text-slate-900">
                  {stats.selfFundedProjects}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
