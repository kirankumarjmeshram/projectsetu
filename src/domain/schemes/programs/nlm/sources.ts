import type { RuleSourceReference } from "../../provenance";

export const nlmJanuary2025GuidelineSource: RuleSourceReference = {
  sourceId: "NLM.GUIDELINE.JAN-2025",
  authority: "Department of Animal Husbandry and Dairying, Government of India",
  documentTitle:
    "Comprehensive Operational Guidelines for National Livestock Mission",
  sourceType: "OFFICIAL_GUIDELINE",
  sourceUrl:
    "https://dahd.gov.in/sites/default/files/2026-04/NLMGuidelinesJan2025.pdf",
  documentVersion: "January 2025 operational guidelines",
  retrievedAt: "2026-08-24T00:00:00+05:30",
  pageOrReference: "Entrepreneurship components and annexures",
  notes:
    "Base operational rules retained except where the later 25-02-2026 amendment changes scope or eligible entities.",
};

export const nlmFebruary2026AmendmentSource: RuleSourceReference = {
  sourceId: "NLM.AMENDMENT.2026-02-25",
  authority: "Department of Animal Husbandry and Dairying, Government of India",
  documentTitle: "Amendment in Guidelines for National Livestock Mission",
  sourceType: "OFFICIAL_NOTIFICATION",
  sourceUrl:
    "https://dahd.gov.in/sites/default/files/2026-02/RevisedNLMGuidelines.pdf",
  documentVersion: "Order R-99014/15/2023-Anlm_Dadf",
  publicationDate: "2026-02-25",
  effectiveDate: "2026-02-25",
  retrievedAt: "2026-08-24T00:00:00+05:30",
  pageOrReference: "Paragraphs 3.2.1 to 3.2.3 and 5.13.7",
  notes:
    "Amends the existing operational guidelines; expands entrepreneurship to horse, camel, donkey and mule and expands feed/fodder and innovation scope. It is not a full replacement text.",
};

export const nlmUnitSizeSource: RuleSourceReference = {
  sourceId: "NLM.PARLIAMENT.LS-303.2025-02-04",
  authority: "Department of Animal Husbandry and Dairying, Government of India",
  documentTitle: "Lok Sabha Question No. 303 - Annexure II",
  sourceType: "OFFICIAL_NOTIFICATION",
  sourceUrl: "https://dahd.gov.in/sites/default/files/2025-04/LS303.pdf",
  publicationDate: "2025-02-04",
  retrievedAt: "2026-08-24T00:00:00+05:30",
  pageOrReference: "Annexure II - activity unit sizes and subsidy caps",
  notes:
    "Official activity-specific unit-size/cap table for poultry, sheep/goat, piggery, fodder, horse, donkey and camel.",
};

export const nlmCurrentPortalSource: RuleSourceReference = {
  sourceId: "NLM.PORTAL.CURRENT.2026-08-24",
  authority: "Department of Animal Husbandry and Dairying, Government of India",
  documentTitle: "National Livestock Mission official scheme page",
  sourceType: "OFFICIAL_PORTAL",
  sourceUrl:
    "https://dahd.gov.in/schemes/programmes/national_livestock_mission",
  retrievedAt: "2026-08-24T00:00:00+05:30",
  pageOrReference: "Current sub-missions and entrepreneurship activities",
  notes: "Current operational evidence; it does not create a new rule version.",
};

export const nlmProgramSources = [
  nlmJanuary2025GuidelineSource,
  nlmFebruary2026AmendmentSource,
  nlmUnitSizeSource,
  nlmCurrentPortalSource,
] as const;
