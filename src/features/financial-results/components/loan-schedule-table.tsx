import React from "react";

import type { LoanRepaymentSchedule } from "@/domain/loan/loan";
import { formatIndianCurrency } from "@/lib/application/formatters";

interface LoanScheduleTableProps {
  loanSchedule: LoanRepaymentSchedule;
}

export function LoanScheduleTable({ loanSchedule }: LoanScheduleTableProps) {
  const summaries = loanSchedule.annualSummaries;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
        <div>
          <span className="text-slate-500">Sanctioned Amount:</span>{" "}
          <strong className="text-slate-800">
            {formatIndianCurrency(loanSchedule.summary.originalPrincipal)}
          </strong>
        </div>
        <div>
          <span className="text-slate-500">Repayment Method:</span>{" "}
          <strong className="text-slate-800">
            {loanSchedule.repaymentMethod}
          </strong>
        </div>
        <div>
          <span className="text-slate-500">Frequency:</span>{" "}
          <strong className="text-slate-800">
            {loanSchedule.repaymentFrequency}
          </strong>
        </div>
        <div>
          <span className="text-slate-500">Total Interest Payable:</span>{" "}
          <strong className="text-rose-700">
            {formatIndianCurrency(loanSchedule.summary.totalInterestPaid)}
          </strong>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
              <th className="px-4 py-3">Year</th>
              <th className="px-4 py-3 text-right">Opening Balance</th>
              <th className="px-4 py-3 text-right">Principal Repaid</th>
              <th className="px-4 py-3 text-right">Interest Charged</th>
              <th className="px-4 py-3 text-right font-bold text-slate-900">
                Total Debt Service
              </th>
              <th className="px-4 py-3 text-right">Closing Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {summaries.map((yr) => (
              <tr key={yr.projectionYear} className="hover:bg-slate-50/40">
                <td className="px-4 py-2.5 font-semibold text-slate-900">
                  Year {yr.projectionYear}
                </td>
                <td className="px-4 py-2.5 text-right text-slate-600 tabular-nums">
                  {formatIndianCurrency(yr.openingPrincipal)}
                </td>
                <td className="px-4 py-2.5 text-right font-medium text-indigo-700 tabular-nums">
                  {formatIndianCurrency(yr.principalRepaid)}
                </td>
                <td className="px-4 py-2.5 text-right font-medium text-rose-700 tabular-nums">
                  {formatIndianCurrency(yr.interestCharged)}
                </td>
                <td className="bg-slate-50/60 px-4 py-2.5 text-right font-bold text-slate-950 tabular-nums">
                  {formatIndianCurrency(yr.totalDebtService)}
                </td>
                <td className="px-4 py-2.5 text-right font-medium text-slate-900 tabular-nums">
                  {formatIndianCurrency(yr.closingPrincipal)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-900">
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right">-</td>
              <td className="px-4 py-3 text-right text-indigo-900">
                {formatIndianCurrency(
                  loanSchedule.summary.totalPrincipalRepaid,
                )}
              </td>
              <td className="px-4 py-3 text-right text-rose-900">
                {formatIndianCurrency(loanSchedule.summary.totalInterestPaid)}
              </td>
              <td className="bg-slate-200/50 px-4 py-3 text-right text-slate-950">
                {formatIndianCurrency(loanSchedule.summary.totalRepayments)}
              </td>
              <td className="px-4 py-3 text-right">-</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
