export type ValidationKind = "ERROR" | "WARNING" | "MISSING_INFORMATION";

export interface MappableIssue {
  readonly code: string;
  readonly severity: string;
  readonly message: string;
  readonly path?: string;
  readonly section?: string;
  readonly sectionId?: string;
}

export interface WizardValidationIssue extends MappableIssue {
  readonly kind: ValidationKind;
  readonly step: number;
  readonly stepName: string;
  readonly field: string;
}

const steps = [
  [1, "Project Overview", /project|address|location/i],
  [2, "Promoter Profile", /applicant|promoter/i],
  [3, "Project Cost", /project.?cost|costItems|asset|depreciation/i],
  [4, "Financing", /financ|means.of.finance|contribution/i],
  [5, "Operations", /revenue|product|capacity|expense|market|operation/i],
  [6, "Working Capital", /working.?capital|receivable|creditor|inventory/i],
  [7, "Loan", /loan|interest|repayment|moratorium|debt/i],
  [8, "Schemes", /scheme|funding|program|eligib/i],
  [9, "Review & Calculate", /tax|discount/i],
] as const;

export function mapIssueToWizard(issue: MappableIssue): WizardValidationIssue {
  const haystack = [issue.path, issue.section, issue.sectionId, issue.code]
    .filter(Boolean)
    .join(" ");
  const match = steps.find(([, , pattern]) => pattern.test(haystack));
  const missing = /missing|required|empty|unknown|unresolved/i.test(
    `${issue.code} ${issue.message}`,
  );
  return {
    ...issue,
    kind: missing
      ? "MISSING_INFORMATION"
      : issue.severity === "ERROR" || issue.severity === "BLOCKING"
        ? "ERROR"
        : "WARNING",
    step: match?.[0] ?? 10,
    stepName: match?.[1] ?? "Report / Calculation",
    field:
      issue.path ?? issue.section ?? issue.sectionId ?? "Report / Calculation",
  };
}

export function countIssuesByStep(issues: readonly MappableIssue[]) {
  return issues.reduce<Record<number, number>>((counts, issue) => {
    const step = mapIssueToWizard(issue).step;
    counts[step] = (counts[step] ?? 0) + 1;
    return counts;
  }, {});
}
