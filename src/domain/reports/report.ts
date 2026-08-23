import type { DocumentReference } from "../documents/document-reference";
import type { SourceReference } from "../shared/provenance";
import type { Identifier, ISODateTime } from "../shared/types";

export const reportTypes = ["SELF_FUNDED", "BANKABLE", "SUBSIDY"] as const;
export type ReportType = (typeof reportTypes)[number];

export interface ReportSectionSelection {
  readonly sectionCode: string;
  readonly included: boolean;
  readonly order?: number;
}

export interface ReportDefinition {
  readonly id: Identifier;
  readonly projectId: Identifier;
  readonly type: ReportType;
  readonly templateReference?: string;
  readonly sections: readonly ReportSectionSelection[];
  readonly sourceReferences?: readonly SourceReference[];
}

export interface GeneratedReportReference {
  readonly reportDefinitionId: Identifier;
  readonly generatedAt: ISODateTime;
  readonly document: DocumentReference;
}
