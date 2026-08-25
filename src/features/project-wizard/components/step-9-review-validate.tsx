import React from "react";

import type {
  ProjectCalculationResult,
  ProjectWizardInput,
  TaxAndReturnsInput,
} from "@/lib/application/orchestrator/orchestrator-types";
import { ProjectSetuDecimal } from "@/domain/shared/decimal";
import {
  formatIndianCurrency,
  sumDecimalStrings,
} from "@/lib/application/formatters";
import { IssuesView } from "@/features/financial-results/components/issues-view";

interface Step9ReviewValidateProps {
  input: ProjectWizardInput;
  calculationResult: ProjectCalculationResult | null;
  onTaxAndReturnsChange: (updated: TaxAndReturnsInput) => void;
  onRunCalculation: () => void;
  isCalculating: boolean;
}

export function Step9ReviewValidate({
  input,
  calculationResult,
  onTaxAndReturnsChange,
  onRunCalculation,
  isCalculating,
}: Step9ReviewValidateProps) {
  const totalCost = sumDecimalStrings(
    input.costItems.map((item) => item.amount),
  );
  const totalFinance = sumDecimalStrings(
    input.financingSources.map((s) => s.amount),
  );
  let costDec = new ProjectSetuDecimal("0");
  let finDec = new ProjectSetuDecimal("0");
  try {
    costDec = new ProjectSetuDecimal(totalCost || "0");
    finDec = new ProjectSetuDecimal(totalFinance || "0");
  } catch {
    // ignore invalid input during typing
  }
  const isFinanceBalanced = finDec.minus(costDec).isZero();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900">
          Step 9: Assumption Review & Verification
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Review all configured project assumptions, configure tax and discount
          rates, and execute the authoritative financial calculation engine.
        </p>
      </div>

      {/* Tax & Discount Rate Config */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h4 className="text-xs font-bold tracking-wider text-slate-800 uppercase">
          Tax & DCF Hurdle Assumptions
        </h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              Income Tax Mode
            </label>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-hidden"
              value={input.taxAndReturns.taxMode}
              onChange={(e) =>
                onTaxAndReturnsChange({
                  ...input.taxAndReturns,
                  taxMode: e.target.value as TaxAndReturnsInput["taxMode"],
                })
              }
            >
              <option value="PERCENTAGE_OF_POSITIVE_PBT">
                Percentage of Positive PBT
              </option>
              <option value="NO_TAX">No Tax (0%)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              Corporate Tax Rate (%)
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs focus:outline-hidden"
              value={input.taxAndReturns.taxRate}
              disabled={input.taxAndReturns.taxMode === "NO_TAX"}
              onChange={(e) =>
                onTaxAndReturnsChange({
                  ...input.taxAndReturns,
                  taxRate: e.target.value,
                })
              }
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              DCF Discount Rate / WACC (%)
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs focus:outline-hidden"
              value={input.taxAndReturns.discountRate}
              onChange={(e) =>
                onTaxAndReturnsChange({
                  ...input.taxAndReturns,
                  discountRate: e.target.value,
                })
              }
            />
          </div>
        </div>
      </div>

      {/* Assumptions Summary Cards */}
      <div className="grid grid-cols-2 gap-4 text-xs md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <span className="block font-medium text-slate-500">
            Total Cost Items:
          </span>
          <span className="mt-1 block text-base font-bold text-slate-900">
            {formatIndianCurrency(String(totalCost))} ({input.costItems.length}{" "}
            lines)
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <span className="block font-medium text-slate-500">
            Means of Finance:
          </span>
          <span className="mt-1 block text-base font-bold text-slate-900">
            {formatIndianCurrency(String(totalFinance))}
          </span>
          <span
            className={
              isFinanceBalanced
                ? "font-semibold text-emerald-700"
                : "font-semibold text-rose-700"
            }
          >
            {isFinanceBalanced ? "✓ Balanced" : "⚠ Unbalanced"}
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <span className="block font-medium text-slate-500">
            Revenue Lines:
          </span>
          <span className="mt-1 block text-base font-bold text-slate-900">
            {input.revenueProducts.length} Product(s)
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <span className="block font-medium text-slate-500">
            Selected Schemes:
          </span>
          <span className="mt-1 block text-base font-bold text-slate-900">
            {input.selectedPrograms.length} Scheme(s)
          </span>
        </div>
      </div>

      {/* Live Issue Checklist */}
      {calculationResult && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold tracking-wider text-slate-700 uppercase">
            Calculation Engine Audit & Validation Checks
          </h4>
          <IssuesView issues={calculationResult.issues} />
        </div>
      )}

      {/* Trigger Button */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 sm:flex-row sm:items-center">
        <div>
          <h4 className="text-sm font-bold text-emerald-950">
            Execute Authoritative Projections
          </h4>
          <p className="mt-0.5 text-xs text-emerald-800">
            Run all 12 domain financial and scheme engines to produce
            statements, metrics, and DPR readiness.
          </p>
        </div>

        <button
          type="button"
          onClick={onRunCalculation}
          disabled={isCalculating}
          className="shrink-0 rounded-xl bg-emerald-700 px-6 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-800 disabled:opacity-50"
        >
          {isCalculating
            ? "Calculating Engines..."
            : "⚡ Execute Financial Engines"}
        </button>
      </div>
    </div>
  );
}
