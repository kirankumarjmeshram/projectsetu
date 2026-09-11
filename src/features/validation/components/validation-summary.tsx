import {
  mapIssueToWizard,
  type MappableIssue,
} from "@/lib/validation/wizard-issues";

export function ValidationSummary({
  issues,
  onNavigate,
}: {
  issues: readonly MappableIssue[];
  onNavigate?: (step: number) => void;
}) {
  if (!issues.length) return null;
  return (
    <ul className="space-y-2" aria-label="Validation issues">
      {issues.map((issue, index) => {
        const mapped = mapIssueToWizard(issue);
        return (
          <li key={`${issue.code}-${index}`}>
            <button
              type="button"
              onClick={() => onNavigate?.(mapped.step)}
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left text-xs hover:border-emerald-500"
            >
              <span className="font-bold">{mapped.kind.replace("_", " ")}</span>
              {`: ${mapped.stepName} → ${mapped.field}: ${mapped.message}`}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
