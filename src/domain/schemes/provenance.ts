import type { Identifier, ISODate, ISODateTime } from "../shared/types";

export const ruleSourceTypes = [
  "OFFICIAL_GUIDELINE",
  "OFFICIAL_NOTIFICATION",
  "OFFICIAL_PORTAL",
  "OFFICIAL_SOP",
  "OFFICIAL_CIRCULAR",
  "STATE_GR",
  "BANK_CIRCULAR",
  "MANUAL_VERIFIED_RULE",
  "CUSTOM_RULE",
] as const;
export type RuleSourceType = (typeof ruleSourceTypes)[number];

/** Audit metadata for a versioned rule. URLs are intentionally optional. */
export interface RuleSourceReference {
  readonly sourceId: Identifier;
  readonly authority: string;
  readonly documentTitle: string;
  readonly sourceType: RuleSourceType;
  readonly sourceUrl?: string;
  readonly documentVersion?: string;
  readonly publicationDate?: ISODate;
  readonly effectiveDate?: ISODate;
  readonly retrievedAt?: ISODateTime;
  readonly pageOrReference?: string;
  readonly notes?: string;
}
