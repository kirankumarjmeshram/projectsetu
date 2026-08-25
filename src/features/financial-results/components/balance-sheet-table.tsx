import type { BalanceSheetSchedule } from "@/domain/balance-sheet/balance-sheet";
import {
  formatIndianCurrency,
  isDecimalZero,
  sumDecimalStrings,
} from "@/lib/application/formatters";

interface BalanceSheetTableProps {
  balanceSheet: BalanceSheetSchedule;
}

export function BalanceSheetTable({ balanceSheet }: BalanceSheetTableProps) {
  const years = balanceSheet.years;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
              <th className="px-4 py-3">Balance Sheet Particulars (₹)</th>
              {years.map((y) => (
                <th key={y.year} className="px-4 py-3 text-right">
                  Year {y.year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {/* ASSETS */}
            <tr className="bg-slate-50/70 font-semibold text-slate-900">
              <td
                colSpan={years.length + 1}
                className="px-4 py-2 text-[10px] tracking-wider text-slate-500 uppercase"
              >
                I. Assets & Applications of Funds
              </td>
            </tr>
            <tr className="hover:bg-slate-50/40">
              <td className="px-4 py-2 pl-6 text-slate-700">
                Net Fixed Assets (Gross less Acc. Depn)
              </td>
              {years.map((y) => (
                <td
                  key={y.year}
                  className="px-4 py-2 text-right font-medium tabular-nums"
                >
                  {formatIndianCurrency(y.netFixedAssets)}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-slate-50/40">
              <td className="px-4 py-2 pl-6 text-slate-700">
                Inventory (Raw Materials + Finished Goods)
              </td>
              {years.map((y) => (
                <td key={y.year} className="px-4 py-2 text-right tabular-nums">
                  {formatIndianCurrency(y.inventory)}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-slate-50/40">
              <td className="px-4 py-2 pl-6 text-slate-700">
                Receivables / Sundry Debtors
              </td>
              {years.map((y) => (
                <td key={y.year} className="px-4 py-2 text-right tabular-nums">
                  {formatIndianCurrency(y.receivables)}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-slate-50/40">
              <td className="px-4 py-2 pl-6 text-slate-700">
                Cash & Bank Balances
              </td>
              {years.map((y) => (
                <td
                  key={y.year}
                  className="px-4 py-2 text-right font-medium tabular-nums"
                >
                  {formatIndianCurrency(y.cashAndBank)}
                </td>
              ))}
            </tr>
            <tr className="border-t-2 border-slate-300 bg-slate-100/80 font-bold text-slate-950">
              <td className="px-4 py-2.5 text-sm">Total Assets</td>
              {years.map((y) => (
                <td
                  key={y.year}
                  className="px-4 py-2.5 text-right text-sm font-bold text-slate-950 tabular-nums"
                >
                  {formatIndianCurrency(y.totalAssets)}
                </td>
              ))}
            </tr>

            {/* LIABILITIES & EQUITY */}
            <tr className="bg-slate-50/70 font-semibold text-slate-900">
              <td
                colSpan={years.length + 1}
                className="px-4 py-2 text-[10px] tracking-wider text-slate-500 uppercase"
              >
                II. Liabilities & Equity (Sources of Funds)
              </td>
            </tr>
            <tr className="hover:bg-slate-50/40">
              <td className="px-4 py-2 pl-6 text-slate-700">
                Promoter / Share Capital
              </td>
              {years.map((y) => (
                <td key={y.year} className="px-4 py-2 text-right tabular-nums">
                  {formatIndianCurrency(y.promoterCapital)}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-slate-50/40">
              <td className="px-4 py-2 pl-6 text-slate-700">
                Retained Earnings (Closing Reserves)
              </td>
              {years.map((y) => (
                <td key={y.year} className="px-4 py-2 text-right tabular-nums">
                  {formatIndianCurrency(y.closingRetainedEarnings)}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-slate-50/40">
              <td className="px-4 py-2 pl-6 text-slate-700">
                Long-Term Bank Term Loan
              </td>
              {years.map((y) => (
                <td key={y.year} className="px-4 py-2 text-right tabular-nums">
                  {formatIndianCurrency(y.longTermLoanOutstanding)}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-slate-50/40">
              <td className="px-4 py-2 pl-6 text-slate-700">
                Current Debt / Short-Term Borrowings
              </td>
              {years.map((y) => (
                <td key={y.year} className="px-4 py-2 text-right tabular-nums">
                  {formatIndianCurrency(y.currentDebt)}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-slate-50/40">
              <td className="px-4 py-2 pl-6 text-slate-700">
                Trade Payables / Creditors
              </td>
              {years.map((y) => (
                <td key={y.year} className="px-4 py-2 text-right tabular-nums">
                  {formatIndianCurrency(y.payables)}
                </td>
              ))}
            </tr>
            <tr className="border-t-2 border-slate-300 bg-slate-100/80 font-bold text-slate-950">
              <td className="px-4 py-2.5 text-sm">
                Total Liabilities & Equity
              </td>
              {years.map((y) => (
                <td
                  key={y.year}
                  className="px-4 py-2.5 text-right text-sm font-bold text-slate-950 tabular-nums"
                >
                  {formatIndianCurrency(
                    sumDecimalStrings([y.totalLiabilities, y.totalEquity]),
                  )}
                </td>
              ))}
            </tr>

            {/* Balancing Row */}
            <tr className="border-t border-slate-200 bg-slate-50 text-xs">
              <td className="px-4 py-2 font-medium text-slate-600">
                Balance Check (Assets - Liab&Eq)
              </td>
              {years.map((y) => {
                const isZero = isDecimalZero(y.balanceDifference);
                return (
                  <td
                    key={y.year}
                    className="px-4 py-2 text-right tabular-nums"
                  >
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        isZero
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {isZero
                        ? "Balanced"
                        : `Diff: ${formatIndianCurrency(y.balanceDifference)}`}
                    </span>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
