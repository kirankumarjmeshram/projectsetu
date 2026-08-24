import type { SourceReference } from "../shared/provenance";
import type { Identifier, ISODate } from "../shared/types";

export const schemeVersionStatuses = [
  "DRAFT",
  "ACTIVE",
  "SUPERSEDED",
  "RETIRED",
  "SUSPENDED",
  "ARCHIVED",
] as const;
export type SchemeVersionStatus = (typeof schemeVersionStatuses)[number];

export interface SchemeSource {
  readonly id: Identifier;
  readonly schemeVersionId: Identifier;
  readonly reference: SourceReference;
  readonly isPrimary: boolean;
}

export interface Scheme {
  readonly id: Identifier;
  readonly code: string;
  readonly name: string;
  readonly description?: string;
}

export interface SchemeVersion {
  readonly id: Identifier;
  readonly schemeId: Identifier;
  readonly schemeCode: string;
  readonly schemeName: string;
  readonly versionIdentifier: string;
  readonly effectiveFrom: ISODate;
  readonly effectiveUntil?: ISODate;
  readonly implementingMinistryOrDepartment?: string;
  readonly implementingAgency?: string;
  readonly sources: readonly SchemeSource[];
  readonly lastVerifiedDate?: ISODate;
  readonly status: SchemeVersionStatus;
  readonly conditions?: readonly string[];
}

export interface ProjectSchemeParticipation {
  readonly projectId: Identifier;
  readonly schemeVersionId: Identifier;
  readonly status:
    "PROPOSED" | "APPLIED" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  readonly applicationReferenceId?: Identifier;
}

export function isSchemeVersionStatus(
  value: string,
): value is SchemeVersionStatus {
  return schemeVersionStatuses.some((status) => status === value);
}
