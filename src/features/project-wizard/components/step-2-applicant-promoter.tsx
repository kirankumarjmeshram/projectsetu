import React from "react";

import type { ApplicantPromoterInput } from "@/lib/application/orchestrator/orchestrator-types";

interface Step2ApplicantPromoterProps {
  value: ApplicantPromoterInput;
  onChange: (updated: ApplicantPromoterInput) => void;
}

export function Step2ApplicantPromoter({
  value,
  onChange,
}: Step2ApplicantPromoterProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900">
          Step 2: Applicant & Promoter Profile
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Promoter demographics, social category, enterprise constitution, and
          background qualifications.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Applicant / Entity Constitution *
          </label>
          <select
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.applicantType}
            onChange={(e) =>
              onChange({
                ...value,
                applicantType: e.target
                  .value as ApplicantPromoterInput["applicantType"],
              })
            }
          >
            <option value="INDIVIDUAL">
              Individual Entrepreneur / Proprietorship
            </option>
            <option value="PARTNERSHIP">Partnership Firm</option>
            <option value="SHG">Self Help Group (SHG)</option>
            <option value="FPO">Farmer Producer Company / FPO</option>
            <option value="COOPERATIVE">Cooperative Society</option>
            <option value="PRIVATE_LIMITED">Private Limited Company</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Lead Promoter / Contact Name *
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="e.g. Ramesh Patil"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Social Category / Reservation Class *
          </label>
          <select
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.socialCategory}
            onChange={(e) =>
              onChange({
                ...value,
                socialCategory: e.target
                  .value as ApplicantPromoterInput["socialCategory"],
              })
            }
          >
            <option value="GENERAL">General</option>
            <option value="OBC">OBC (Other Backward Class)</option>
            <option value="SC">SC (Scheduled Caste)</option>
            <option value="ST">ST (Scheduled Tribe)</option>
            <option value="MINORITY">
              Minority (Muslim / Christian / Sikh / Buddhist / Jain)
            </option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Gender *
          </label>
          <select
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.gender}
            onChange={(e) =>
              onChange({
                ...value,
                gender: e.target.value as ApplicantPromoterInput["gender"],
              })
            }
          >
            <option value="MALE">Male</option>
            <option value="FEMALE">Female (Special Category Subsidy)</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Educational Qualification *
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.educationQualification}
            onChange={(e) =>
              onChange({ ...value, educationQualification: e.target.value })
            }
            placeholder="e.g. B.Tech / Graduate / 12th Pass"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Relevant Experience (Years)
          </label>
          <input
            type="number"
            min={0}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.experienceYears || 0}
            onChange={(e) =>
              onChange({
                ...value,
                experienceYears: Number.parseInt(e.target.value) || 0,
              })
            }
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Enterprise Status *
          </label>
          <select
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.enterpriseStatus}
            onChange={(e) =>
              onChange({
                ...value,
                enterpriseStatus: e.target
                  .value as ApplicantPromoterInput["enterpriseStatus"],
              })
            }
          >
            <option value="NEW">New Greenfield Project</option>
            <option value="EXISTING">
              Existing Enterprise (Expansion / Modernisation)
            </option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            EDP Training Status
          </label>
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="edp"
              className="h-4 w-4 rounded-sm border-slate-300 text-emerald-600"
              checked={value.edpTrainingCompleted}
              onChange={(e) =>
                onChange({ ...value, edpTrainingCompleted: e.target.checked })
              }
            />
            <label htmlFor="edp" className="text-xs text-slate-700">
              Completed or undergoing mandatory EDP training
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
