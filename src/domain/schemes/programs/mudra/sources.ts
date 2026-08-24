import type { RuleSourceReference } from "../../provenance";

export const pmmyCurrentDfsSource: RuleSourceReference = {
  sourceId: "PMMY.DFS.CURRENT.2026-02-05",
  authority:
    "Department of Financial Services, Ministry of Finance, Government of India",
  documentTitle: "Pradhan Mantri MUDRA Yojana (PMMY)",
  sourceType: "OFFICIAL_PORTAL",
  sourceUrl:
    "https://financialservices.gov.in/pradhan-mantri-mudra-yojana-pmmy",
  retrievedAt: "2026-08-24T00:00:00+05:30",
  pageOrReference: "Features - purposes, categories, MLIs and collateral",
  notes:
    "Current official category boundaries, Tarun Plus prior-repayment condition, term/working-capital purposes, lender categories and collateral-free status.",
};

export const pmmyTarunPlusNotificationSource: RuleSourceReference = {
  sourceId: "PMMY.TARUN-PLUS.2024-10-24",
  authority:
    "Department of Financial Services, Ministry of Finance, Government of India",
  documentTitle:
    "Significant Developments of Department of Financial Services for October 2024",
  sourceType: "OFFICIAL_NOTIFICATION",
  sourceUrl:
    "https://financialservices.gov.in/beta/sites/default/files/2024-11/Website-October-2024-English.pdf",
  documentVersion: "Gazette change reported 24-10-2024",
  publicationDate: "2024-10-24",
  effectiveDate: "2024-10-24",
  retrievedAt: "2026-08-24T00:00:00+05:30",
  pageOrReference: "PMMY credit-limit enhancement to Tarun Plus",
  notes:
    "Official evidence that the overall limit was enhanced from Rs 10 lakh to Rs 20 lakh through Tarun Plus from 24-10-2024.",
};

export const pmmyProgramSources = [
  pmmyTarunPlusNotificationSource,
  pmmyCurrentDfsSource,
] as const;
