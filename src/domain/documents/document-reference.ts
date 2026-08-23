import type { Identifier } from "../shared/types";

export const documentKinds = [
  "QUOTATION",
  "LAND_RECORD",
  "SCHEME_GUIDELINE",
  "REGISTRATION",
  "ESTIMATE",
  "OTHER",
] as const;

export type DocumentKind = (typeof documentKinds)[number];

/**
 * References a document managed by infrastructure. Domain models never contain
 * binary content, storage paths, public URLs, or provider-specific metadata.
 */
export interface DocumentReference {
  readonly id: Identifier;
  readonly kind: DocumentKind;
  readonly displayName?: string;
  readonly version?: string;
}

export interface QuotationReference {
  readonly documentReferenceId: Identifier;
  readonly quotationReference?: string;
  readonly supplierReferenceId?: Identifier;
}
