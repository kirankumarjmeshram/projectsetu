import React from "react";
import Link from "next/link";

import type { PersistedProject } from "@/lib/persistence/repositories/types";

interface ProjectCardProps {
  project: PersistedProject;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const formattedDate = new Date(project.updatedAt).toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  );

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block space-y-4 rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-emerald-500 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-800 uppercase">
            {project.mode}
          </span>
          <h3 className="mt-2 text-base font-bold text-slate-900 transition-colors group-hover:text-emerald-700">
            {project.name}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {project.industryActivity}
          </p>
        </div>

        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
            project.status === "FINALIZED"
              ? "bg-emerald-100 text-emerald-800"
              : project.status === "IN_REVIEW"
                ? "bg-amber-100 text-amber-800"
                : "bg-slate-100 text-slate-700"
          }`}
        >
          {project.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
        <div>
          <span className="block text-[10px] text-slate-400">Location:</span>
          <span className="font-medium text-slate-700">
            {project.areaClassification}
          </span>
        </div>
        <div className="text-right">
          <span className="block text-[10px] text-slate-400">Tenure:</span>
          <span className="font-medium text-slate-700">
            {project.projectionPeriodYears} Years
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
        <span>Revision v{project.revision}</span>
        <span>Updated: {formattedDate}</span>
      </div>
    </Link>
  );
}
