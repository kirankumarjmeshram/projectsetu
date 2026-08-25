import React from "react";

import type { LoanAssumptionsInput } from "@/lib/application/orchestrator/orchestrator-types";

interface Step7LoanTermsProps {
  value: LoanAssumptionsInput;
  onChange: (value: LoanAssumptionsInput) => void;
}

export function Step7LoanTerms({ value, onChange }: Step7LoanTermsProps) {
  const handleMoratoriumTypeChange = (
    type: "PRINCIPAL_ONLY" | "FULL_PAYMENT",
  ) => {
    onChange({
      ...value,
      moratoriumType: type,
      moratoriumInterestTreatment:
        type === "PRINCIPAL_ONLY" ? "PAY_CURRENT" : "CAPITALIZE",
    });
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h3 className="text-base font-bold text-slate-900">
          Bank Loan Terms & Repayment Schedule
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Configure commercial debt parameters, amortisation method, repayment
          frequency, and moratorium terms.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Loan Facility Type *
          </label>
          <select
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.loanType}
            onChange={(e) =>
              onChange({
                ...value,
                loanType: e.target.value as LoanAssumptionsInput["loanType"],
              })
            }
          >
            <option value="TERM_LOAN">Term Loan (Fixed Asset Financing)</option>
            <option value="WORKING_CAPITAL_DEMAND_LOAN">
              Working Capital Demand Loan (WCDL)
            </option>
            <option value="COMPOSITE_LOAN">
              Composite Loan (Asset + Working Capital)
            </option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Total Sanctioned Principal (₹) *
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.principalAmount}
            onChange={(e) =>
              onChange({ ...value, principalAmount: e.target.value })
            }
            placeholder="e.g. 1875000"
          />
          <p className="text-[11px] text-slate-500">
            Total institutional borrowing amount
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Annual Interest Rate (%) *
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.annualInterestRate}
            onChange={(e) =>
              onChange({ ...value, annualInterestRate: e.target.value })
            }
            placeholder="e.g. 9.50"
          />
          <p className="text-[11px] text-slate-500">
            Commercial lending rate per annum
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Repayment Method (Amortisation Structure) *
          </label>
          <select
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.repaymentMethod}
            onChange={(e) =>
              onChange({
                ...value,
                repaymentMethod: e.target
                  .value as LoanAssumptionsInput["repaymentMethod"],
              })
            }
          >
            <option value="EMI">
              Equated Periodic Installment (EMI — Constant Periodic Total
              Payment)
            </option>
            <option value="EQUAL_PRINCIPAL">
              Equal Principal Repayments (Constant Principal, Reducing Balance
              Interest)
            </option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Repayment Frequency *
          </label>
          <select
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.repaymentFrequency}
            onChange={(e) =>
              onChange({
                ...value,
                repaymentFrequency: e.target
                  .value as LoanAssumptionsInput["repaymentFrequency"],
              })
            }
          >
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="HALF_YEARLY">Half-Yearly</option>
            <option value="YEARLY">Yearly</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Repayment Tenure (Years) *
          </label>
          <input
            type="number"
            min={1}
            max={20}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.repaymentTenureYears}
            onChange={(e) =>
              onChange({
                ...value,
                repaymentTenureYears: Number.parseInt(e.target.value) || 5,
              })
            }
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Moratorium / Grace Periods (Periods Count)
          </label>
          <input
            type="number"
            min={0}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            value={value.moratoriumPeriods || 0}
            onChange={(e) =>
              onChange({
                ...value,
                moratoriumPeriods: Number.parseInt(e.target.value) || 0,
              })
            }
          />
          <p className="text-[11px] text-slate-500">
            Number of schedule periods before principal amortisation begins
          </p>
        </div>

        {value.moratoriumPeriods && value.moratoriumPeriods > 0 ? (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Moratorium Type
              </label>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                value={value.moratoriumType || "PRINCIPAL_ONLY"}
                onChange={(e) =>
                  handleMoratoriumTypeChange(
                    e.target.value as "PRINCIPAL_ONLY" | "FULL_PAYMENT",
                  )
                }
              >
                <option value="PRINCIPAL_ONLY">
                  Principal Moratorium (Interest serviced as incurred)
                </option>
                <option value="FULL_PAYMENT">
                  Full Payment Holiday (Principal + Interest deferred)
                </option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Moratorium Interest Treatment
              </label>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                value={
                  value.moratoriumInterestTreatment ||
                  (value.moratoriumType === "FULL_PAYMENT"
                    ? "CAPITALIZE"
                    : "PAY_CURRENT")
                }
                onChange={(e) =>
                  onChange({
                    ...value,
                    moratoriumInterestTreatment: e.target
                      .value as LoanAssumptionsInput["moratoriumInterestTreatment"],
                  })
                }
              >
                {value.moratoriumType === "FULL_PAYMENT" ? (
                  <>
                    <option value="CAPITALIZE">
                      Capitalize (Add accrued interest to loan principal)
                    </option>
                    <option value="ACCRUE">
                      Accrue (Accumulate interest separately without
                      compounding)
                    </option>
                  </>
                ) : (
                  <option value="PAY_CURRENT">
                    Pay Current (Service interest as incurred)
                  </option>
                )}
              </select>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
