"use client";

import React, { useState } from "react";

import type { PersistedProject } from "@/lib/persistence/repositories/types";

import { CreateProjectModal } from "./create-project-modal";
import { ProjectCard } from "./project-card";

interface ProjectListViewProps {
  projects: readonly PersistedProject[];
}

export function ProjectListView({ projects }: ProjectListViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<string>("ALL");

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.industryActivity.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMode = modeFilter === "ALL" || p.mode === modeFilter;
    return matchesSearch && matchesMode;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Project Workspace & DPR Portfolio
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Manage project financial models, scheme eligibility assessments, and
            bankable reports.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-emerald-800"
        >
          + New Project
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs sm:flex-row">
        <div className="w-full flex-1">
          <input
            type="text"
            placeholder="Search projects by name, sector, or activity..."
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-hidden"
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
          >
            <option value="ALL">All Modes</option>
            <option value="SUBSIDY">Subsidy Linked</option>
            <option value="BANKABLE">Bankable</option>
            <option value="SELF_FUNDED">Self-Funded</option>
          </select>
        </div>
      </div>

      {/* Project Cards Grid */}
      {filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <div className="text-4xl">📁</div>
          <h3 className="text-base font-bold text-slate-900">
            {projects.length === 0
              ? "No Projects Created Yet"
              : "No matching projects found"}
          </h3>
          <p className="mx-auto max-w-sm text-xs text-slate-500">
            {projects.length === 0
              ? "Create your first project to start entering assumptions and generating financial statements."
              : "Try adjusting your search query or filters."}
          </p>
          {projects.length === 0 && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="rounded-xl bg-emerald-700 px-5 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-emerald-800"
            >
              + Create First Project
            </button>
          )}
        </div>
      )}

      {/* Create Modal */}
      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
