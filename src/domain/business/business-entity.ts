import type { Identifier, ISODate } from "../shared/types";

export const legalForms = [
  "PROPRIETORSHIP",
  "PARTNERSHIP",
  "LLP",
  "PRIVATE_LIMITED_COMPANY",
  "PUBLIC_LIMITED_COMPANY",
  "FPO",
  "SHG",
  "COOPERATIVE",
  "OTHER",
] as const;
export type LegalForm = (typeof legalForms)[number];

export const enterpriseStatuses = ["NEW", "EXISTING"] as const;
export type EnterpriseStatus = (typeof enterpriseStatuses)[number];

export const registrationKinds = [
  "UDYAM",
  "GST",
  "CIN",
  "LLPIN",
  "OTHER",
] as const;
export type RegistrationKind = (typeof registrationKinds)[number];

export interface RegistrationReference {
  readonly kind: RegistrationKind;
  readonly protectedReferenceId: Identifier;
  readonly registeredOn?: ISODate;
  readonly issuingAuthority?: string;
}

export interface BusinessEntity {
  readonly id: Identifier;
  readonly name: string;
  readonly legalForm: LegalForm;
  readonly enterpriseStatus: EnterpriseStatus;
  readonly registrations?: readonly RegistrationReference[];
  readonly registeredAddressId?: Identifier;
}
