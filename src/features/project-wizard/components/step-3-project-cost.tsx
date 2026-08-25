"use client";

import React, { useState } from "react";

import { extractQuotationAction } from "@/app/actions/quotation-actions";
import {
  formatIndianCurrency,
  sumDecimalStrings,
} from "@/lib/application/formatters";
import type { ProjectCostItemInput } from "@/lib/application/orchestrator/orchestrator-types";
import { generateId } from "@/lib/persistence/id";
import type { PersistedDocumentMetadata } from "@/lib/persistence/repositories";
import type {
  NormalizedQuotation,
  QuotationLineMapping,
} from "@/lib/documents/quotation/contracts";
import { DocumentUploadModal } from "@/features/documents/components/document-upload-modal";
import { QuotationManualForm } from "@/features/documents/components/quotation-manual-form";
import { QuotationMappingModal } from "@/features/documents/components/quotation-mapping-modal";
import { QuotationReviewModal } from "@/features/documents/components/quotation-review-modal";

interface Step3ProjectCostProps {
  projectId?: string;
  items: readonly ProjectCostItemInput[];
  onChange: (items: readonly ProjectCostItemInput[]) => void;
}

const COST_CATEGORIES = [
  { label: "Land & Site Development", value: "LAND_DEVELOPMENT" },
  { label: "Factory Building & Civil Works", value: "BUILDING" },
  { label: "Plant, Machinery & Main Equipment", value: "PLANT_AND_MACHINERY" },
  {
    label: "Electrical Installation & Power",
    value: "ELECTRICAL_INSTALLATION",
  },
  { label: "Furniture, Fixtures & Office Equipment", value: "FURNITURE" },
  {
    label: "Preliminary & Pre-Operative Expenses",
    value: "PREOPERATIVE_EXPENSES",
  },
  { label: "Margin for Working Capital", value: "MARGIN_FOR_WORKING_CAPITAL" },
  { label: "Contingencies & Miscellaneous", value: "CONTINGENCIES" },
];

export function Step3ProjectCost({
  projectId = "",
  items,
  onChange,
}: Step3ProjectCostProps) {
  const totalCost = sumDecimalStrings(items.map((item) => item.amount));

  // Modal workflows
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [reviewQuote, setReviewQuote] = useState<{
    extractionId: string;
    quotation: NormalizedQuotation;
  } | null>(null);
  const [mappingQuote, setMappingQuote] = useState<NormalizedQuotation | null>(
    null,
  );
  const [existingMappings] = useState<QuotationLineMapping[]>([]);

  const handleAddItem = () => {
    const newItem: ProjectCostItemInput = {
      id: generateId(),
      description: "New Equipment / Cost Item",
      category: "PLANT_AND_MACHINERY",
      amount: "100000.00",
    };
    onChange([...items, newItem]);
  };

  const handleUpdateItem = (
    id: string,
    updated: Partial<ProjectCostItemInput>,
  ) => {
    onChange(
      items.map((item) => (item.id === id ? { ...item, ...updated } : item)),
    );
  };

  const handleRemoveItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const handleDocumentUploaded = async (doc: PersistedDocumentMetadata) => {
    if (doc.kind === "QUOTATION") {
      const res = await extractQuotationAction(doc.id);
      if (res.success && res.extraction) {
        const ext = res.extraction;
        const quote = ext.normalizedData as NormalizedQuotation;
        if (quote && quote.lineItems) {
          setReviewQuote({ extractionId: ext.id, quotation: quote });
        } else {
          setIsManualFormOpen(true);
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Step 3: Project Cost Breakdown
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Itemize all capital expenditures, machinery, civil works,
            pre-operative costs, or map directly from verified supplier
            quotations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {projectId && (
            <>
              <button
                type="button"
                onClick={() => setIsManualFormOpen(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
              >
                + Enter Quotation Manually
              </button>
              <button
                type="button"
                onClick={() => setIsUploadOpen(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800"
              >
                📄 Upload & Map Quotation
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleAddItem}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
          >
            + Add Cost Manually
          </button>
        </div>
      </div>

      {/* Manual Quotation Form if triggered */}
      {isManualFormOpen && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <QuotationManualForm
            projectId={projectId}
            onSuccess={(quote) => {
              setIsManualFormOpen(false);
              setMappingQuote(quote);
            }}
            onCancel={() => setIsManualFormOpen(false)}
          />
        </div>
      )}

      {/* Items Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
              <th className="px-3 py-3">Item Description</th>
              <th className="px-3 py-3">Category</th>
              <th className="px-3 py-3 text-right">Amount (₹)</th>
              <th className="w-16 px-3 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {items.map((item) => {
              const hasQuotationProvenance =
                !!item.notes && item.notes.includes("Source: Quotation");

              return (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="p-2">
                    <div className="space-y-1">
                      <input
                        type="text"
                        className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500"
                        value={item.description}
                        onChange={(e) =>
                          handleUpdateItem(item.id, {
                            description: e.target.value,
                          })
                        }
                      />
                      {hasQuotationProvenance && (
                        <div className="inline-flex items-center gap-1 rounded-sm bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] text-emerald-800">
                          <span>📑</span> {item.notes}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-2">
                    <select
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500"
                      value={item.category}
                      onChange={(e) =>
                        handleUpdateItem(item.id, {
                          category: e.target
                            .value as ProjectCostItemInput["category"],
                        })
                      }
                    >
                      {COST_CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2 text-right">
                    <input
                      type="text"
                      className="inline-block w-36 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-right font-mono text-xs focus:ring-1 focus:ring-emerald-500"
                      value={item.amount}
                      onChange={(e) =>
                        handleUpdateItem(item.id, { amount: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="px-2 py-1 text-sm font-bold text-slate-400 transition-colors hover:text-rose-600"
                      title="Delete item"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-400">
                  No cost items added yet. Click &quot;+ Add Cost Manually&quot;
                  or upload a quotation to begin.
                </td>
              </tr>
            )}
            <tr className="border-t-2 border-slate-300 bg-slate-100/80 font-bold text-slate-900">
              <td colSpan={2} className="px-4 py-3 text-sm">
                Total Estimated Project Cost
              </td>
              <td className="px-3 py-3 text-right text-sm font-extrabold text-slate-950 tabular-nums">
                {formatIndianCurrency(String(totalCost))}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {projectId && (
        <>
          <DocumentUploadModal
            projectId={projectId}
            isOpen={isUploadOpen}
            onClose={() => setIsUploadOpen(false)}
            onUploadSuccess={handleDocumentUploaded}
          />

          {reviewQuote && (
            <QuotationReviewModal
              projectId={projectId}
              extractionId={reviewQuote.extractionId}
              quotation={reviewQuote.quotation}
              isOpen={true}
              onClose={() => setReviewQuote(null)}
              onApproveSuccess={() => {}}
              onOpenMapping={(quote) => {
                setReviewQuote(null);
                setMappingQuote(quote);
              }}
            />
          )}

          {mappingQuote && (
            <QuotationMappingModal
              quotation={mappingQuote}
              existingCostItems={items}
              existingMappings={existingMappings}
              isOpen={true}
              onClose={() => setMappingQuote(null)}
              onMappingSuccess={(updated) => {
                onChange(updated);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
