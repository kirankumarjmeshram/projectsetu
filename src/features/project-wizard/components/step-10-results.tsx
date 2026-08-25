"use client";

import React, { useState } from "react";

import type { ProjectCalculationResult } from "@/lib/application/orchestrator/orchestrator-types";
import { BalanceSheetTable } from "@/features/financial-results/components/balance-sheet-table";
import { BankabilityMetricsTable } from "@/features/financial-results/components/bankability-metrics-table";
import { CashFlowTable } from "@/features/financial-results/components/cash-flow-table";
import { DepreciationTable } from "@/features/financial-results/components/depreciation-table";
import { FinancialSummaryCards } from "@/features/financial-results/components/financial-summary-cards";
import { FundingComposerView } from "@/features/financial-results/components/funding-composer-view";
import { InvestmentReturnsCard } from "@/features/financial-results/components/investment-returns-card";
import { IssuesView } from "@/features/financial-results/components/issues-view";
import { LoanScheduleTable } from "@/features/financial-results/components/loan-schedule-table";
import { ProfitAndLossTable } from "@/features/financial-results/components/profit-and-loss-table";
import { RevenueProjectionTable } from "@/features/financial-results/components/revenue-projection-table";

interface Step10ResultsProps {
  result: ProjectCalculationResult | null;
  onRecalculate: () => void;
  isCalculating: boolean;
}

type StatementTab =
  | "SUMMARY"
  | "PROFIT_AND_LOSS"
  | "CASH_FLOW"
  | "BALANCE_SHEET"
  | "BANKABILITY_METRICS"
  | "INVESTMENT_RETURNS"
  | "SCHEMES"
  | "LOAN_SCHEDULE"
  | "DEPRECIATION"
  | "REVENUE_OPEX"
  | "AUDIT_ISSUES";

export function Step10Results({
  result,
  onRecalculate,
  isCalculating,
}: Step10ResultsProps) {
  const [activeTab, setActiveTab] = useState<StatementTab>("SUMMARY");

  if (!result) {
    return (
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-12 text-center">
        <div className="text-3xl">📊</div>
        <h3 className="text-base font-bold text-slate-900">
          No Calculation Run Yet
        </h3>
        <p className="mx-auto max-w-md text-xs text-slate-500">
          Execute the financial calculation engines to generate multi-year
          projected financial statements, bankability ratios, DCF returns, and
          scheme evaluations.
        </p>
        <button
          type="button"
          onClick={onRecalculate}
          disabled={isCalculating}
          className="rounded-xl bg-emerald-700 px-6 py-2.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-emerald-800 disabled:opacity-50"
        >
          {isCalculating
            ? "Calculating..."
            : "⚡ Execute Financial Engines Now"}
        </button>
      </div>
    );
  }

  const tabs: { id: StatementTab; label: string; count?: number }[] = [
    { id: "SUMMARY", label: "Executive Summary" },
    { id: "PROFIT_AND_LOSS", label: "Profit & Loss" },
    { id: "CASH_FLOW", label: "Cash Flow" },
    { id: "BALANCE_SHEET", label: "Balance Sheet" },
    { id: "BANKABILITY_METRICS", label: "Bankability Metrics" },
    { id: "INVESTMENT_RETURNS", label: "Project Returns (IRR/NPV)" },
    ...(result.fundingComposer
      ? [{ id: "SCHEMES" as StatementTab, label: "Government Schemes" }]
      : []),
    { id: "LOAN_SCHEDULE", label: "Loan Repayment" },
    { id: "DEPRECIATION", label: "Depreciation" },
    { id: "REVENUE_OPEX", label: "Revenue & Opex" },
    {
      id: "AUDIT_ISSUES",
      label: "Audit & Issues",
      count: result.issues.length,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Step 10: Financial Statements & Feasibility Results
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Authoritative financial statements and bank appraisal metrics ready
            for Task 020 DPR generation.
          </p>
        </div>

        <button
          type="button"
          onClick={onRecalculate}
          disabled={isCalculating}
          className="shrink-0 rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-slate-900 disabled:opacity-50"
        >
          {isCalculating ? "Recalculating..." : "↻ Recalculate"}
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? "bg-emerald-700 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={`py-0.2 ml-1.5 rounded-full px-1.5 text-[10px] ${
                  activeTab === tab.id
                    ? "bg-white/20 text-white"
                    : "bg-rose-100 font-bold text-rose-800"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content Panels */}
      <div className="space-y-6">
        {activeTab === "SUMMARY" && (
          <div className="space-y-6">
            <FinancialSummaryCards result={result} />
            {result.profitAndLoss && (
              <ProfitAndLossTable profitAndLoss={result.profitAndLoss} />
            )}
            {result.bankabilityMetrics && (
              <BankabilityMetricsTable metrics={result.bankabilityMetrics} />
            )}
          </div>
        )}

        {activeTab === "PROFIT_AND_LOSS" && result.profitAndLoss && (
          <ProfitAndLossTable profitAndLoss={result.profitAndLoss} />
        )}

        {activeTab === "CASH_FLOW" && result.cashFlow && (
          <CashFlowTable cashFlow={result.cashFlow} />
        )}

        {activeTab === "BALANCE_SHEET" && result.balanceSheet && (
          <BalanceSheetTable balanceSheet={result.balanceSheet} />
        )}

        {activeTab === "BANKABILITY_METRICS" && result.bankabilityMetrics && (
          <BankabilityMetricsTable metrics={result.bankabilityMetrics} />
        )}

        {activeTab === "INVESTMENT_RETURNS" && result.investmentReturns && (
          <InvestmentReturnsCard returns={result.investmentReturns} />
        )}

        {activeTab === "SCHEMES" && result.fundingComposer && (
          <FundingComposerView funding={result.fundingComposer} />
        )}

        {activeTab === "LOAN_SCHEDULE" && result.loanSchedule && (
          <LoanScheduleTable loanSchedule={result.loanSchedule} />
        )}

        {activeTab === "DEPRECIATION" && result.depreciation && (
          <DepreciationTable depreciation={result.depreciation} />
        )}

        {activeTab === "REVENUE_OPEX" && result.projection && (
          <RevenueProjectionTable projection={result.projection} />
        )}

        {activeTab === "AUDIT_ISSUES" && <IssuesView issues={result.issues} />}
      </div>
    </div>
  );
}
