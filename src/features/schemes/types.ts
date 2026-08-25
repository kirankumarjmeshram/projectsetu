import type { ProgramId } from "@/domain/schemes/program";

export type SchemeFieldType =
  "TEXT" | "NUMBER" | "BOOLEAN" | "SELECT" | "RADIO" | "MULTI_SELECT";

export interface SchemeFieldOption {
  readonly label: string;
  readonly value: string;
  readonly description?: string;
}

export interface SchemeFieldDefinition {
  readonly key: string;
  readonly label: string;
  readonly type: SchemeFieldType;
  readonly description?: string;
  readonly placeholder?: string;
  readonly defaultValue?: string | boolean | readonly string[];
  readonly options?: readonly SchemeFieldOption[];
  readonly required?: boolean;
}

export interface SchemeUiDescriptor {
  readonly programId: ProgramId;
  readonly familyId: string;
  readonly code: string;
  readonly name: string;
  readonly category:
    | "CENTRAL_SUBSIDY"
    | "STATE_SUBSIDY"
    | "CREDIT_PROGRAM"
    | "LIVESTOCK"
    | "FOOD_PROCESSING";
  readonly sponsoringAgency: string;
  readonly shortSummary: string;
  readonly subsidyRateDescription: string;
  readonly maxProjectCost: string;
  readonly eligibleSectors: readonly string[];
  readonly dynamicFields: readonly SchemeFieldDefinition[];
  readonly autoMapFromProject?: (
    projectData: Record<string, unknown>,
  ) => Record<string, unknown>;
}
