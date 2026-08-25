import React from "react";

import type { ProjectDetailsInput } from "@/lib/application/orchestrator/orchestrator-types";

interface Step1ProjectDetailsProps {
  value: ProjectDetailsInput;
  onChange: (updated: ProjectDetailsInput) => void;
}

export function Step1ProjectDetails({
  value,
  onChange,
}: Step1ProjectDetailsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900">
          Step 1: Project Identity & Location
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Define the project name, operating mode, industry activity, stage, and
          geographic classification.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs font-semibold text-slate-700">
            Project / Enterprise Name *
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="e.g. Shree Ganesh Agro Processing Unit"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Project Mode *
          </label>
          <select
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.mode}
            onChange={(e) =>
              onChange({
                ...value,
                mode: e.target.value as ProjectDetailsInput["mode"],
              })
            }
          >
            <option value="SUBSIDY">Government Subsidy / Scheme Linked</option>
            <option value="BANKABLE">Commercial Bankable Project</option>
            <option value="SELF_FUNDED">Self-Funded / Equity Project</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Industry / Sector Activity *
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.industryActivity}
            onChange={(e) =>
              onChange({ ...value, industryActivity: e.target.value })
            }
            placeholder="e.g. Food & Agro Processing"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Project Stage *
          </label>
          <select
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.stage}
            onChange={(e) =>
              onChange({
                ...value,
                stage: e.target.value as ProjectDetailsInput["stage"],
              })
            }
          >
            <option value="PLANNING">Planning & DPR Preparation</option>
            <option value="CONCEPT">Concept / Initial Feasibility</option>
            <option value="PRE_IMPLEMENTATION">Pre-Implementation</option>
            <option value="IMPLEMENTATION">
              Implementation / Construction
            </option>
            <option value="OPERATIONAL">Operational / Expansion</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Area Classification *
          </label>
          <select
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.areaClassification}
            onChange={(e) =>
              onChange({
                ...value,
                areaClassification: e.target
                  .value as ProjectDetailsInput["areaClassification"],
              })
            }
          >
            <option value="RURAL">
              Rural (Eligible for highest subsidy brackets)
            </option>
            <option value="URBAN">Urban</option>
            <option value="UNCLASSIFIED">Semi-Urban / Unclassified</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Projection Period (Years) *
          </label>
          <input
            type="number"
            min={1}
            max={15}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.projectionPeriodYears}
            onChange={(e) =>
              onChange({
                ...value,
                projectionPeriodYears: Number.parseInt(e.target.value) || 5,
              })
            }
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            State *
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.address?.state || ""}
            onChange={(e) =>
              onChange({
                ...value,
                address: {
                  lines: value.address?.lines ?? ["Industrial Area"],
                  district: value.address?.district ?? "",
                  villageTownCity: value.address?.villageTownCity,
                  pinCode: value.address?.pinCode,
                  state: e.target.value,
                },
              })
            }
            placeholder="e.g. Maharashtra"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            District *
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.address?.district || ""}
            onChange={(e) =>
              onChange({
                ...value,
                address: {
                  lines: value.address?.lines ?? ["Industrial Area"],
                  state: value.address?.state ?? "",
                  villageTownCity: value.address?.villageTownCity,
                  pinCode: value.address?.pinCode,
                  district: e.target.value,
                },
              })
            }
            placeholder="e.g. Pune"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            PIN Code
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.address?.pinCode || ""}
            onChange={(e) =>
              onChange({
                ...value,
                address: {
                  lines: value.address?.lines ?? ["Industrial Area"],
                  state: value.address?.state ?? "",
                  district: value.address?.district ?? "",
                  villageTownCity: value.address?.villageTownCity,
                  pinCode: e.target.value,
                },
              })
            }
            placeholder="e.g. 411001"
          />
        </div>
      </div>
    </div>
  );
}
