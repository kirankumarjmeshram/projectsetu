"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";

import type {
  ProjectCalculationResult,
  ProjectWizardInput,
} from "@/lib/application/orchestrator/orchestrator-types";
import { orchestrateProjectCalculation } from "@/lib/application/orchestrator/calculation-orchestrator";
import { sumDecimalStrings } from "@/lib/application/formatters";
import { DocumentListView } from "@/features/documents/components/document-list-view";

import { Step1ProjectDetails } from "./step-1-project-details";
import { Step2ApplicantPromoter } from "./step-2-applicant-promoter";
import { Step3ProjectCost } from "./step-3-project-cost";
import { Step4Financing } from "./step-4-financing";
import { Step5OperationsRevenue } from "./step-5-operations-revenue";
import { Step6WorkingCapital } from "./step-6-working-capital";
import { Step7LoanTerms } from "./step-7-loan-terms";
import { Step8Schemes } from "./step-8-schemes";
import { Step9ReviewValidate } from "./step-9-review-validate";
import { Step10Results } from "./step-10-results";
import { WizardStepNav } from "./wizard-step-nav";

interface WizardContainerProps {
  projectId?: string;
  initialInput: ProjectWizardInput;
  initialCalculationResult?: ProjectCalculationResult | null;
  onSaveDraft?: (
    input: ProjectWizardInput,
  ) => Promise<{ success: boolean; error?: string }>;
}

