import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getProjectAction,
  runProjectCalculationAction,
  saveProjectDraftAction,
} from "@/app/actions/project-actions";
import { WizardContainer } from "@/features/project-wizard/components/wizard-container";

export const dynamic = "force-dynamic";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectWizardPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const result = await getProjectAction(id);

  if (!result.success || !result.data) {
    notFound();
  }

  const { wizardInput } = result.data;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white"
            >
              PS
            </Link>
            <div className="flex items-center gap-2 text-xs">
              <Link
                href="/"
                className="font-medium text-slate-500 hover:text-slate-900"
              >
                Projects
              </Link>
              <span className="text-slate-400">/</span>
              <span className="font-semibold text-slate-800">
                {wizardInput.project.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              ← Back to Projects
            </Link>
          </div>
        </div>
      </header>

      {/* Main Wizard Area */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <WizardContainer
          projectId={id}
          initialInput={wizardInput}
          onSaveDraft={saveProjectDraftAction}
          onRunCalculation={runProjectCalculationAction}
        />
      </main>
    </div>
  );
}
