import React from "react";

import type { InvestmentReturnsAnalysis } from "@/domain/investment-returns/investment-returns";
import {
  formatIndianCurrency,
  formatPercentage,
} from "@/lib/application/formatters";

interface InvestmentReturnsCardProps {
  returns: InvestmentReturnsAnalysis;
}

export function InvestmentReturnsCard({ returns }: InvestmentReturnsCardProps) {
  const npv = returns.netPresentValue;
  const irrMetric = returns.internalRateOfReturn.irr;
  const simplePbMetric = returns.simplePayback.paybackPeriod;
  const discPbMetric = returns.discountedPayback.paybackPeriod;
  const piMetric = returns.profitabilityIndex.profitabilityIndex;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Project IRR */}
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <span className="block text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Internal Rate of Return (IRR)
          </span>
          <div className="text-2xl font-extrabold text-indigo-700">
            {irrMetric.status === "DEFINED"
              ? formatPercentage(irrMetric.value)
              : "Undefined"}
          </div>
          <div className="text-xs text-slate-500">
            {irrMetric.status === "DEFINED"
              ? "Project investment internal rate of return"
              : `Status: ${irrMetric.status.replaceAll("_", " ")}`}
          </div>
        </div>

        {/* Net Present Value */}
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <span className="block text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Net Present Value (NPV)
          </span>
          <div className="text-2xl font-extrabold text-emerald-700">
            {formatIndianCurrency(npv.npv)}
          </div>
          <div className="text-xs text-slate-500">
            Discounted at {npv.discountRate}% hurdle rate
          </div>
        </div>

        {/* Profitability Index */}
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <span className="block text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Benefit-Cost Ratio / PI
          </span>
          <div className="text-2xl font-extrabold text-slate-900">
            {piMetric.status === "DEFINED"
              ? `${Number.parseFloat(piMetric.value).toFixed(2)}x`
              : "N/A"}
          </div>
          <div className="text-xs text-slate-500">
            {piMetric.status === "DEFINED"
              ? "Present Value of inflows / initial investment"
              : `Status: ${piMetric.status.replaceAll("_", " ")}`}
          </div>
        </div>
      </div>

      {/* Payback Periods */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <h4 className="text-xs font-bold tracking-wider text-slate-800 uppercase">
          Capital Recovery & Payback Horizon
        </h4>
        <div className="grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4">
            <div>
              <span className="block font-semibold text-slate-800">
                Simple Payback Period
              </span>
              <span className="text-[11px] text-slate-500">
                Undiscounted operating cash recovery
              </span>
            </div>
            <div className="text-right text-base font-extrabold text-slate-900">
              {simplePbMetric.status === "DEFINED"
                ? `${Number.parseFloat(simplePbMetric.value).toFixed(2)} Years`
                : "Not Recovered"}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4">
            <div>
              <span className="block font-semibold text-slate-800">
                Discounted Payback Period
              </span>
              <span className="text-[11px] text-slate-500">
                DCF recovery after {npv.discountRate}% cost of capital
              </span>
            </div>
            <div className="text-right text-base font-extrabold text-slate-900">
              {discPbMetric.status === "DEFINED"
                ? `${Number.parseFloat(discPbMetric.value).toFixed(2)} Years`
                : "Not Recovered"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
