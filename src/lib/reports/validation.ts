import type {
  DprReportModel,
  ReportValidationIssue,
  ReportValidationResult,
} from "./contracts";

export function validateDprReport(
  model: DprReportModel,
): ReportValidationResult {
  const issues: ReportValidationIssue[] = [];
  const required = [
    "executive-summary",
    "project-cost",
    "means-of-finance",
    "profit-loss",
    "cash-flow",
    "balance-sheet",
    "sources",
  ];
  if (
    !model.identity.projectId ||
    !model.identity.inputSnapshotId ||
    !model.identity.calculationRunId
  ) {
    issues.push({
      code: "MISSING_REPORT_IDENTITY",
      severity: "BLOCKING",
      message:
        "Project, input snapshot and calculation run references are required.",
    });
  }
  if (
    model.calculation.projectId !== model.identity.projectId ||
    model.project.project.id !== model.identity.projectId
  ) {
    issues.push({
      code: "SNAPSHOT_PROJECT_MISMATCH",
      severity: "BLOCKING",
      message: "The report, input and calculation projects do not match.",
    });
  }
  for (const id of required) {
    if (!model.sections.some((section) => section.id === id))
      issues.push({
        code: "MISSING_CRITICAL_SECTION",
        severity: "BLOCKING",
        message: `Required section '${id}' is missing.`,
        sectionId: id,
      });
  }
  for (const row of model.calculation.balanceSheet?.years ?? []) {
    if (!row.isBalanced)
      issues.push({
        code: "UNBALANCED_BALANCE_SHEET",
        severity: "WARNING",
        message: `Year ${row.year} balance sheet is not balanced.`,
        sectionId: "balance-sheet",
      });
  }
  const funding = model.calculation.fundingComposer;
  if (
    funding?.resolutionStatus === "MANUAL_REVIEW_REQUIRED" ||
    funding?.resolutionStatus === "UNRESOLVED"
  ) {
    issues.push({
      code: "FUNDING_MANUAL_REVIEW",
      severity: "MANUAL_REVIEW",
      message:
        "Program compatibility or funding composition requires manual review.",
      sectionId: "funding-composition",
    });
  }
  const irr = model.calculation.investmentReturns?.internalRateOfReturn.irr;
  if (irr && irr.status !== "DEFINED")
    issues.push({
      code: "UNDEFINED_IRR",
      severity: "INFORMATION",
      message: `IRR is ${irr.status.replaceAll("_", " ").toLowerCase()}.`,
      sectionId: "investment-returns",
    });
  for (const quotation of model.quotationReferences) {
    if (!quotation.approved || !quotation.mapped)
      issues.push({
        code: "UNAPPROVED_QUOTATION",
        severity: "BLOCKING",
        message:
          "Only approved and mapped quotation provenance may enter a DPR.",
      });
  }
  if (
    model.project.selectedPrograms.length > 0 &&
    !model.identity.fundingSnapshotId
  ) {
    issues.push({
      code: "MISSING_FUNDING_SNAPSHOT",
      severity: "BLOCKING",
      message: "A scheme report requires its exact funding snapshot reference.",
    });
  }
  if (model.project.selectedPrograms.length === 0)
    issues.push({
      code: "BANKABLE_NO_SCHEME",
      severity: "INFORMATION",
      message:
        "A complete bankable report is being generated without a scheme section.",
    });
  for (const issue of model.calculation.issues) {
    if (issue.severity === "MANUAL_REVIEW")
      issues.push({
        code: issue.code,
        severity: "MANUAL_REVIEW",
        message: issue.message,
        sectionId: issue.section,
      });
  }
  return {
    validForExport: !issues.some((issue) => issue.severity === "BLOCKING"),
    issues,
  };
}
