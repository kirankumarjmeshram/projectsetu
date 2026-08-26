"use client";

import React, { useEffect, useState, useTransition } from "react";

import { adminGetSchemeRegistryAction } from "@/app/actions/admin-actions";

interface SchemeVersionRow {
  versionId: string;
  guidelineName: string;
  guidelineDate: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status: string;
  sourceAuthority: string;
  sourceUrl?: string;
  keyRulesSummary: readonly string[];
}

interface SchemeEntry {
  id: string;
  name: string;
  shortName: string;
  ministry: string;
  level: string;
  jurisdiction: string;
  targetBeneficiaries: readonly string[];
  assistanceType: readonly string[];
  currentVersionId: string;
  versions: SchemeVersionRow[];
}

export function AdminSchemesView() {
  const [schemes, setSchemes] = useState<SchemeEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let mounted = true;
    startTransition(async () => {
      const res = await adminGetSchemeRegistryAction();
      if (mounted) {
        if (res.success && res.schemes) {
          setSchemes(res.schemes as SchemeEntry[]);
        } else {
          setError(res.error || "Failed to load scheme registry.");
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Government Scheme & Program Registry
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Version-controlled, code-backed authoritative subsidy and grant rules
          (PMEGP, NLM, PMFME, MUDRA, CMEGP).
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {schemes.map((scheme) => (
          <div
            key={scheme.id}
            className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5"
          >
            <div className="flex flex-col justify-between gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    {scheme.name}
                  </h3>
                  <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800">
                    {scheme.shortName}
                  </span>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                    {scheme.jurisdiction}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {scheme.ministry} • Level: {scheme.level}
                </p>
              </div>
              <div className="text-right">
                <span className="font-mono text-[11px] text-slate-400">
                  Active Version: {scheme.currentVersionId}
                </span>
              </div>
            </div>

            {/* Version History Table */}
            <div>
              <h4 className="mb-2 text-xs font-bold tracking-wider text-slate-400 uppercase">
                Version History & Guidelines
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[11px] font-bold text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Version</th>
                      <th className="px-4 py-2">Guideline</th>
                      <th className="px-4 py-2">Effective Period</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Authority / Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scheme.versions.map((v) => (
                      <tr key={v.versionId}>
                        <td className="px-4 py-2 font-mono font-bold text-indigo-600">
                          {v.versionId}
                        </td>
                        <td className="px-4 py-2 text-slate-800">
                          {v.guidelineName}
                        </td>
                        <td className="px-4 py-2 font-mono text-slate-500">
                          {v.effectiveFrom} → {v.effectiveTo || "Present"}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              v.status === "ACTIVE"
                                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {v.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-slate-500">
                          {v.sourceAuthority}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
