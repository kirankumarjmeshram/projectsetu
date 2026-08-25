import React from "react";

import type { WorkingCapitalInput } from "@/lib/application/orchestrator/orchestrator-types";

interface Step6WorkingCapitalProps {
  value: WorkingCapitalInput;
  onChange: (updated: WorkingCapitalInput) => void;
}

export function Step6WorkingCapital({
  value,
  onChange,
}: Step6WorkingCapitalProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900">
          Step 6: Working Capital Assessment
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Specify inventory holding periods, receivable/debtor cycles, supplier
          credit, and borrower margin for working capital bank finance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Raw Material Stock Holding (Days) *
          </label>
          <input
            type="number"
            min={0}
            max={365}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.rawMaterialDays}
            onChange={(e) =>
              onChange({ ...value, rawMaterialDays: e.target.value })
            }
            placeholder="e.g. 30"
          />
          <p className="text-[11px] text-slate-500">
            Days of raw material consumption in inventory
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Finished Goods Holding (Days) *
          </label>
          <input
            type="number"
            min={0}
            max={365}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.finishedGoodsDays}
            onChange={(e) =>
              onChange({ ...value, finishedGoodsDays: e.target.value })
            }
            placeholder="e.g. 15"
          />
          <p className="text-[11px] text-slate-500">
            Days of production / operating cost stored in finished goods
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Receivables / Debtors Credit (Days) *
          </label>
          <input
            type="number"
            min={0}
            max={365}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.receivableDays}
            onChange={(e) =>
              onChange({ ...value, receivableDays: e.target.value })
            }
            placeholder="e.g. 30"
          />
          <p className="text-[11px] text-slate-500">
            Credit period granted to customers
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Supplier / Creditor Credit (Days) *
          </label>
          <input
            type="number"
            min={0}
            max={365}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.creditorDays}
            onChange={(e) =>
              onChange({ ...value, creditorDays: e.target.value })
            }
            placeholder="e.g. 15"
          />
          <p className="text-[11px] text-slate-500">
            Credit period obtained from raw material suppliers
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Borrower Margin for Working Capital (%) *
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.borrowerMarginPercentage}
            onChange={(e) =>
              onChange({ ...value, borrowerMarginPercentage: e.target.value })
            }
            placeholder="e.g. 25"
          />
          <p className="text-[11px] text-slate-500">
            Standard Nayak Committee / Bank norm is typically 20% - 25%
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Annual Day Basis Convention
          </label>
          <select
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.dayBase || "365"}
            onChange={(e) =>
              onChange({
                ...value,
                dayBase: e.target.value as WorkingCapitalInput["dayBase"],
              })
            }
          >
            <option value="365">365 Days / Year (Standard)</option>
            <option value="360">360 Days / Year (Commercial)</option>
            <option value="300">300 Operating Days / Year (Factory)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
