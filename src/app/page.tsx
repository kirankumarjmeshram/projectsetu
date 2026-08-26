import React from "react";
import Link from "next/link";

import { getProjectsAction } from "@/app/actions/project-actions";
import { UserMenu } from "@/features/auth/components/user-menu";
import { ProjectListView } from "@/features/projects/components/project-list-view";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const result = await getProjectsAction();
  const projects = result.projects || [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top App Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-lg font-extrabold text-white shadow-xs">
              PS
            </div>
            <div>
              <span className="block text-base font-extrabold tracking-tight text-slate-900">
                ProjectSetu
              </span>
              <span className="block text-[10px] font-bold text-emerald-800">
                Detailed Project Report & MSME Scheme Engine
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"
            >
              Dashboard
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <ProjectListView projects={projects} />
      </main>
    </div>
  );
}