export function WizardContainer({
  projectId = "",
  initialInput,
  initialCalculationResult = null,
  onSaveDraft,
}: WizardContainerProps) {
  const [input, setInput] = useState<ProjectWizardInput>(initialInput);
  const [activeTab, setActiveTab] = useState<"WIZARD" | "DOCUMENTS">("WIZARD");
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [maxReachedStep, setMaxReachedStep] = useState<number>(1);
  const [calculationResult, setCalculationResult] =
    useState<ProjectCalculationResult | null>(initialCalculationResult);
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<
    "SAVED" | "SAVING" | "ERROR" | "IDLE"
  >("IDLE");

  const totalCost = sumDecimalStrings(
    input.costItems.map((item) => item.amount),
  );

  const handleStepChange = (newStep: number) => {
    setCurrentStep(newStep);
    if (newStep > maxReachedStep) {
      setMaxReachedStep(newStep);
    }
    // Auto-save draft asynchronously on step transition
    if (onSaveDraft) {
      setSaveStatus("SAVING");
      startTransition(async () => {
        try {
          const res = await onSaveDraft(input);
          setSaveStatus(res.success ? "SAVED" : "ERROR");
        } catch {
          setSaveStatus("ERROR");
        }
      });
    }
  };

  const handleNext = () => {
    if (currentStep < 10) {
      handleStepChange(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      handleStepChange(currentStep - 1);
    }
  };

  const handleExecuteCalculation = () => {
    startTransition(() => {
      const res = orchestrateProjectCalculation(input);
      setCalculationResult(res);
      setCurrentStep(10);
      setMaxReachedStep(10);
      setActiveTab("WIZARD");
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-20">
      {/* Top Header Bar */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Link href="/" className="font-medium hover:text-emerald-700">
              Projects
            </Link>
            <span>/</span>
            <span className="font-semibold text-slate-700">
              {input.project.name}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-xl font-extrabold text-slate-900">
              {input.project.name}
            </h1>
            <div className="flex rounded-lg bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => setActiveTab("WIZARD")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                  activeTab === "WIZARD"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                📋 Project Wizard
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("DOCUMENTS")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                  activeTab === "DOCUMENTS"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                📁 Documents & Quotations
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saveStatus === "SAVING" && (
            <span className="text-xs text-slate-400">Saving draft...</span>
          )}
          {saveStatus === "SAVED" && (
            <span className="text-xs font-semibold text-emerald-700">
              ✓ Draft Saved
            </span>
          )}
          {saveStatus === "ERROR" && (
            <span className="text-xs font-semibold text-rose-600">
              ⚠ Save Failed
            </span>
          )}

          {onSaveDraft && (
            <button
              type="button"
              onClick={() => {
                setSaveStatus("SAVING");
                startTransition(async () => {
                  try {
                    const res = await onSaveDraft(input);
                    setSaveStatus(res.success ? "SAVED" : "ERROR");
                  } catch {
                    setSaveStatus("ERROR");
                  }
                });
              }}
              disabled={isPending}
              className="rounded-lg bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200"
            >
              Save Draft
            </button>
          )}

          <button
            type="button"
            onClick={handleExecuteCalculation}
            disabled={isPending}
            className="rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-emerald-800"
          >
            {isPending ? "Calculating..." : "⚡ Run Calculation"}
          </button>
        </div>
      </div>

      {/* When activeTab is DOCUMENTS, show DocumentListView */}
      {activeTab === "DOCUMENTS" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs md:p-8">
          <DocumentListView
            projectId={projectId || input.project.name}
            existingCostItems={input.costItems}
            onUpdateCostItems={(updatedItems) =>
              setInput({ ...input, costItems: updatedItems })
            }
          />
        </div>
      ) : (
        <>
          {/* Step Navigation Bar */}
          <WizardStepNav
            currentStep={currentStep}
            onSelectStep={handleStepChange}
            maxReachedStep={maxReachedStep}
          />

          {/* Main Step Container */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs md:p-8">
            {currentStep === 1 && (
              <Step1ProjectDetails
                value={input.project}
                onChange={(project) => setInput({ ...input, project })}
              />
            )}

            {currentStep === 2 && (
              <Step2ApplicantPromoter
                value={input.applicant}
                onChange={(applicant) => setInput({ ...input, applicant })}
              />
            )}

            {currentStep === 3 && (
              <Step3ProjectCost
                projectId={projectId}
                items={input.costItems}
                onChange={(costItems) => setInput({ ...input, costItems })}
              />
            )}

            {currentStep === 4 && (
              <Step4Financing
                sources={input.financingSources}
                totalProjectCost={totalCost}
                onChange={(financingSources) =>
                  setInput({ ...input, financingSources })
                }
              />
            )}

            {currentStep === 5 && (
              <Step5OperationsRevenue
                revenueProducts={input.revenueProducts}
                operatingExpenses={input.operatingExpenses}
                onRevenueChange={(revenueProducts) =>
                  setInput({ ...input, revenueProducts })
                }
                onExpenseChange={(operatingExpenses) =>
                  setInput({ ...input, operatingExpenses })
                }
              />
            )}

            {currentStep === 6 && (
              <Step6WorkingCapital
                value={input.workingCapital}
                onChange={(workingCapital) =>
                  setInput({ ...input, workingCapital })
                }
              />
            )}

            {currentStep === 7 && (
              <Step7LoanTerms
                value={input.loan}
                onChange={(loan) => setInput({ ...input, loan })}
              />
            )}

            {currentStep === 8 && (
              <Step8Schemes
                selectedPrograms={input.selectedPrograms}
                schemeFacts={input.schemeFacts ?? {}}
                onProgramChange={(selectedPrograms) =>
                  setInput({ ...input, selectedPrograms })
                }
                onFactsChange={(schemeFacts) =>
                  setInput({ ...input, schemeFacts })
                }
              />
            )}

            {currentStep === 9 && (
              <Step9ReviewValidate
                input={input}
                calculationResult={calculationResult}
                onTaxAndReturnsChange={(taxAndReturns) =>
                  setInput({ ...input, taxAndReturns })
                }
                onRunCalculation={handleExecuteCalculation}
                isCalculating={isPending}
              />
            )}

            {currentStep === 10 && (
              <Step10Results
                result={calculationResult}
                onRecalculate={handleExecuteCalculation}
                isCalculating={isPending}
              />
            )}
          </div>

          {/* Bottom Step Navigation Buttons */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 1}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 disabled:opacity-40"
            >
              ← Previous Step
            </button>

            <div className="text-xs text-slate-400">
              Step {currentStep} of 10
            </div>

            <button
              type="button"
              onClick={handleNext}
              disabled={currentStep === 10}
              className="rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-slate-800 disabled:opacity-40"
            >
              Next Step →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
