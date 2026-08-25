"use client";

import React, { useState, useTransition } from "react";

import {
  approveQuotationAction,
  saveQuotationReviewAction,
} from "@/app/actions/quotation-actions";
import { formatIndianCurrency } from "@/lib/application/formatters";
import type {
  NormalizedQuotation,
  NormalizedQuotationLine,
} from "@/lib/documents/quotation/contracts";
import {
  calculateQuotationTotals,
  computeQuotationLineFinancials,
} from "@/lib/documents/quotation/normalization";

interface QuotationReviewModalProps {
  projectId: string;
  extractionId: string;
  quotation: NormalizedQuotation;
  isOpen: boolean;
  onClose: () => void;
  onApproveSuccess: (approvedQuotation: NormalizedQuotation) => void;
  onOpenMapping: (quotation: NormalizedQuotation) => void;
}

export function QuotationReviewModal({
  projectId,
  extractionId,
  quotation,
  isOpen,
  onClose,
  onApproveSuccess,
  onOpenMapping,
}: QuotationReviewModalProps) {
  const [editedQuote, setEditedQuote] =
    useState<NormalizedQuotation>(quotation);
  const [reviewerNotes, setReviewerNotes] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleUpdateLine = (
    index: number,
    updated: Partial<NormalizedQuotationLine>,
  ) => {
    const nextLines = [...editedQuote.lineItems];
    const current = nextLines[index];
    const merged = { ...current, ...updated };

    const calc = computeQuotationLineFinancials({
      quantity: merged.quantity,
      unitRate: merged.unitRate,
      discount: merged.discount,
      gstRate: merged.gstRate,
      isInterstate: !!merged.igst && merged.igst !== "0",
    });

    nextLines[index] = {
      ...merged,
      taxableAmount: calc.taxableAmount,
      cgst: calc.cgst,
      sgst: calc.sgst,
      igst: calc.igst,
      lineTotal: calc.lineTotal,
    };

    const nextTotals = calculateQuotationTotals(nextLines, {
      freight: editedQuote.totals.freight,
      installation: editedQuote.totals.installation,
      otherCharges: editedQuote.totals.otherCharges,
    });

    setEditedQuote({
      ...editedQuote,
      lineItems: nextLines,
      totals: nextTotals,
    });
    setIsSaved(false);
  };

  const handleSaveDraft = () => {
    startTransition(async () => {
      setError(null);
      const res = await saveQuotationReviewAction(
        projectId,
        extractionId,
        editedQuote,
        reviewerNotes,
      );
      if (res.success) {
        setIsSaved(true);
      } else {
        setError(res.error || "Failed to save review draft.");
      }
    });
  };

  const handleApprove = () => {
    startTransition(async () => {
      setError(null);
      const res = await approveQuotationAction(
        projectId,
        extractionId,
        editedQuote,
        reviewerNotes,
      );
      if (res.success) {
        onApproveSuccess(editedQuote);
        onOpenMapping(editedQuote);
      } else {
        setError(res.error || "Failed to approve quotation.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-slate-900">
                Review & Verify Supplier Quotation
              </h3>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                {editedQuote.metadata.extractionProvider}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Verify vendor GSTIN, quantities, item rates, and tax breakdown
              before approving for Project Cost.
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

        {/* Content Body */}
        <div className="space-y-6 overflow-y-auto p-6">
          {error && (
            <div className="rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}
          {isSaved && (
            <div className="rounded-lg bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
              ✓ Review draft saved successfully.
            </div>
          )}

          {/* Supplier Info Bar */}
          <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
            <div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase">
                Vendor / Supplier
              </div>
              <div className="text-sm font-bold text-slate-900">
                {editedQuote.supplier.name}
              </div>
              {editedQuote.supplier.gstin && (
                <div className="font-mono text-xs text-slate-600">
                  GSTIN: {editedQuote.supplier.gstin}
                </div>
              )}
            </div>

            <div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase">
                Quotation Number & Date
              </div>
              <div className="text-sm font-medium text-slate-900">
                {editedQuote.quotationNumber || "N/A"}
              </div>
              <div className="text-xs text-slate-500">
                Date: {editedQuote.quotationDate || "N/A"}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase">
                Grand Total (Inc. Tax & Charges)
              </div>
              <div className="text-lg font-extrabold text-emerald-700">
                {formatIndianCurrency(editedQuote.totals.grandTotal)}
              </div>
              <div className="text-xs text-slate-500">
                Taxable:{" "}
                {formatIndianCurrency(editedQuote.totals.taxableAmount)}
              </div>
            </div>
          </div>

          {/* Editable Line Items Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold tracking-wider text-slate-700 uppercase">
              Itemized Quotation Lines (Editable)
            </h4>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-semibold text-slate-700 uppercase">
                  <tr>
                    <th className="px-3 py-2.5">Line Description</th>
                    <th className="w-20 px-3 py-2.5 text-right">Qty</th>
                    <th className="w-20 px-3 py-2.5 text-right">Unit</th>
                    <th className="w-28 px-3 py-2.5 text-right">Rate (₹)</th>
                    <th className="w-28 px-3 py-2.5 text-right">Taxable (₹)</th>
                    <th className="w-20 px-3 py-2.5 text-right">GST %</th>
                    <th className="w-28 px-3 py-2.5 text-right">
                      Line Total (₹)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {editedQuote.lineItems.map((line, idx) => (
                    <tr
                      key={line.lineId || idx}
                      className="hover:bg-slate-50/60"
                    >
                      <td className="p-2">
                        <input
                          type="text"
                          className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                          value={line.description}
                          onChange={(e) =>
                            handleUpdateLine(idx, {
                              description: e.target.value,
                            })
                          }
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-right font-mono text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                          value={line.quantity}
                          onChange={(e) =>
                            handleUpdateLine(idx, { quantity: e.target.value })
                          }
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-right text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                          value={line.unit}
                          onChange={(e) =>
                            handleUpdateLine(idx, { unit: e.target.value })
                          }
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-right font-mono text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                          value={line.unitRate}
                          onChange={(e) =>
                            handleUpdateLine(idx, { unitRate: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-medium text-slate-700">
                        {formatIndianCurrency(line.taxableAmount)}
                      </td>
                      <td className="p-2">
                        <select
                          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-right text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                          value={line.gstRate || "18.00"}
                          onChange={(e) =>
                            handleUpdateLine(idx, { gstRate: e.target.value })
                          }
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                        {formatIndianCurrency(line.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              Reviewer Notes / Verification Audit
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              placeholder="e.g. Quotation verified against OEM catalogue and official price list."
              value={reviewerNotes}
              onChange={(e) => setReviewerNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isPending}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={isPending}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
            >
              {isPending ? "Approving..." : "✓ Approve & Map to Project Cost →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
