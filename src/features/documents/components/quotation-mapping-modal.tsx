"use client";

import React, { useState, useTransition } from "react";

import { mapQuotationLinesAction } from "@/app/actions/quotation-actions";
import { formatIndianCurrency } from "@/lib/application/formatters";
import type { ProjectCostItemInput } from "@/lib/application/orchestrator/orchestrator-types";
import {
  projectCostCategories,
  type ProjectCostCategory,
} from "@/domain/project-cost/project-cost";
import type {
  NormalizedQuotation,
  QuotationLineMapping,
} from "@/lib/documents/quotation/contracts";
import {
  computeLineAllocationSummary,
  type MapQuotationLineInstruction,
} from "@/lib/documents/quotation/mapping";

interface QuotationMappingModalProps {
  quotation: NormalizedQuotation;
  existingCostItems: readonly ProjectCostItemInput[];
  existingMappings: readonly QuotationLineMapping[];
  isOpen: boolean;
  onClose: () => void;
  onMappingSuccess: (updatedCostItems: readonly ProjectCostItemInput[]) => void;
}

export function QuotationMappingModal({
  quotation,
  existingCostItems,
  existingMappings,
  isOpen,
  onClose,
  onMappingSuccess,
}: QuotationMappingModalProps) {
  const [selectedLines, setSelectedLines] = useState<Record<string, boolean>>(
    () => {
      const init: Record<string, boolean> = {};
      quotation.lineItems.forEach((l) => {
        init[l.lineId] = true;
      });
      return init;
    },
  );

  const [categories, setCategories] = useState<
    Record<string, ProjectCostCategory>
  >(() => {
    const init: Record<string, ProjectCostCategory> = {};
    quotation.lineItems.forEach((l) => {
      init[l.lineId] = "PLANT_AND_MACHINERY";
    });
    return init;
  });

  const [includeGst, setIncludeGst] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    quotation.lineItems.forEach((l) => {
      init[l.lineId] = true;
    });
    return init;
  });

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleMap = (e: React.FormEvent) => {
    e.preventDefault();
    const instructions: MapQuotationLineInstruction[] = [];

    for (const line of quotation.lineItems) {
      if (selectedLines[line.lineId]) {
        instructions.push({
          quotationLineId: line.lineId,
          costCategory: categories[line.lineId] || "PLANT_AND_MACHINERY",
          mappingType: "NEW_ITEM",
          includeGstInCost: includeGst[line.lineId] ?? true,
        });
      }
    }

    if (instructions.length === 0) {
      setError("Please select at least one quotation line item to map.");
      return;
    }

    startTransition(async () => {
      setError(null);
      const res = await mapQuotationLinesAction(
        quotation,
        instructions,
        existingCostItems as ProjectCostItemInput[],
      );

      if (res.success && res.costItems) {
        onMappingSuccess(res.costItems);
        onClose();
      } else {
        setError(res.error || "Failed to map quotation items.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Map Quotation Lines to Project Cost Breakdown
            </h3>
            <p className="text-xs text-slate-500">
              Select which approved quotation items to transfer into your
              Project Cost. Double-counting protection is strictly active.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <form
          onSubmit={handleMap}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {error && (
              <div className="rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700">
                {error}
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <span className="font-semibold text-slate-800">Source:</span>{" "}
              {quotation.supplier.name} (Quotation:{" "}
              {quotation.quotationNumber || "N/A"})
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-semibold text-slate-700 uppercase">
                  <tr>
                    <th className="w-10 px-3 py-2.5 text-center">Map</th>
                    <th className="px-3 py-2.5">Quotation Line</th>
                    <th className="w-48 px-3 py-2.5">Target Cost Category</th>
                    <th className="w-32 px-3 py-2.5 text-right">Line Total</th>
                    <th className="w-32 px-3 py-2.5 text-right">
                      Remaining Mappable
                    </th>
                    <th className="w-28 px-3 py-2.5 text-center">Inc. GST</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {quotation.lineItems.map((line) => {
                    const alloc = computeLineAllocationSummary(
                      line,
                      existingMappings,
                    );

                    return (
                      <tr
                        key={line.lineId}
                        className={`hover:bg-slate-50/60 ${alloc.isFullyAllocated ? "opacity-40" : ""}`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            disabled={alloc.isFullyAllocated}
                            checked={
                              !!selectedLines[line.lineId] &&
                              !alloc.isFullyAllocated
                            }
                            onChange={(e) =>
                              setSelectedLines({
                                ...selectedLines,
                                [line.lineId]: e.target.checked,
                              })
                            }
                            className="h-4 w-4 rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                        </td>
                        <td className="p-3 font-medium text-slate-900">
                          <div>{line.description}</div>
                          <div className="text-[11px] text-slate-500">
                            Qty: {line.quantity} {line.unit} @ ₹{line.unitRate}
                          </div>
                        </td>
                        <td className="p-3">
                          <select
                            disabled={alloc.isFullyAllocated}
                            className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                            value={
                              categories[line.lineId] || "PLANT_AND_MACHINERY"
                            }
                            onChange={(e) =>
                              setCategories({
                                ...categories,
                                [line.lineId]: e.target
                                  .value as ProjectCostCategory,
                              })
                            }
                          >
                            {projectCostCategories.map((c) => (
                              <option key={c} value={c}>
                                {c.replace(/_/g, " ")}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-medium text-slate-700">
                          {formatIndianCurrency(line.lineTotal)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-bold text-emerald-700">
                          {alloc.isFullyAllocated ? (
                            <span className="text-slate-400">Fully Mapped</span>
                          ) : (
                            formatIndianCurrency(alloc.remainingAmount)
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            disabled={alloc.isFullyAllocated}
                            checked={includeGst[line.lineId] ?? true}
                            onChange={(e) =>
                              setIncludeGst({
                                ...includeGst,
                                [line.lineId]: e.target.checked,
                              })
                            }
                            className="h-4 w-4 rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
            >
              {isPending
                ? "Mapping Items..."
                : "Transfer Selected to Project Cost"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
