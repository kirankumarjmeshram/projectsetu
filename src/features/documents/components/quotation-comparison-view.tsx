"use client";

import React, { useEffect, useState, useTransition } from "react";

import { compareQuotationsAction } from "@/app/actions/quotation-actions";
import { formatIndianCurrency } from "@/lib/application/formatters";
import type { QuotationComparisonMatrix } from "@/lib/documents/quotation/comparison";

interface QuotationComparisonViewProps {
  projectId: string;
  documentIds: readonly string[];
  onClose: () => void;
}

export function QuotationComparisonView({
  projectId,
  documentIds,
  onClose,
}: QuotationComparisonViewProps) {
  const [matrix, setMatrix] = useState<QuotationComparisonMatrix | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startTransition(async () => {
      setError(null);
      const res = await compareQuotationsAction(projectId, documentIds);
      if (res.success && res.matrix) {
        setMatrix(res.matrix);
      } else {
        setError(res.error || "Failed to generate comparison matrix.");
      }
    });
  }, [projectId, documentIds]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Supplier Quotation Comparison Matrix
            </h3>
            <p className="text-xs text-slate-500">
              Side-by-side transparent evaluation of commercial rates, taxes,
              freight, and terms.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {isPending && (
            <div className="py-12 text-center text-xs font-semibold text-slate-500">
              Loading quotation comparison...
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}

          {matrix && matrix.summaries.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-xs text-slate-500">
              No quotations available for comparison.
            </div>
          )}

          {matrix && matrix.summaries.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-semibold text-slate-700 uppercase">
                  <tr>
                    <th className="px-4 py-3">Parameter</th>
                    {matrix.summaries.map((s, idx) => (
                      <th
                        key={s.quotationId || idx}
                        className="px-4 py-3 text-right"
                      >
                        Quote #{idx + 1}: {s.supplierName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-slate-700">
                      Quotation Ref
                    </td>
                    {matrix.summaries.map((s) => (
                      <td
                        key={s.quotationId}
                        className="px-4 py-2.5 text-right font-mono text-slate-600"
                      >
                        {s.quotationNumber || "N/A"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-slate-700">
                      Date
                    </td>
                    {matrix.summaries.map((s) => (
                      <td
                        key={s.quotationId}
                        className="px-4 py-2.5 text-right text-slate-600"
                      >
                        {s.quotationDate || "N/A"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-slate-700">
                      Line Items Count
                    </td>
                    {matrix.summaries.map((s) => (
                      <td
                        key={s.quotationId}
                        className="px-4 py-2.5 text-right font-mono text-slate-900"
                      >
                        {s.itemCount}
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td className="px-4 py-2.5 font-semibold text-slate-700">
                      Taxable Base Amount
                    </td>
                    {matrix.summaries.map((s) => (
                      <td
                        key={s.quotationId}
                        className="px-4 py-2.5 text-right font-mono text-slate-900"
                      >
                        {formatIndianCurrency(s.taxableAmount)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-slate-700">
                      Total GST / Taxes
                    </td>
                    {matrix.summaries.map((s) => (
                      <td
                        key={s.quotationId}
                        className="px-4 py-2.5 text-right font-mono text-slate-600"
                      >
                        {formatIndianCurrency(s.totalTax)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-slate-700">
                      Freight & Transport
                    </td>
                    {matrix.summaries.map((s) => (
                      <td
                        key={s.quotationId}
                        className="px-4 py-2.5 text-right font-mono text-slate-600"
                      >
                        {formatIndianCurrency(s.freight)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-slate-700">
                      Installation & Commissioning
                    </td>
                    {matrix.summaries.map((s) => (
                      <td
                        key={s.quotationId}
                        className="px-4 py-2.5 text-right font-mono text-slate-600"
                      >
                        {formatIndianCurrency(s.installation)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t-2 border-slate-300 bg-emerald-50/40">
                    <td className="px-4 py-3 font-bold text-slate-900 uppercase">
                      Grand Total (All-Inclusive)
                    </td>
                    {matrix.summaries.map((s) => (
                      <td
                        key={s.quotationId}
                        className="px-4 py-3 text-right font-mono text-sm font-extrabold text-emerald-800"
                      >
                        {formatIndianCurrency(s.grandTotal)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
}
