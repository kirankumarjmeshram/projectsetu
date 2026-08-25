import React from "react";

import type { ProfitAndLossSchedule } from "@/domain/profit-and-loss/profit-and-loss";
import { formatIndianCurrency } from "@/lib/application/formatters";

interface ProfitAndLossTableProps {
  profitAndLoss: ProfitAndLossSchedule;
}

export function ProfitAndLossTable({ profitAndLoss }: ProfitAndLossTableProps) {
  const years = profitAndLoss.years;

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
          <tr className="hover:bg-slate-50/40">
            <td className="px-4 py-2.5 font-semibold text-slate-900">
              Revenue from Operations
            </td>
            {years.map((y) => (
              <td
                key={y.year}
                className="px-4 py-2.5 text-right font-semibold text-slate-900 tabular-nums"
              >
                {formatIndianCurrency(y.revenue)}
              </td>
            ))}
          </tr>
          <tr className="hover:bg-slate-50/40">
            <td className="px-4 py-2 pl-6 text-slate-600">
              Less: Operating Expenses
            </td>
            {years.map((y) => (
              <td
                key={y.year}
                className="px-4 py-2 text-right text-slate-600 tabular-nums"
              >
                (
                {formatIndianCurrency(y.operatingExpenses, {
                  includeSymbol: false,
                })}
                )
              </td>
            ))}
          </tr>
          <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
            <td className="px-4 py-2.5">EBITDA (Operating Profit)</td>
            {years.map((y) => (
              <td
                key={y.year}
                className="px-4 py-2.5 text-right text-emerald-800 tabular-nums"
              >
                {formatIndianCurrency(y.ebitda)}
              </td>
            ))}
          </tr>
          <tr className="hover:bg-slate-50/40">
            <td className="px-4 py-2 pl-6 text-slate-600">
              Less: Depreciation
            </td>
            {years.map((y) => (
              <td
                key={y.year}
                className="px-4 py-2 text-right text-slate-600 tabular-nums"
              >
                (
                {formatIndianCurrency(y.depreciation, { includeSymbol: false })}
                )
              </td>
            ))}
          </tr>
          <tr className="font-medium text-slate-900 hover:bg-slate-50/40">
            <td className="px-4 py-2">EBIT (Operating Earnings)</td>
            {years.map((y) => (
              <td key={y.year} className="px-4 py-2 text-right tabular-nums">
                {formatIndianCurrency(y.ebit)}
              </td>
            ))}
          </tr>
          <tr className="hover:bg-slate-50/40">
            <td className="px-4 py-2 pl-6 text-slate-600">
              Less: Interest Expense
            </td>
            {years.map((y) => (
              <td
                key={y.year}
                className="px-4 py-2 text-right text-rose-700 tabular-nums"
              >
                (
                {formatIndianCurrency(y.interestExpense, {
                  includeSymbol: false,
                })}
                )
              </td>
            ))}
          </tr>
          <tr className="border-t border-slate-200 bg-slate-50/70 font-semibold text-slate-900">
            <td className="px-4 py-2.5">Profit Before Tax (PBT)</td>
            {years.map((y) => (
              <td key={y.year} className="px-4 py-2.5 text-right tabular-nums">
                {formatIndianCurrency(y.profitBeforeTax)}
              </td>
            ))}
          </tr>
          <tr className="hover:bg-slate-50/40">
            <td className="px-4 py-2 pl-6 text-slate-600">
              Less: Income Tax Expense
            </td>
            {years.map((y) => (
              <td
                key={y.year}
                className="px-4 py-2 text-right text-slate-600 tabular-nums"
              >
                ({formatIndianCurrency(y.taxExpense, { includeSymbol: false })})
              </td>
            ))}
          </tr>
          <tr className="border-t-2 border-emerald-300 bg-emerald-100/70 font-bold text-emerald-950">
            <td className="px-4 py-3 text-sm">Profit After Tax (PAT)</td>
            {years.map((y) => (
              <td
                key={y.year}
                className="px-4 py-3 text-right text-sm font-extrabold text-emerald-950 tabular-nums"
              >
                {formatIndianCurrency(y.profitAfterTax)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
