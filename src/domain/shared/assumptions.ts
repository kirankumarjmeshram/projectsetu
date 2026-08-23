import type { SourceReference } from "./provenance";

export interface Assumption<TValue> {
  readonly value: TValue;
  readonly source: SourceReference;
  readonly notes?: string;
}
