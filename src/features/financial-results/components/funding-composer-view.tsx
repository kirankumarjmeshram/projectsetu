import React from "react";

import type { MultiProgramFundingResult } from "@/domain/funding-composer/contracts";
import { formatIndianCurrency } from "@/lib/application/formatters";

interface FundingComposerViewProps {
  funding: MultiProgramFundingResult;
}

export function FundingComposerView({ funding }: FundingComposerViewProps) {
  const {
    individualProgramEvaluations,
    compatibilityEvaluations,
    conflicts,
    warnings,
    manualReviewItems,
    summary,
    resolutionStatus,
  } = funding;

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Government Scheme & Funding Evaluation
              </h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  resolutionStatus === "RESOLVED"
                    ? "bg-emerald-100 text-emerald-800"
                    : resolutionStatus === "MANUAL_REVIEW_REQUIRED"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-800"
                }`}
              >
                {resolutionStatus.replaceAll("_", " ")}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Multi-program evaluation, convergence checking, benefit caps, and
              release mechanisms
            </p>
          </div>

          <div className="text-right">
            <span className="block text-xs text-slate-500">
              Total Calculated Assistance
            </span>
            <span className="text-2xl font-extrabold text-emerald-700">
              {formatIndianCurrency(summary.benefits.capitalSubsidy)}
            </span>
          </div>
        </div>
      </div>

      {/* Program Evaluations List */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold tracking-wider text-slate-700 uppercase">
          Individual Scheme Evaluations ({individualProgramEvaluations.length})
        </h4>

        <div className="grid grid-cols-1 gap-4">
          {individualProgramEvaluations.map((prog) => {
            const evalResult = prog.evaluation;
            const programId = prog.selection.programId;
            const isEligible = evalResult?.eligibility.status === "ELIGIBLE";

            return (
              <div
                key={programId}
                className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {programId}
                      </span>
                      {prog.snapshot && (
                        <span className="font-mono text-[10px] text-slate-400">
                          v{prog.snapshot.programVersionId}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Status: {prog.status.replaceAll("_", " ")}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      isEligible
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {evalResult?.eligibility.status || prog.status}
                  </span>
                </div>

                {evalResult && (
                  <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-xs md:grid-cols-4">
                    <div>
                      <span className="block text-slate-500">
                        Eligible Project Cost:
                      </span>
                      <strong className="text-slate-800">
                        {formatIndianCurrency(
                          evalResult.costEligibility?.eligibleProjectCost,
                        )}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-slate-500">
                        Calculated Subsidy:
                      </span>
                      <strong className="text-emerald-700">
                        {formatIndianCurrency(
                          evalResult.totalCalculatedEligibleBenefit,
                        )}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-slate-500">
                        Min Promoter Contribution:
                      </span>
                      <strong className="text-slate-800">
                        {evalResult.fundingConstraint?.contributionCompliance
                          .status === "MEETS_REQUIREMENT"
                          ? "Compliant"
                          : evalResult.fundingConstraint?.contributionCompliance
                              .status || "Review Needed"}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-slate-500">
                        Bank Finance Status:
                      </span>
                      <strong className="text-slate-800">
                        {evalResult.fundingConstraint?.bankFinanceCompliance
                          .status === "MEETS_REQUIREMENT"
                          ? "Compliant"
                          : evalResult.fundingConstraint?.bankFinanceCompliance
                              .status || "Review Needed"}
                      </strong>
                    </div>
                  </div>
                )}

                {/* Benefits Breakdown */}
                {evalResult?.benefits && evalResult.benefits.length > 0 && (
                  <div className="space-y-2 border-t border-slate-100 pt-2">
                    <span className="block text-[11px] font-bold tracking-wider text-slate-600 uppercase">
                      Benefit Allocations & Release Mechanism
                    </span>
                    <div className="space-y-1.5">
                      {evalResult.benefits.map((b) => (
                        <div
                          key={b.benefitId}
                          className="flex flex-col justify-between rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 text-xs sm:flex-row sm:items-center"
                        >
                          <div>
                            <span className="font-semibold text-slate-800">
                              {b.benefitId}
                            </span>
                            <div className="text-[11px] text-slate-500">
                              Kind: {b.benefitKind.replaceAll("_", " ")} |
                              Status: {b.status}
                            </div>
                          </div>
                          <div className="mt-1 text-right text-sm font-extrabold text-emerald-800 sm:mt-0">
                            {formatIndianCurrency(b.calculatedEligibleBenefit)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Program Convergence & Compatibility */}
      {compatibilityEvaluations && compatibilityEvaluations.length > 0 && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <h4 className="text-xs font-bold tracking-wider text-slate-700 uppercase">
            Pairwise Program Convergence & Compatibility
          </h4>
          <div className="space-y-2">
            {compatibilityEvaluations.map((c, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs"
              >
                <div>
                  <span className="font-semibold text-slate-800">
                    {c.leftProgram.programId} + {c.rightProgram.programId}
                  </span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    c.status === "COMPATIBLE"
                      ? "bg-emerald-100 text-emerald-800"
                      : c.status === "INCOMPATIBLE"
                        ? "bg-rose-100 text-rose-800"
                        : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conflicts & Warnings */}
      {(conflicts.length > 0 ||
        warnings.length > 0 ||
        manualReviewItems.length > 0) && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <h4 className="text-xs font-bold tracking-wider text-slate-700 uppercase">
            Compliance, Warnings & Manual Review Notes
          </h4>

          {conflicts.map((c, i) => (
            <div
              key={i}
              className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900"
            >
              <strong className="block font-bold">
                Funding Conflict: {c.code}
              </strong>
              <p className="mt-0.5">{c.messageCode || c.code}</p>
            </div>
          ))}

          {warnings.map((w, i) => (
            <div
              key={i}
              className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
            >
              <strong className="block font-bold">Warning: {w.code}</strong>
              <p className="mt-0.5">{w.code}</p>
            </div>
          ))}

          {manualReviewItems.map((m, i) => (
            <div
              key={i}
              className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900"
            >
              <strong className="block font-bold">
                Manual Verification Flag: {m.code}
              </strong>
              <p className="mt-0.5">{m.code}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
