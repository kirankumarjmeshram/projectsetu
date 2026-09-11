import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

const topics = [
  [
    "1. Start a project",
    "Create a project and enter the real promoter, location, activity and purpose. Save supporting facts rather than estimates presented as facts.",
  ],
  [
    "2. Project cost and finance",
    "List fixed assets, equipment, setup costs and working-capital margin. Match the total with promoter contribution and proposed borrowing. A term loan normally finances fixed assets.",
  ],
  [
    "3. Operations and working capital",
    "Enter capacity, realistic utilisation, selling prices and expenses. Working capital covers inventory, receivables, wages and other day-to-day needs.",
  ],
  [
    "4. Loan and schemes",
    "Enter expected interest, repayment tenure and any moratorium from lender terms. Scheme screening is indicative; current authority rules and the lender's decision prevail.",
  ],
  [
    "5. Documents and quotations",
    "Upload supporting documents, review extracted quotations and map only approved lines. Applicant market statements are not independently verified by ProjectSetu.",
  ],
  [
    "6. Results",
    "DSCR measures debt-service capacity. Break-even estimates sales needed to cover costs. IRR, NPV and payback describe indicative project returns under the entered assumptions.",
  ],
  [
    "7. Validation",
    "Issue cards name the affected wizard tab. Select one to return to that step. Errors, warnings and missing information should be reviewed before submission.",
  ],
  [
    "8. Download the DPR",
    "Preview first. Advisory or incomplete information can be included through Download Anyway and will appear in the report notice. Accounting, persistence, authorization and rendering failures remain blocking.",
  ],
] as const;

export default async function GuidePage() {
  if (!(await getCurrentUser())) redirect("/login");
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-700">PROJECTSETU</p>
            <h1 className="text-3xl font-extrabold text-slate-900">
              User Guide
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-lg border bg-white px-4 py-2 text-sm font-bold"
          >
            Back to projects
          </Link>
        </div>
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-slate-700">
          ProjectSetu helps Indian entrepreneurs prepare structured financial
          projections and a reviewable DPR. It does not certify a project,
          guarantee a loan or confirm subsidy eligibility.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {topics.map(([title, text]) => (
            <section
              key={title}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <h2 className="font-bold text-slate-900">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
            </section>
          ))}
        </div>
        <p className="mt-6 text-sm text-slate-600">
          Before submitting a DPR, review every assumption, warning, quotation
          and schedule with your CA or project consultant and confirm current
          requirements with the bank or government authority.
        </p>
      </div>
    </main>
  );
}
