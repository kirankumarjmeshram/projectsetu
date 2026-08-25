"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createProjectAction } from "@/app/actions/project-actions";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateProjectModal({
  isOpen,
  onClose,
}: CreateProjectModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"SUBSIDY" | "BANKABLE" | "SELF_FUNDED">(
    "SUBSIDY",
  );
  const [industryActivity, setIndustryActivity] = useState(
    "Manufacturing / Food Processing",
  );
  const [areaClassification, setAreaClassification] = useState<
    "RURAL" | "URBAN" | "UNCLASSIFIED"
  >("RURAL");
  const [projectionPeriodYears, setProjectionPeriodYears] = useState(5);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please provide a project name.");
      return;
    }

    startTransition(async () => {
      setError(null);
      const res = await createProjectAction({
        name: name.trim(),
        mode,
        industryActivity,
        areaClassification,
        projectionPeriodYears,
      });

      if (res.success && res.projectId) {
        onClose();
        router.push(`/projects/${res.projectId}`);
      } else {
        setError(res.error || "Failed to create project.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Create New Project
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Set up initial project parameters and launch the 10-step wizard.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-lg font-bold text-slate-400 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              Project / Enterprise Name *
            </label>
            <input
              type="text"
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mahalakshmi Agro Food Processing Unit"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Operating Mode
              </label>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-hidden"
                value={mode}
                onChange={(e) =>
                  setMode(
                    e.target.value as "SUBSIDY" | "BANKABLE" | "SELF_FUNDED",
                  )
                }
              >
                <option value="SUBSIDY">Government Subsidy Linked</option>
                <option value="BANKABLE">Commercial Bankable</option>
                <option value="SELF_FUNDED">Self-Funded</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Area Location
              </label>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-hidden"
                value={areaClassification}
                onChange={(e) =>
                  setAreaClassification(
                    e.target.value as "RURAL" | "URBAN" | "UNCLASSIFIED",
                  )
                }
              >
                <option value="RURAL">Rural (Higher Subsidy)</option>
                <option value="URBAN">Urban</option>
                <option value="UNCLASSIFIED">Semi-Urban</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Sector Activity
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-hidden"
                value={industryActivity}
                onChange={(e) => setIndustryActivity(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Projection Period
              </label>
              <input
                type="number"
                min={1}
                max={15}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-hidden"
                value={projectionPeriodYears}
                onChange={(e) =>
                  setProjectionPeriodYears(Number.parseInt(e.target.value) || 5)
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-emerald-700 px-5 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-emerald-800 disabled:opacity-50"
            >
              {isPending ? "Creating..." : "Create & Open Wizard →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
