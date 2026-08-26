import type {
  ProjectCalculationResult,
  ProjectWizardInput,
} from "@/lib/application/orchestrator/orchestrator-types";

export const DPR_TEMPLATE_VERSION = "BASE_BANKABLE_DPR/1.0";
export const DPR_CONTENT_SCHEMA_VERSION = 1;

export type ReportStatus =
  | "DRAFT"
  | "GENERATING"
  | "REVIEW_REQUIRED"
  | "READY"
  | "FAILED"
  | "SUPERSEDED";

export type ReportCellKind =
  "TEXT" | "MONEY" | "PERCENT" | "RATIO" | "INTEGER" | "STATUS";

export interface ReportCell {
  readonly kind: ReportCellKind;
  readonly displayValue: string;
  /** Exact snapshot value. Never presentation-rounded. */
  readonly authoritativeValue?: string;
  readonly sourcePath?: string;
}

export interface ReportTable {
  readonly id: string;
  readonly title: string;
  readonly columns: readonly string[];
  readonly rows: readonly (readonly ReportCell[])[];
  readonly notes?: readonly string[];
}

export interface ReportNarrative {
  readonly text: string;
  readonly provenance: "DETERMINISTIC" | "AI_VALIDATED" | "USER_APPROVED";
  readonly approved: boolean;
}

export interface DprSection {
  readonly id: string;
  readonly title: string;
  readonly order: number;
  readonly narrative?: ReportNarrative;
  readonly tables: readonly ReportTable[];
  readonly pageBreakBefore?: boolean;
}

export interface ReportSourceReference {
  readonly kind:
    | "USER_ASSUMPTION"
    | "CALCULATION_SNAPSHOT"
    | "FUNDING_SNAPSHOT"
    | "PROGRAM_RULE"
    | "APPROVED_QUOTATION";
  readonly label: string;
  readonly referenceId?: string;
  readonly details?: string;
}

export interface QuotationReportReference {
  readonly projectCostItemId: string;
  readonly documentId: string;
  readonly documentVersion: string;
  readonly supplierName?: string;
  readonly quotationNumber?: string;
  readonly lineDescription: string;
  readonly approved: true;
  readonly mapped: true;
}

export interface DprReportIdentity {
  readonly reportId: string;
  readonly reportVersion: number;
  readonly projectId: string;
  readonly inputSnapshotId: string;
  readonly calculationRunId: string;
  readonly fundingSnapshotId?: string;
  readonly templateVersion: string;
  readonly contentSchemaVersion: number;
  readonly generatedAt: string;
  readonly language: "en";
}

export interface DprReportModel {
  readonly identity: DprReportIdentity;
  readonly title: string;
  readonly filenameStem: string;
  readonly project: ProjectWizardInput;
  /** Copied, authoritative engine output. Renderers must not mutate or calculate it. */
  readonly calculation: ProjectCalculationResult;
  readonly sections: readonly DprSection[];
  readonly sources: readonly ReportSourceReference[];
  readonly quotationReferences: readonly QuotationReportReference[];
  readonly disclaimer: readonly string[];
}

export type ReportValidationSeverity =
  "BLOCKING" | "WARNING" | "INFORMATION" | "MANUAL_REVIEW";

export interface ReportValidationIssue {
  readonly code: string;
  readonly severity: ReportValidationSeverity;
  readonly message: string;
  readonly sectionId?: string;
}

export interface ReportValidationResult {
  readonly validForExport: boolean;
  readonly issues: readonly ReportValidationIssue[];
}

export interface NarrativeOverrides {
  readonly [sectionId: string]: {
    readonly text: string;
    readonly approved: boolean;
  };
}

export interface BuildDprReportInput {
  readonly identity: DprReportIdentity;
  readonly project: ProjectWizardInput;
  readonly calculation: ProjectCalculationResult;
  readonly quotationReferences?: readonly QuotationReportReference[];
  readonly narrativeOverrides?: NarrativeOverrides;
}

export interface RenderedReportArtifact {
  readonly format: "PDF" | "DOCX" | "XLSX";
  readonly filename: string;
  readonly mimeType: string;
  readonly content: Buffer;
}
