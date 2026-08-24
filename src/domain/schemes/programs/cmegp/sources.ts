import type { RuleSourceReference } from "../../provenance";

export const cmegpOriginalGrSource: RuleSourceReference = {
  sourceId: "CMEGP.GR.2019-08-01",
  authority:
    "Industries, Energy and Labour Department, Government of Maharashtra",
  documentTitle:
    "Implementation of Chief Minister Employment Generation Programme in Maharashtra",
  sourceType: "STATE_GR",
  sourceUrl:
    "https://industry.maharashtra.gov.in/sites/default/files/2025-09/20190801cmegp.pdf",
  documentVersion: "GR No. Yojana-2019/Pra.Kra.121/Industries-7",
  publicationDate: "2019-08-01",
  effectiveDate: "2019-08-01",
  retrievedAt: "2026-08-24T00:00:00+05:30",
  pageOrReference:
    "Beneficiary eligibility, contribution/rate matrix, finance and release procedure",
  notes:
    "Base rules continue only where the 21-05-2025 amendment does not replace them.",
};

export const cmegpMay2025AmendmentSource: RuleSourceReference = {
  sourceId: "CMEGP.GR.2025-05-21",
  authority:
    "Industries, Energy, Labour and Mining Department, Government of Maharashtra",
  documentTitle:
    "Amendments in provisions of Chief Minister Employment Generation Programme",
  sourceType: "STATE_GR",
  sourceUrl:
    "https://industry.maharashtra.gov.in/sites/default/files/2025-09/20250521cmegp.pdf",
  documentVersion: "GR No. MuroNi-2024/Pra.Kra.98/Industries-7",
  publicationDate: "2025-05-21",
  effectiveDate: "2025-04-01",
  retrievedAt: "2026-08-24T00:00:00+05:30",
  pageOrReference: "Amended provisions 1 to 11",
  notes:
    "Current sector/activity scope, age, project ceilings, rate/cap matrix, working-capital limits, education thresholds, rural definition and revised verification/adjustment process.",
};

export const cmegpOctober2025VerificationSource: RuleSourceReference = {
  sourceId: "CMEGP.GR.2025-10-28",
  authority:
    "Industries, Energy, Labour and Mining Department, Government of Maharashtra",
  documentTitle:
    "Administrative approval for third-party asset verification under CMEGP",
  sourceType: "STATE_GR",
  sourceUrl:
    "https://gr.maharashtra.gov.in/Site/Upload/Government%20Resolutions/English/202510281802050410.pdf",
  documentVersion: "GR No. IELD/152/2025-INDUSTRY-7",
  publicationDate: "2025-10-28",
  effectiveDate: "2025-10-28",
  retrievedAt: "2026-08-24T00:00:00+05:30",
  pageOrReference: "Proposal paragraphs 1 and 2",
  notes:
    "Confirms current online operation and the amended two-year physical-verification and three-year margin-money adjustment flow.",
};

export const cmegpProgramSources = [
  cmegpOriginalGrSource,
  cmegpMay2025AmendmentSource,
  cmegpOctober2025VerificationSource,
] as const;
