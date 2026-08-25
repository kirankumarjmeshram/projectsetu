export const DOCUMENT_KINDS = [
  "QUOTATION",
  "INVOICE",
  "PROFORMA_INVOICE",
  "PROJECT_REPORT",
  "BANK_DOCUMENT",
  "LAND_DOCUMENT",
  "IDENTITY_DOCUMENT",
  "REGISTRATION_DOCUMENT",
  "LICENSE",
  "CERTIFICATE",
  "SCHEME_DOCUMENT",
  "FINANCIAL_STATEMENT",
  "OTHER",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_STATUSES = [
  "UPLOADED",
  "PROCESSING",
  "EXTRACTED",
  "REVIEW_REQUIRED",
  "APPROVED",
  "REJECTED",
  "FAILED",
  "SUPERSEDED",
  "ARCHIVED",
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export interface DocumentDescriptor {
  readonly kind: DocumentKind;
  readonly label: string;
  readonly description: string;
  readonly allowedMimeTypes: readonly string[];
  readonly maxSizeBytes: number;
}

export interface StoragePutResult {
  readonly storageKey: string;
  readonly checksumSha256: string;
  readonly sizeBytes: string;
  readonly mimeType: string;
}

export interface StorageGetResult {
  readonly storageKey: string;
  readonly content: Buffer;
  readonly mimeType?: string;
}

export interface DocumentMetadataRecord {
  readonly id: string;
  readonly projectId: string;
  readonly kind: DocumentKind;
  readonly displayName?: string | null;
  readonly originalFilename?: string | null;
  readonly storageKey?: string | null;
  readonly mimeType?: string | null;
  readonly sizeBytes?: string | null;
  readonly checksumSha256?: string | null;
  readonly version?: string | null;
  readonly status: DocumentStatus;
  readonly supersededById?: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
