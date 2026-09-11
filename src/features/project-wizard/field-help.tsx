export const FIELD_HELP = {
  projectCapacity:
    "Maximum quantity the project can produce or serve during the selected period.",
  capacityUtilisation:
    "Percentage of installed capacity expected to be used. Enter your own realistic ramp-up estimate.",
  promoterContribution:
    "Amount invested by the owner or promoter from their own funds.",
  termLoan: "Long-term bank borrowing generally used to finance fixed assets.",
  workingCapital:
    "Funds required for day-to-day operations such as inventory, receivables, wages and expenses.",
  interestRate: "Annual interest rate expected on the proposed loan.",
  moratorium:
    "Initial period during which principal repayment may be deferred, subject to lender terms.",
  dscr: "Debt Service Coverage Ratio indicates the project's ability to meet principal and interest obligations.",
  breakEven:
    "Level of sales or capacity at which the project covers its costs.",
} as const;

export function FieldHelp({ topic }: { topic: keyof typeof FIELD_HELP }) {
  return (
    <details className="group relative ml-1 inline-block align-middle">
      <summary
        aria-label={`Help: ${topic}`}
        className="cursor-help list-none rounded-full text-emerald-700 focus:ring-2 focus:ring-emerald-500"
      >
        ⓘ
      </summary>
      <span
        role="tooltip"
        className="absolute left-0 z-30 mt-1 hidden w-64 rounded-lg bg-slate-900 p-2 text-xs font-normal text-white shadow-lg group-open:block group-focus-within:block group-hover:block"
      >
        {FIELD_HELP[topic]}
      </span>
    </details>
  );
}
