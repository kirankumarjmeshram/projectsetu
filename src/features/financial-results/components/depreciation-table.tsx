import React from "react";

import type { DepreciationSchedule } from "@/domain/depreciation/depreciation";
import { formatIndianCurrency } from "@/lib/application/formatters";

interface DepreciationTableProps {
  depreciation: DepreciationSchedule;
}

export function DepreciationTable({ depreciation }: DepreciationTableProps) {
  const years = depreciation.yearlySummaries;
  const assetSchedules = depreciation.assetSchedules;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
            <th className="px-4 py-3">Asset Description</th>
            <th className="px-4 py-3 text-right">Original Cost</th>
            {years.map((y) => (
              <th key={y.year} className="px-4 py-3 text-right">
                Year {y.year}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-800">
          {assetSchedules.map((item) => (
            <tr key={item.asset.id} className="hover:bg-slate-50/40">
              <td className="px-4 py-2.5">
                <div className="font-semibold text-slate-900">
                  {item.asset.name}
                </div>
                <div className="text-[10px] text-slate-500">
                  {item.asset.category.replaceAll("_", " ")} (
                  {item.asset.method.replaceAll("_", " ")})
                </div>
              </td>
              <td className="px-4 py-2.5 text-right font-medium text-slate-700 tabular-nums">
                {formatIndianCurrency(item.asset.originalCost.value)}
              </td>
              {item.years.map((yr) => (
                <td
                  key={yr.year}
                  className="px-4 py-2.5 text-right tabular-nums"
                >
                  {formatIndianCurrency(yr.depreciation)}
                  <span className="block text-[10px] text-slate-400">
                    Net: {formatIndianCurrency(yr.closingCarryingValue)}
                  </span>
                </td>
              ))}
            </tr>
          ))}

          {/* Aggregate Row */}
          <tr className="border-t-2 border-slate-300 bg-slate-100/90 font-bold text-slate-900">
            <td className="px-4 py-3 text-sm">Total Annual Depreciation</td>
            <td className="px-4 py-3 text-right">-</td>
            {years.map((y) => (
              <td
                key={y.year}
                className="px-4 py-3 text-right text-slate-950 tabular-nums"
              >
                <div>{formatIndianCurrency(y.depreciation)}</div>
                <div className="text-[10px] font-normal text-slate-500">
                  Acc: {formatIndianCurrency(y.accumulatedDepreciation)}
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
