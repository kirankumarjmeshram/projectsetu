import React from "react";

import { generateId } from "@/lib/persistence/id";
import type { FinanceSourceInput } from "@/lib/application/orchestrator/orchestrator-types";
import { ProjectSetuDecimal } from "@/domain/shared/decimal";
import {
  formatIndianCurrency,
  sumDecimalStrings,
} from "@/lib/application/formatters";

interface Step4FinancingProps {
  sources: readonly FinanceSourceInput[];
  totalProjectCost: string;
  onChange: (sources: readonly FinanceSourceInput[]) => void;
}

const FINANCE_TYPES = [
  { label: "Promoter / Equity Contribution", value: "PROMOTER_CONTRIBUTION" },
  { label: "Bank Term Loan", value: "TERM_LOAN" },
  { label: "Working Capital Borrowing / CC", value: "WORKING_CAPITAL_LOAN" },
  { label: "Unsecured Loan / Friends & Family", value: "UNSECURED_LOAN" },
  { label: "Government Grant / Capital Subsidy", value: "CAPITAL_SUBSIDY" },
  {
    label: "Other Contribution / Internal Accruals",
    value: "OTHER_CONTRIBUTION",
  },
];

export function Step4Financing({
  sources,
  totalProjectCost,
  onChange,
}: Step4FinancingProps) {
  const totalFinance = sumDecimalStrings(sources.map((s) => s.amount));
  let costDec = new ProjectSetuDecimal("0");
  let finDec = new ProjectSetuDecimal("0");
  try {
    costDec = new ProjectSetuDecimal(totalProjectCost || "0");
    finDec = new ProjectSetuDecimal(totalFinance || "0");
  } catch {
    // ignore malformed string during typing
  }
  const diffDec = finDec.minus(costDec);
  const isBalanced = diffDec.isZero();

  const handleAddSource = () => {
    const newSource: FinanceSourceInput = {
      id: generateId(),
      type: "PROMOTER_CONTRIBUTION",
      name: "Own Equity Contribution",
      amount: "100000.00",
    };
    onChange([...sources, newSource]);
  };

  const handleUpdateSource = (
    id: string,
    updated: Partial<FinanceSourceInput>,
  ) => {
    onChange(sources.map((s) => (s.id === id ? { ...s, ...updated } : s)));
  };

  const handleRemoveSource = (id: string) => {
    onChange(sources.filter((s) => s.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Step 4: Means of Finance
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Specify the capital structure: promoter equity, bank term loan, and
            other financing sources.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAddSource}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-800"
        >
          + Add Financing Source
        </button>
      </div>

      {/* Reconciliation Banner */}
      <div
        className={`flex flex-col justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center ${
          isBalanced
            ? "border-emerald-200 bg-emerald-50 text-emerald-950"
            : diffDec.greaterThan(0)
              ? "border-amber-200 bg-amber-50 text-amber-950"
              : "border-rose-200 bg-rose-50 text-rose-950"
        }`}
      >
        <div className="space-y-0.5 text-xs">
          <div className="text-sm font-bold">
            {isBalanced
              ? "✓ Means of Finance is 100% Balanced"
              : diffDec.greaterThan(0)
                ? `Surplus Financing: ${formatIndianCurrency(diffDec.toFixed())}`
                : `Financing Deficit: ${formatIndianCurrency(diffDec.abs().toFixed())}`}
          </div>
          <div className="opacity-80">
            Total Project Cost: {formatIndianCurrency(totalProjectCost)} | Total
            Means of Finance: {formatIndianCurrency(totalFinance)}
          </div>
        </div>
      </div>

      {/* Financing Sources Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
              <th className="px-3 py-3">Financing Source Name</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3 text-right">Amount (₹)</th>
              <th className="w-16 px-3 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {sources.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/50">
                <td className="p-2">
                  <input
                    type="text"
                    className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500"
                    value={s.name}
                    onChange={(e) =>
                      handleUpdateSource(s.id, { name: e.target.value })
                    }
                  />
                </td>
                <td className="p-2">
                  <select
                    className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500"
                    value={s.type}
                    onChange={(e) =>
                      handleUpdateSource(s.id, {
                        type: e.target.value as FinanceSourceInput["type"],
                      })
                    }
                  >
                    {FINANCE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2 text-right">
                  <input
                    type="text"
                    className="inline-block w-36 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-right font-mono text-xs focus:ring-1 focus:ring-emerald-500"
                    value={s.amount}
                    onChange={(e) =>
                      handleUpdateSource(s.id, { amount: e.target.value })
                    }
                  />
                </td>
                <td className="p-2 text-center">
                  <button
                    type="button"
                    onClick={() => handleRemoveSource(s.id)}
                    className="px-2 py-1 text-sm font-bold text-slate-400 transition-colors hover:text-rose-600"
                    title="Delete source"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-300 bg-slate-100/80 font-bold text-slate-900">
              <td colSpan={2} className="px-4 py-3 text-sm">
                Total Means of Finance
              </td>
              <td className="px-3 py-3 text-right text-sm font-extrabold text-slate-950 tabular-nums">
                {formatIndianCurrency(String(totalFinance))}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
