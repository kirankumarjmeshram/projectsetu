import React from "react";

import { generateId } from "@/lib/persistence/id";
import type {
  OperatingExpenseInput,
  RevenueProductInput,
} from "@/lib/application/orchestrator/orchestrator-types";

interface Step5OperationsRevenueProps {
  revenueProducts: readonly RevenueProductInput[];
  operatingExpenses: readonly OperatingExpenseInput[];
  onRevenueChange: (products: readonly RevenueProductInput[]) => void;
  onExpenseChange: (expenses: readonly OperatingExpenseInput[]) => void;
}

const OPEX_CATEGORIES = [
  { label: "Raw Materials & Direct Consumables", value: "RAW_MATERIALS" },
  { label: "Direct Factory Wages & Labor", value: "WAGES" },
  { label: "Power, Electricity & Fuel", value: "POWER_AND_ELECTRICITY" },
  { label: "Administrative Salaries & Staff", value: "SALARIES" },
  { label: "Plant Repairs & Maintenance", value: "REPAIRS_AND_MAINTENANCE" },
  { label: "Marketing, Selling & Distribution", value: "SELLING_EXPENSES" },
  {
    label: "Administrative Overheads & Misc",
    value: "ADMINISTRATIVE_EXPENSES",
  },
  { label: "Rent & Factory Lease", value: "RENT" },
  { label: "Insurance", value: "INSURANCE" },
];

