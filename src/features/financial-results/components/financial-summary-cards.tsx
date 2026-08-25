import React from "react";

import type { ProjectCalculationResult } from "@/lib/application/orchestrator/orchestrator-types";
import {
  formatIndianCurrency,
  formatLakhsCrores,
  formatPercentage,
  formatRatio,
  isDecimalNegative,
  isDecimalZero,
  sumDecimalStrings,
} from "@/lib/application/formatters";

interface FinancialSummaryCardsProps {
  result: ProjectCalculationResult;
}

export function FinancialSummaryCards({ result }: FinancialSummaryCardsProps) {
  const {
    projectCost,
    meansOfFinance,
    projection,
    loanSchedule,
    profitAndLoss,
    bankabilityMetrics,
    investmentReturns,
    fundingComposer,
  } = result;

  const totalCost = projectCost?.totalProjectCost;
  const promoterEquity = sumDecimalStrings(
    meansOfFinance?.sources
      .filter(
        (s) =>
          s.type === "PROMOTER_CONTRIBUTION" ||
          s.type === "EQUITY" ||
          s.type === "OTHER_CONTRIBUTION",
      )
      .map((s) => s.amount) || [],
  );

  const bankDebt = loanSchedule?.summary.originalPrincipal;
  const year1Revenue = projection?.years[0]?.totalRevenue;
  const year1Ebitda = profitAndLoss?.years[0]?.ebitda;
  const avgDscrMetric = bankabilityMetrics?.averageDscr.averageDscr;
  const avgDscr =
    avgDscrMetric?.status === "DEFINED" ? avgDscrMetric.value : undefined;
  const projectIrrMetric = investmentReturns?.internalRateOfReturn.irr;
  const projectIrr =
    projectIrrMetric?.status === "DEFINED" ? projectIrrMetric.value : undefined;
  const npv = investmentReturns?.netPresentValue.npv;
  const subsidyAmount = fundingComposer?.summary.benefits.capitalSubsidy;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
          Total Project Cost
        </div>
        <div className="mt-1 text-2xl font-bold text-slate-900">
          {formatIndianCurrency(totalCost)}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {formatLakhsCrores(totalCost)}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
          Means of Finance
        </div>
        <div className="mt-1 text-lg font-bold text-slate-900">
          Equity: {formatIndianCurrency(promoterEquity)}
        </div>
        <div className="mt-1 text-xs font-medium text-emerald-700">
          Debt: {formatIndianCurrency(bankDebt)}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
          Year 1 Revenue / EBITDA
        </div>
        <div className="mt-1 text-xl font-bold text-slate-900">
          {formatIndianCurrency(year1Revenue)}
        </div>
        <div className="mt-1 text-xs font-medium text-emerald-700">
          EBITDA: {formatIndianCurrency(year1Ebitda)}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
          Bankability & Returns
        </div>
        <div className="mt-1 text-xl font-bold text-indigo-700">
          Avg DSCR: {formatRatio(avgDscr, "x", 2, "N/A")}
        </div>
        <div className="mt-1 text-xs font-medium text-slate-600">
          IRR: {projectIrr ? formatPercentage(projectIrr) : "N/A"} | NPV:{" "}
          {formatIndianCurrency(npv)}
        </div>
      </div>

      {subsidyAmount &&
        !isDecimalZero(subsidyAmount) &&
        !isDecimalNegative(subsidyAmount) && (
          <div className="col-span-2 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3 md:col-span-4">
            <div>
              <span className="text-xs font-bold tracking-wider text-emerald-900 uppercase">
                Eligible Scheme Assistance Identified
              </span>
              <div className="text-lg font-extrabold text-emerald-800">
                {formatIndianCurrency(subsidyAmount)} (
                {formatLakhsCrores(subsidyAmount)})
              </div>
            </div>
            <div className="max-w-md text-right text-xs text-emerald-700">
              Calculated under selected government scheme guidelines. Not
              auto-credited as immediate cash.
            </div>
          </div>
        )}
    </div>
  );
}
