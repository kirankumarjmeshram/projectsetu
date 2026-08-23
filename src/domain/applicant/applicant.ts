import type { Assumption } from "../shared/assumptions";
import type {
  Identifier,
  ISODate,
  MonetaryAmount,
  Percentage,
} from "../shared/types";

export const applicantTypes = [
  "INDIVIDUAL",
  "PROPRIETORSHIP",
  "PARTNERSHIP",
  "LLP",
  "COMPANY",
  "FPO",
  "SHG",
  "COOPERATIVE",
] as const;
export type ApplicantType = (typeof applicantTypes)[number];

export const sensitiveIdentifierKinds = ["PAN", "AADHAAR", "OTHER"] as const;
export type SensitiveIdentifierKind = (typeof sensitiveIdentifierKinds)[number];

/**
 * Points to protected data held outside ordinary domain payloads. Raw sensitive
 * identifiers must never be placed here, logged, or used in fixtures.
 */
export interface SensitiveIdentifierReference {
  readonly kind: SensitiveIdentifierKind;
  readonly protectedReferenceId: Identifier;
  readonly maskedDisplayValue?: string;
}

export interface Applicant {
  readonly id: Identifier;
  readonly type: ApplicantType;
  readonly name: string;
  readonly addressId?: Identifier;
  readonly dateOfBirth?: ISODate;
  readonly ageAtApplication?: number;
  readonly education?: readonly string[];
  readonly technicalQualifications?: readonly string[];
  readonly experienceSummary?: string;
  readonly existingBusinessExperience?: string;
  readonly contributionCapacity?: Assumption<MonetaryAmount>;
  readonly sensitiveIdentifiers?: readonly SensitiveIdentifierReference[];
}

export interface Promoter {
  readonly id: Identifier;
  readonly applicantId: Identifier;
  readonly businessEntityId?: Identifier;
  readonly role?: string;
  readonly ownershipPercentage?: Percentage;
}
