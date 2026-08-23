import type { SourceReference } from "../shared/provenance";
import type {
  AuditMetadata,
  DateRange,
  Identifier,
  ProjectionYear,
} from "../shared/types";

export const projectModes = ["SELF_FUNDED", "BANKABLE", "SUBSIDY"] as const;
export type ProjectMode = (typeof projectModes)[number];

export const projectStages = [
  "CONCEPT",
  "PLANNING",
  "PRE_IMPLEMENTATION",
  "IMPLEMENTATION",
  "OPERATIONAL",
] as const;
export type ProjectStage = (typeof projectStages)[number];

export const projectStatuses = [
  "DRAFT",
  "IN_REVIEW",
  "FINALIZED",
  "ARCHIVED",
] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

export const areaClassifications = ["RURAL", "URBAN", "UNCLASSIFIED"] as const;
export type AreaClassification = (typeof areaClassifications)[number];

export interface PostalAddress {
  readonly lines: readonly string[];
  readonly villageTownCity?: string;
  readonly district: string;
  readonly state: string;
  readonly pinCode?: string;
}

export interface ProjectLocation {
  readonly address: PostalAddress;
  readonly areaClassification: AreaClassification;
  readonly classificationSource?: SourceReference;
}

export interface Project {
  readonly id: Identifier;
  readonly name: string;
  readonly mode: ProjectMode;
  readonly industryActivity: string;
  readonly stage: ProjectStage;
  readonly status: ProjectStatus;
  readonly location: ProjectLocation;
  readonly projectionPeriodYears: ProjectionYear;
  readonly implementationPeriod?: DateRange;
  readonly metadata: AuditMetadata;
}

export const milestoneTypes = [
  "LOAN_SANCTION",
  "SITE_DEVELOPMENT",
  "BUILDING",
  "MACHINERY_ORDERING",
  "DELIVERY",
  "INSTALLATION",
  "ELECTRICITY",
  "LICENCES",
  "TRIAL_PRODUCTION",
  "COMMERCIAL_PRODUCTION",
  "SCHEME_APPLICATION",
  "SCHEME_APPROVAL",
  "INSPECTION",
  "SUBSIDY_CLAIM",
  "SUBSIDY_RELEASE",
  "OTHER",
] as const;
export type MilestoneType = (typeof milestoneTypes)[number];

export interface ImplementationMilestone {
  readonly id: Identifier;
  readonly type: MilestoneType;
  readonly name: string;
  readonly plannedPeriod: DateRange;
  readonly dependencies?: readonly Identifier[];
  readonly notes?: string;
}

export interface ImplementationSchedule {
  readonly projectId: Identifier;
  readonly milestones: readonly ImplementationMilestone[];
}

export interface EmploymentImpact {
  readonly directEmployment?: number;
  readonly skilledEmployment?: number;
  readonly unskilledEmployment?: number;
  readonly womenEmployment?: number;
  readonly indirectEmployment?: number;
  readonly qualitativeImpacts?: readonly string[];
}

export function isProjectStatus(value: string): value is ProjectStatus {
  return projectStatuses.some((status) => status === value);
}
