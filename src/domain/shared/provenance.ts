import type { Identifier, ISODate } from "./types";

export const sourceTypes = [
  "OFFICIAL_GUIDELINE",
  "QUOTATION",
  "USER_INPUT",
  "ESTIMATE",
  "CONSULTANT_ASSUMPTION",
  "HISTORICAL_DATA",
  "SYSTEM_CALCULATION",
  "OTHER",
] as const;

export type SourceType = (typeof sourceTypes)[number];

export interface SourceReference {
  readonly id: Identifier;
  readonly type: SourceType;
  readonly documentReferenceId?: Identifier;
  readonly reference?: string;
  readonly version?: string;
  readonly effectiveDate?: ISODate;
  readonly verifiedDate?: ISODate;
  readonly notes?: string;
}