export function Step5OperationsRevenue({
  revenueProducts,
  operatingExpenses,
  onRevenueChange,
  onExpenseChange,
}: Step5OperationsRevenueProps) {
  // Products handlers
  const handleAddProduct = () => {
    onRevenueChange([
      ...revenueProducts,
      {
        id: generateId(),
        name: "New Product / Service Line",
        unit: "Units",
        quantityYear1: "1000",
        unitPriceYear1: "100.00",
        capacityUtilisationYear1: "60",
        annualQuantityGrowth: "10",
        annualPriceEscalation: "3",
      },
    ]);
  };

  const handleUpdateProduct = (
    id: string,
    updated: Partial<RevenueProductInput>,
  ) => {
    onRevenueChange(
      revenueProducts.map((p) => (p.id === id ? { ...p, ...updated } : p)),
    );
  };

  const handleRemoveProduct = (id: string) => {
    onRevenueChange(revenueProducts.filter((p) => p.id !== id));
  };

  // Expense handlers
  const handleAddExpense = () => {
    onExpenseChange([
      ...operatingExpenses,
      {
        id: generateId(),
        name: "New Operating Expense Line",
        category: "RAW_MATERIALS",
        calculationMethod: "PERCENTAGE_OF_REVENUE",
        costBehavior: "VARIABLE",
        percentageOfRevenueYear1: "10",
        annualEscalation: "0",
      },
    ]);
  };

  const handleUpdateExpense = (
    id: string,
    updated: Partial<OperatingExpenseInput>,
  ) => {
    onExpenseChange(
      operatingExpenses.map((e) => (e.id === id ? { ...e, ...updated } : e)),
    );
  };

  const handleRemoveExpense = (id: string) => {
    onExpenseChange(operatingExpenses.filter((e) => e.id !== id));
  };

  return (
    <div className="space-y-8">
      {/* SECTION 1: Revenue Products */}
      <div className="space-y-4">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Step 5: Revenue & Operating Expenses
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              A. Revenue Projections: Add products/services with Year 1
              quantity, price, capacity utilisation, and growth rates.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddProduct}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-800"
          >
            + Add Product Line
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                <th className="px-3 py-3">Product Name</th>
                <th className="w-20 px-3 py-3">Unit</th>
                <th className="px-3 py-3 text-right">Capacity (Y1)</th>
                <th className="px-3 py-3 text-right">Unit Price (₹)</th>
                <th className="px-3 py-3 text-right">Utilisation %</th>
                <th className="px-3 py-3 text-right">Growth %</th>
                <th className="w-12 px-3 py-3 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {revenueProducts.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50">
                  <td className="p-2">
                    <input
                      type="text"
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs focus:ring-1 focus:ring-emerald-500"
                      value={p.name}
                      onChange={(e) =>
                        handleUpdateProduct(p.id, { name: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs focus:ring-1 focus:ring-emerald-500"
                      value={p.unit}
                      onChange={(e) =>
                        handleUpdateProduct(p.id, { unit: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-2 text-right">
                    <input
                      type="text"
                      className="inline-block w-24 rounded-md border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs focus:ring-1 focus:ring-emerald-500"
                      value={p.quantityYear1}
                      onChange={(e) =>
                        handleUpdateProduct(p.id, {
                          quantityYear1: e.target.value,
                        })
                      }
                    />
                  </td>
                  <td className="p-2 text-right">
                    <input
                      type="text"
                      className="inline-block w-24 rounded-md border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs focus:ring-1 focus:ring-emerald-500"
                      value={p.unitPriceYear1}
                      onChange={(e) =>
                        handleUpdateProduct(p.id, {
                          unitPriceYear1: e.target.value,
                        })
                      }
                    />
                  </td>
                  <td className="p-2 text-right">
                    <input
                      type="text"
                      className="inline-block w-16 rounded-md border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs focus:ring-1 focus:ring-emerald-500"
                      value={p.capacityUtilisationYear1}
                      onChange={(e) =>
                        handleUpdateProduct(p.id, {
                          capacityUtilisationYear1: e.target.value,
                        })
                      }
                    />
                  </td>
                  <td className="p-2 text-right">
                    <input
                      type="text"
                      className="inline-block w-16 rounded-md border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs focus:ring-1 focus:ring-emerald-500"
                      value={p.annualQuantityGrowth}
                      onChange={(e) =>
                        handleUpdateProduct(p.id, {
                          annualQuantityGrowth: e.target.value,
                        })
                      }
                    />
                  </td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveProduct(p.id)}
                      className="px-1 font-bold text-slate-400 transition-colors hover:text-rose-600"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: Operating Expenses */}
      <div className="space-y-4 border-t border-slate-200 pt-4">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h4 className="text-sm font-bold text-slate-800">
              B. Operating Expenses & Cost Structure
            </h4>
            <p className="text-xs text-slate-500">
              Define raw material costs (% of revenue or fixed annual),
              utilities, salaries, and administration.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddExpense}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-900"
          >
            + Add Expense Line
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                <th className="px-3 py-3">Expense Name</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">Method</th>
                <th className="px-3 py-3">Behavior</th>
                <th className="px-3 py-3 text-right">Value (₹ / %)</th>
                <th className="w-12 px-3 py-3 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {operatingExpenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-50/50">
                  <td className="p-2">
                    <input
                      type="text"
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs focus:ring-1 focus:ring-emerald-500"
                      value={exp.name}
                      onChange={(e) =>
                        handleUpdateExpense(exp.id, { name: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <select
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs focus:ring-1 focus:ring-emerald-500"
                      value={exp.category}
                      onChange={(e) =>
                        handleUpdateExpense(exp.id, {
                          category: e.target
                            .value as OperatingExpenseInput["category"],
                        })
                      }
                    >
                      {OPEX_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <select
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs focus:ring-1 focus:ring-emerald-500"
                      value={exp.calculationMethod}
                      onChange={(e) =>
                        handleUpdateExpense(exp.id, {
                          calculationMethod: e.target
                            .value as OperatingExpenseInput["calculationMethod"],
                        })
                      }
                    >
                      <option value="PERCENTAGE_OF_REVENUE">
                        % of Gross Revenue
                      </option>
                      <option value="FIXED_ANNUAL_AMOUNT">
                        Fixed Annual Amount (₹)
                      </option>
                    </select>
                  </td>
                  <td className="p-2">
                    <select
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs focus:ring-1 focus:ring-emerald-500"
                      value={exp.costBehavior}
                      onChange={(e) =>
                        handleUpdateExpense(exp.id, {
                          costBehavior: e.target
                            .value as OperatingExpenseInput["costBehavior"],
                        })
                      }
                    >
                      <option value="VARIABLE">Variable</option>
                      <option value="FIXED">Fixed</option>
                      <option value="SEMI_VARIABLE">Semi-Variable</option>
                    </select>
                  </td>
                  <td className="p-2 text-right">
                    <input
                      type="text"
                      className="inline-block w-28 rounded-md border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs focus:ring-1 focus:ring-emerald-500"
                      value={
                        exp.calculationMethod === "PERCENTAGE_OF_REVENUE"
                          ? exp.percentageOfRevenueYear1 || ""
                          : exp.annualAmountYear1 || ""
                      }
                      placeholder={
                        exp.calculationMethod === "PERCENTAGE_OF_REVENUE"
                          ? "e.g. 50%"
                          : "e.g. 240000"
                      }
                      onChange={(e) => {
                        if (exp.calculationMethod === "PERCENTAGE_OF_REVENUE") {
                          handleUpdateExpense(exp.id, {
                            percentageOfRevenueYear1: e.target.value,
                          });
                        } else {
                          handleUpdateExpense(exp.id, {
                            annualAmountYear1: e.target.value,
                          });
                        }
                      }}
                    />
                  </td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveExpense(exp.id)}
                      className="px-1 font-bold text-slate-400 transition-colors hover:text-rose-600"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
