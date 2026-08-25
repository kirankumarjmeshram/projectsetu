import React from "react";

export interface WizardStepMeta {
  readonly number: number;
  readonly title: string;
  readonly shortTitle: string;
}

export const WIZARD_STEPS: readonly WizardStepMeta[] = [
  { number: 1, title: "Project Identity", shortTitle: "Identity" },
  { number: 2, title: "Promoter Profile", shortTitle: "Promoter" },
  { number: 3, title: "Project Cost", shortTitle: "Cost" },
  { number: 4, title: "Means of Finance", shortTitle: "Financing" },
  { number: 5, title: "Operations & Revenue", shortTitle: "Operations" },
  { number: 6, title: "Working Capital", shortTitle: "Working Cap" },
  { number: 7, title: "Loan Assumptions", shortTitle: "Loan" },
  { number: 8, title: "Government Schemes", shortTitle: "Schemes" },
  { number: 9, title: "Review & Audit", shortTitle: "Review" },
  { number: 10, title: "Financial Statements", shortTitle: "Statements" },
];

interface WizardStepNavProps {
  currentStep: number;
  onSelectStep: (stepNumber: number) => void;
  maxReachedStep: number;
}

export function WizardStepNav({
  currentStep,
  onSelectStep,
  maxReachedStep,
}: WizardStepNavProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xs">
      <div className="flex min-w-[760px] items-center justify-between gap-1">
        {WIZARD_STEPS.map((step) => {
          const isActive = step.number === currentStep;
          const isCompleted = step.number < currentStep;
          const isAccessible = step.number <= maxReachedStep + 1;

          return (
            <button
              key={step.number}
              type="button"
              disabled={!isAccessible}
              onClick={() => onSelectStep(step.number)}
              className={`flex flex-1 flex-col items-center rounded-lg px-1.5 py-2 text-center transition-all ${
                isActive
                  ? "bg-emerald-700 font-bold text-white shadow-xs"
                  : isCompleted
                    ? "text-emerald-800 hover:bg-emerald-50/70"
                    : isAccessible
                      ? "text-slate-700 hover:bg-slate-50"
                      : "cursor-not-allowed text-slate-300"
              }`}
            >
              <div
                className={`mb-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  isActive
                    ? "bg-white text-emerald-800"
                    : isCompleted
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {isCompleted ? "✓" : step.number}
              </div>
              <span className="w-full truncate text-[11px] leading-tight">
                {step.shortTitle}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
