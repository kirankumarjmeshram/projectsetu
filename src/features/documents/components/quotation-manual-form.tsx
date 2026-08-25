"use client";

import React, { useState, useTransition } from "react";

import { createManualQuotationAction } from "@/app/actions/quotation-actions";
import { formatIndianCurrency } from "@/lib/application/formatters";
import type {
  NormalizedQuotation,
  NormalizedQuotationLine,
  QuotationSupplier,
} from "@/lib/documents/quotation/contracts";
import { computeQuotationLineFinancials } from "@/lib/documents/quotation/normalization";
import { generateId } from "@/lib/persistence/id";

interface QuotationManualFormProps {
  projectId: string;
  documentId?: string;
  onSuccess: (quotation: NormalizedQuotation) => void;
  onCancel: () => void;
}

export function QuotationManualForm({
  projectId,
  documentId,
  onSuccess,
  onCancel,
}: QuotationManualFormProps) {
  const [supplier, setSupplier] = useState<QuotationSupplier>({
    name: "",
    address: "",
    phone: "",
    email: "",
    gstin: "",
  });
  const [quotationNumber, setQuotationNumber] = useState<string>("");
  const [quotationDate, setQuotationDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [freight, setFreight] = useState<string>("0");
  const [installation, setInstallation] = useState<string>("0");
  const [isInterstate, setIsInterstate] = useState<boolean>(false);
  const [lines, setLines] = useState<Partial<NormalizedQuotationLine>[]>([
    {
      lineId: generateId(),
      description: "",
      quantity: "1",
      unit: "Nos",
      unitRate: "0.00",
      gstRate: "18.00",
    },
  ]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleAddLine = () => {
    setLines([
      ...lines,
      {
        lineId: generateId(),
        description: "",
        quantity: "1",
        unit: "Nos",
        unitRate: "0.00",
        gstRate: "18.00",
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, idx) => idx !== index));
  };

  const handleUpdateLine = (
    index: number,
    updated: Partial<NormalizedQuotationLine>,
  ) => {
    const next = [...lines];
    next[index] = { ...next[index], ...updated };
    setLines(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier.name.trim()) {
      setError("Supplier / Vendor name is required.");
      return;
    }
    if (lines.length === 0 || !lines[0].description) {
      setError("At least one valid line item is required.");
      return;
    }

    startTransition(async () => {
      setError(null);
      const res = await createManualQuotationAction({
        projectId,
        documentId,
        supplier,
        quotationNumber,
        quotationDate,
        lines,
        freight,
        installation,
        isInterstate,
      });

      if (res.success && res.quotation) {
        onSuccess(res.quotation);
      } else {
        setError(res.error || "Failed to save quotation.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="border-b border-slate-200 pb-3">
        <h3 className="text-base font-bold text-slate-900">
          Enter Quotation Details Manually
        </h3>
        <p className="text-xs text-slate-500">
          Capture supplier particulars, itemized machinery/equipment lines, GST
          rates, and commercial charges.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700">
          {error}
        </div>
      )}

      {/* Supplier Particulars */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-semibold text-slate-700">
            Supplier / Vendor Name *
          </label>
          <input
            type="text"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            placeholder="e.g. Paramount Agro Process Engineering Works"
            value={supplier.name}
            onChange={(e) => setSupplier({ ...supplier, name: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700">
            Supplier GSTIN
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm uppercase focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            placeholder="e.g. 27AAAAA0000A1Z5"
            value={supplier.gstin || ""}
            onChange={(e) =>
              setSupplier({ ...supplier, gstin: e.target.value })
            }
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700">
            Quotation Ref / Number
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            placeholder="e.g. QT-2026-108"
            value={quotationNumber}
            onChange={(e) => setQuotationNumber(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700">
            Quotation Date
          </label>
          <input
            type="date"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={quotationDate}
            onChange={(e) => setQuotationDate(e.target.value)}
          />
        </div>

        <div className="flex items-center space-x-2 pt-6">
          <input
            type="checkbox"
            id="is-interstate"
            checked={isInterstate}
            onChange={(e) => setIsInterstate(e.target.checked)}
            className="h-4 w-4 rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <label
            htmlFor="is-interstate"
            className="text-xs font-medium text-slate-700"
          >
            Inter-state Supply (Apply IGST instead of CGST/SGST)
          </label>
        </div>
      </div>

      {/* Itemized Lines */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold tracking-wider text-slate-700 uppercase">
            Quotation Line Items
          </h4>
          <button
            type="button"
            onClick={handleAddLine}
            className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
          >
            + Add Line Item
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase">
              <tr>
                <th className="px-3 py-2.5">Item Description</th>
                <th className="w-20 px-3 py-2.5 text-right">Qty</th>
                <th className="w-24 px-3 py-2.5 text-right">Unit</th>
                <th className="w-32 px-3 py-2.5 text-right">Unit Rate (₹)</th>
                <th className="w-24 px-3 py-2.5 text-right">GST (%)</th>
                <th className="w-32 px-3 py-2.5 text-right">Line Total (₹)</th>
                <th className="w-12 px-2 py-2.5 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line, idx) => {
                const calc = computeQuotationLineFinancials({
                  quantity: line.quantity || "1",
                  unitRate: line.unitRate || "0",
                  discount: line.discount,
                  gstRate: line.gstRate,
                  isInterstate,
                });

                return (
                  <tr key={line.lineId || idx} className="hover:bg-slate-50/50">
                    <td className="p-2">
                      <input
                        type="text"
                        required
                        className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                        placeholder="e.g. Honey Processing Vat 500L"
                        value={line.description || ""}
                        onChange={(e) =>
                          handleUpdateLine(idx, { description: e.target.value })
                        }
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-right font-mono text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                        value={line.quantity || "1"}
                        onChange={(e) =>
                          handleUpdateLine(idx, { quantity: e.target.value })
                        }
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-right text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                        placeholder="Nos"
                        value={line.unit || "Nos"}
                        onChange={(e) =>
                          handleUpdateLine(idx, { unit: e.target.value })
                        }
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-right font-mono text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                        value={line.unitRate || "0.00"}
                        onChange={(e) =>
                          handleUpdateLine(idx, { unitRate: e.target.value })
                        }
                      />
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
                      {formatIndianCurrency(calc.lineTotal)}
                    </td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        disabled={lines.length <= 1}
                        className="rounded-sm p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Additional Charges */}
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700">
            Freight & Transportation (₹)
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={freight}
            onChange={(e) => setFreight(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700">
            Installation & Commissioning (₹)
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={installation}
            onChange={(e) => setInstallation(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
        >
          {isPending ? "Saving Quotation..." : "Save & Proceed to Review →"}
        </button>
      </div>
    </form>
  );
}
