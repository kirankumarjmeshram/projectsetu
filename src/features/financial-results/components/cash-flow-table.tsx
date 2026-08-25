import React from "react";

import type { CashFlowSchedule } from "@/domain/cash-flow/cash-flow";
import {
  formatIndianCurrency,
  isDecimalNegative,
} from "@/lib/application/formatters";

interface CashFlowTableProps {
  cashFlow: CashFlowSchedule;
}

export function CashFlowTable({ cashFlow }: CashFlowTableProps) {
  const years = cashFlow.years;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
            <th className="px-4 py-3">Cash Flow Activities (₹)</th>
            {years.map((y) => (
              <th key={y.year} className="px-4 py-3 text-right">
                Year {y.year}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-800">
          {/* Operating Cash Flow */}
          <tr className="bg-slate-50/50 font-semibold text-slate-900">
            <td
              colSpan={years.length + 1}
              className="px-4 py-2 text-[10px] tracking-wider text-slate-500 uppercase"
            >
              A. Cash Flow from Operations
            </td>
          </tr>
          <tr className="hover:bg-slate-50/40">
            <td className="px-4 py-2 pl-6 text-slate-700">
              Net Profit After Tax
            </td>
            {years.map((y) => (
              <td key={y.year} className="px-4 py-2 text-right tabular-nums">
                {formatIndianCurrency(y.profitAfterTax)}
              </td>
            ))}
          </tr>
          <tr className="hover:bg-slate-50/40">
            <td className="px-4 py-2 pl-6 text-slate-700">
              Add: Depreciation (Non-Cash)
            </td>
            {years.map((y) => (
              <td key={y.year} className="px-4 py-2 text-right tabular-nums">
                {formatIndianCurrency(y.depreciationAddBack)}
              </td>
            ))}
          </tr>
          <tr className="hover:bg-slate-50/40">
            <td className="px-4 py-2 pl-6 text-slate-700">
              Working Capital Requirement Change
            </td>
            {years.map((y) => (
              <td
                key={y.year}
                className="px-4 py-2 text-right text-rose-700 tabular-nums"
              >
                {formatIndianCurrency(y.changeInNetWorkingCapital)}
              </td>
            ))}
          </tr>
          <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
            <td className="px-4 py-2.5">Net Cash from Operating Activities</td>
            {years.map((y) => (
              <td
                key={y.year}
                className="px-4 py-2.5 text-right text-emerald-800 tabular-nums"
              >
                {formatIndianCurrency(y.operatingCashFlow)}
              </td>
            ))}
          </tr>

          {/* Investing Cash Flow */}
          <tr className="bg-slate-50/50 font-semibold text-slate-900">
            <td
              colSpan={years.length + 1}
              className="px-4 py-2 text-[10px] tracking-wider text-slate-500 uppercase"
            >
              B. Cash Flow from Investing Activities
            </td>
          </tr>
          <tr className="hover:bg-slate-50/40">
            <td className="px-4 py-2 pl-6 text-slate-700">
              Capital Expenditure / Fixed Assets
            </td>
            {years.map((y) => (
              <td
                key={y.year}
                className="px-4 py-2 text-right text-rose-700 tabular-nums"
              >
                (
                {formatIndianCurrency(y.capitalExpenditure, {
                  includeSymbol: false,
                })}
                )
              </td>
            ))}
          </tr>
          <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
            <td className="px-4 py-2.5">Net Cash from Investing Activities</td>
            {years.map((y) => (
              <td
                key={y.year}
                className="px-4 py-2.5 text-right text-rose-800 tabular-nums"
              >
                {formatIndianCurrency(y.investingCashFlow)}
              </td>
            ))}
          </tr>

          {/* Financing Cash Flow */}
          <tr className="bg-slate-50/50 font-semibold text-slate-900">
            <td
              colSpan={years.length + 1}
              className="px-4 py-2 text-[10px] tracking-wider text-slate-500 uppercase"
            >
              C. Cash Flow from Financing Activities
            </td>
          </tr>
          <tr className="hover:bg-slate-50/40">
            <td className="px-4 py-2 pl-6 text-slate-700">
              Promoter Equity Inflow
            </td>
            {years.map((y) => (
              <td key={y.year} className="px-4 py-2 text-right tabular-nums">
                {formatIndianCurrency(y.promoterContribution)}
              </td>
            ))}
          </tr>
          <tr className="hover:bg-slate-50/40">
            <td className="px-4 py-2 pl-6 text-slate-700">
              Loan Disbursement Received
            </td>
            {years.map((y) => (
              <td key={y.year} className="px-4 py-2 text-right tabular-nums">
                {formatIndianCurrency(y.loanDisbursement)}
              </td>
            ))}
          </tr>
          <tr className="hover:bg-slate-50/40">
            <td className="px-4 py-2 pl-6 text-slate-700">
              Less: Loan Principal Repayment
            </td>
            {years.map((y) => (
              <td
                key={y.year}
                className="px-4 py-2 text-right text-rose-700 tabular-nums"
              >
                (
                {formatIndianCurrency(y.principalRepayment, {
                  includeSymbol: false,
                })}
                )
              </td>
            ))}
          </tr>
          <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
            <td className="px-4 py-2.5">Net Cash from Financing Activities</td>
            {years.map((y) => (
              <td key={y.year} className="px-4 py-2.5 text-right tabular-nums">
                {formatIndianCurrency(y.financingCashFlow)}
              </td>
            ))}
          </tr>

          {/* Net Cash and Balances */}
          <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-900">
            <td className="px-4 py-2.5">Net Change in Cash (A + B + C)</td>
            {years.map((y) => (
              <td key={y.year} className="px-4 py-2.5 text-right tabular-nums">
                {formatIndianCurrency(y.netCashMovement)}
              </td>
            ))}
          </tr>
          <tr className="hover:bg-slate-50/40">
            <td className="px-4 py-2 pl-6 text-slate-600">
              Opening Cash & Bank Balance
            </td>
            {years.map((y) => (
              <td
                key={y.year}
                className="px-4 py-2 text-right text-slate-600 tabular-nums"
              >
                {formatIndianCurrency(y.openingCash)}
              </td>
            ))}
          </tr>
          <tr className="border-t-2 border-indigo-300 bg-indigo-100/70 font-extrabold text-indigo-950">
            <td className="px-4 py-3 text-sm">Closing Cash & Bank Balance</td>
            {years.map((y) => {
              const isNegative = isDecimalNegative(y.closingCash);
              return (
                <td
                  key={y.year}
                  className={`px-4 py-3 text-right text-sm font-extrabold tabular-nums ${
                    isNegative
                      ? "bg-rose-100/80 text-rose-700"
                      : "text-indigo-950"
                  }`}
                >
                  {formatIndianCurrency(y.closingCash)}
                  {isNegative && (
                    <span className="block text-[10px] font-semibold text-rose-800">
                      Deficit (Review Margin)
                    </span>
                  )}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
