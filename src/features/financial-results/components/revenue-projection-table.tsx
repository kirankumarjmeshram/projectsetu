import React from "react";

import type { RevenueAndOperatingExpenseProjection } from "@/domain/projection/projection";
import { formatIndianCurrency } from "@/lib/application/formatters";

interface RevenueProjectionTableProps {
  projection: RevenueAndOperatingExpenseProjection;
}

export function RevenueProjectionTable({
  projection,
}: RevenueProjectionTableProps) {
  const years = projection.years;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
            <th className="px-4 py-3">Line Item (₹)</th>
            {years.map((y) => (
              <th key={y.year} className="px-4 py-3 text-right">
                Year {y.year}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-800">
          {/* Revenue by product */}
          <tr className="bg-slate-50/50 font-semibold text-slate-900">
            <td
              colSpan={years.length + 1}
              className="px-4 py-2 text-[10px] tracking-wider text-slate-500 uppercase"
            >
              A. Revenue Projections
            </td>
          </tr>
          {years[0]?.revenueLines.map((line, idx) => (
            <tr key={line.input.id} className="hover:bg-slate-50/40">
              <td className="px-4 py-2.5 font-medium text-slate-700">
                {line.input.productOrServiceName} ({line.input.unit})
              </td>
              {years.map((y) => {
                const prod = y.revenueLines[idx];
                return (
                  <td
                    key={y.year}
                    className="px-4 py-2.5 text-right tabular-nums"
                  >
                    {formatIndianCurrency(prod?.revenue)}
                    <span className="block text-[10px] text-slate-600">
                      @{prod?.capacityUtilisation}% ({prod?.effectiveQuantity}{" "}
                      {line.input.unit})
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="border-t border-emerald-100 bg-emerald-50/40 font-bold text-slate-900">
            <td className="px-4 py-2.5 text-emerald-900">
              Total Gross Revenue
            </td>
            {years.map((y) => (
              <td
                key={y.year}
                className="px-4 py-2.5 text-right text-emerald-900 tabular-nums"
              >
                {formatIndianCurrency(y.totalRevenue)}
              </td>
            ))}
          </tr>

          {/* Operating Expenses */}
          <tr className="bg-slate-50/50 font-semibold text-slate-900">
            <td
              colSpan={years.length + 1}
              className="px-4 py-2 text-[10px] tracking-wider text-slate-500 uppercase"
            >
              B. Operating Expenses
            </td>
          </tr>
          {years[0]?.lines.map((exp, idx) => (
            <tr key={exp.input.id} className="hover:bg-slate-50/40">
              <td className="px-4 py-2 text-slate-700">{exp.input.name}</td>
              {years.map((y) => {
                const e = y.lines[idx];
                return (
                  <td
                    key={y.year}
                    className="px-4 py-2 text-right tabular-nums"
                  >
                    {formatIndianCurrency(e?.amount)}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="border-t border-rose-100 bg-rose-50/30 font-bold text-slate-900">
            <td className="px-4 py-2.5 text-rose-900">
              Total Operating Expenses
            </td>
            {years.map((y) => (
              <td
                key={y.year}
                className="px-4 py-2.5 text-right text-rose-900 tabular-nums"
              >
                {formatIndianCurrency(y.totalOperatingExpenses)}
              </td>
            ))}
          </tr>

          {/* Operating Profit (EBITDA) */}
          <tr className="border-t-2 border-indigo-200 bg-indigo-50 font-bold text-indigo-950">
            <td className="px-4 py-3">Operating Surplus / EBITDA</td>
            {years.map((y) => (
              <td
                key={y.year}
                className="px-4 py-3 text-right text-sm text-indigo-950 tabular-nums"
              >
                {formatIndianCurrency(
                  y.operatingSurplusBeforeDepreciationInterestAndTax,
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
