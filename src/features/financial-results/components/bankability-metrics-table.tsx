import React from "react";

import type { BankabilityMetricsSchedule } from "@/domain/metrics/metrics";
import { formatPercentage, formatRatio } from "@/lib/application/formatters";

interface BankabilityMetricsTableProps {
  metrics: BankabilityMetricsSchedule;
}

export function BankabilityMetricsTable({
  metrics,
}: BankabilityMetricsTableProps) {
  const years = metrics.years;
  const avgDscrMetric = metrics.averageDscr.averageDscr;
  const avgDscrVal =
    avgDscrMetric.status === "DEFINED" ? avgDscrMetric.value : undefined;

  return (
    <div className="space-y-4">
      {/* Benchmark Summary Header */}
      <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs md:grid-cols-4">
        <div>
          <span className="block text-slate-500">Average DSCR:</span>
          <strong className="text-sm font-bold text-indigo-700">
            {formatRatio(avgDscrVal, "x", 2, "N/A")}
          </strong>
          <span className="block text-[10px] text-slate-400">
            Bank benchmark &gt; 1.50x
          </span>
        </div>

        <div>
          <span className="block text-slate-500">Initial Debt-Equity:</span>
          <strong className="text-sm font-bold text-slate-800">
            {years[0]?.debtEquityRatio.status === "DEFINED"
              ? formatRatio(years[0].debtEquityRatio.value, "x", 2)
              : "N/A"}
          </strong>
          <span className="block text-[10px] text-slate-400">
            Bank benchmark &lt; 3.00x
          </span>
        </div>

        <div>
          <span className="block text-slate-500">Year 1 Break-Even:</span>
          <strong className="text-sm font-bold text-slate-800">
            {years[0]?.breakEvenPercentage.status === "DEFINED"
              ? formatPercentage(years[0].breakEvenPercentage.value)
              : "N/A"}
          </strong>
          <span className="block text-[10px] text-slate-400">
            Lower is safer
          </span>
        </div>

        <div>
          <span className="block text-slate-500">Year 1 ROCE:</span>
          <strong className="text-sm font-bold text-emerald-700">
            {years[0]?.roce.status === "DEFINED"
              ? formatPercentage(years[0].roce.value)
              : "N/A"}
          </strong>
          <span className="block text-[10px] text-slate-400">
            Return on Capital Employed
          </span>
        </div>
      </div>

      {/* Detailed Metrics Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
              <th className="px-4 py-3">Financial & Bankability Metric</th>
              {years.map((y) => (
                <th key={y.year} className="px-4 py-3 text-right">
                  Year {y.year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {/* DSCR */}
            <tr className="bg-indigo-50/20 font-semibold text-slate-900 hover:bg-slate-50/40">
              <td className="px-4 py-2.5 text-indigo-950">
                Debt Service Coverage Ratio (DSCR)
              </td>
              {years.map((y) => (
                <td
                  key={y.year}
                  className="px-4 py-2.5 text-right font-bold text-indigo-900 tabular-nums"
                >
                  {y.dscr.status === "DEFINED"
                    ? formatRatio(y.dscr.value, "x", 2)
                    : y.dscr.status.replaceAll("_", " ")}
                </td>
              ))}
            </tr>

            {/* Interest Coverage Ratio */}
            <tr className="hover:bg-slate-50/40">
              <td className="px-4 py-2.5 text-slate-700">
                Interest Coverage Ratio (ICR)
              </td>
              {years.map((y) => (
                <td
                  key={y.year}
                  className="px-4 py-2.5 text-right tabular-nums"
                >
                  {y.interestCoverageRatio.status === "DEFINED"
                    ? formatRatio(y.interestCoverageRatio.value, "x", 2)
                    : y.interestCoverageRatio.status.replaceAll("_", " ")}
                </td>
              ))}
            </tr>

            {/* Debt-Equity Ratio */}
            <tr className="hover:bg-slate-50/40">
              <td className="px-4 py-2.5 text-slate-700">
                Debt-Equity Ratio (DER)
              </td>
              {years.map((y) => (
                <td
                  key={y.year}
                  className="px-4 py-2.5 text-right tabular-nums"
                >
                  {y.debtEquityRatio.status === "DEFINED"
                    ? formatRatio(y.debtEquityRatio.value, "x", 2)
                    : y.debtEquityRatio.status.replaceAll("_", " ")}
                </td>
              ))}
            </tr>

            {/* Current Ratio */}
            <tr className="hover:bg-slate-50/40">
              <td className="px-4 py-2.5 text-slate-700">
                Current Ratio (Liquidity)
              </td>
              {years.map((y) => (
                <td
                  key={y.year}
                  className="px-4 py-2.5 text-right tabular-nums"
                >
                  {y.currentRatio.status === "DEFINED"
                    ? formatRatio(y.currentRatio.value, "x", 2)
                    : y.currentRatio.status.replaceAll("_", " ")}
                </td>
              ))}
            </tr>

            {/* Break-Even Percentage */}
            <tr className="hover:bg-slate-50/40">
              <td className="px-4 py-2.5 text-slate-700">
                Break-Even Point (% of Capacity)
              </td>
              {years.map((y) => (
                <td
                  key={y.year}
                  className="px-4 py-2.5 text-right tabular-nums"
                >
                  {y.breakEvenPercentage.status === "DEFINED"
                    ? formatPercentage(y.breakEvenPercentage.value)
                    : y.breakEvenPercentage.status.replaceAll("_", " ")}
                </td>
              ))}
            </tr>

            {/* ROCE */}
            <tr className="hover:bg-slate-50/40">
              <td className="px-4 py-2.5 text-slate-700">
                Return on Capital Employed (ROCE)
              </td>
              {years.map((y) => (
                <td
                  key={y.year}
                  className="px-4 py-2.5 text-right font-medium text-emerald-800 tabular-nums"
                >
                  {y.roce.status === "DEFINED"
                    ? formatPercentage(y.roce.value)
                    : y.roce.status.replaceAll("_", " ")}
                </td>
              ))}
            </tr>

            {/* Net Profit Margin (PAT Margin) */}
            <tr className="hover:bg-slate-50/40">
              <td className="px-4 py-2.5 text-slate-700">
                Net Profit Margin (PAT %)
              </td>
              {years.map((y) => (
                <td
                  key={y.year}
                  className="px-4 py-2.5 text-right tabular-nums"
                >
                  {y.patMargin.status === "DEFINED"
                    ? formatPercentage(y.patMargin.value)
                    : y.patMargin.status.replaceAll("_", " ")}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
