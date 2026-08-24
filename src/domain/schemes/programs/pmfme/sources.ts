import type { RuleSourceReference } from "../../provenance";

export const pmfmeOriginalGuidelineSource: RuleSourceReference = {
  sourceId: "PMFME.GUIDELINE.2020-06-29",
  authority: "Ministry of Food Processing Industries, Government of India",
  documentTitle:
    "Guidelines for Implementation of PM Formalisation of Micro Food Processing Enterprises Scheme",
  sourceType: "OFFICIAL_GUIDELINE",
  sourceUrl:
    "https://www.pmfme.mofpi.gov.in/newsletters/docs/SchemeGuidelines.pdf",
  documentVersion: "Guidelines issued 29-06-2020",
  publicationDate: "2020-06-29",
  effectiveDate: "2020-06-29",
  retrievedAt: "2026-08-24T00:00:00+05:30",
  pageOrReference: "Paragraphs 1.4, 4, 5 and 6",
  notes:
    "Original design states an implementation period from 2020-21 through 2024-25. It remains background authority where not amended.",
};

export const pmfmeMay2022ModificationSource: RuleSourceReference = {
  sourceId: "PMFME.OM.2022-05-18",
  authority: "Ministry of Food Processing Industries, Government of India",
  documentTitle:
    "Modification in guidelines of Individual Micro Enterprises and Group category components of PMFME",
  sourceType: "OFFICIAL_NOTIFICATION",
  sourceUrl:
    "https://pmfme.mofpi.gov.in/massets/documents/advertisement-doc/PMFME_Guidelines_Modification.pdf",
  documentVersion: "F. No. FM-11/64/2021-FME-Part(2)",
  publicationDate: "2022-05-18",
  effectiveDate: "2022-05-18",
  retrievedAt: "2026-08-24T00:00:00+05:30",
  pageOrReference: "Paragraphs 1 and 2; Annexure I",
  notes:
    "Operative modification for new/existing units, ODOP preference, entity scope, 35 percent assistance, cost eligibility, 30 percent technical-civil cap, 10 percent contribution, common infrastructure and negative activities.",
};

export const pmfmeCurrentPortalSource: RuleSourceReference = {
  sourceId: "PMFME.PORTAL.CURRENT.2026-08-24",
  authority: "Ministry of Food Processing Industries, Government of India",
  documentTitle: "Official PMFME portal",
  sourceType: "OFFICIAL_PORTAL",
  sourceUrl: "https://pmfme.mofpi.gov.in/",
  retrievedAt: "2026-08-24T00:00:00+05:30",
  pageOrReference:
    "Current application statistics, salient features and 30-12-2025 primary-processing clarification notice",
  notes:
    "Current operational evidence only. No separate formal continuation/extension order beyond the original 2024-25 period was located.",
};

export const pmfmeAifConvergenceSource: RuleSourceReference = {
  sourceId: "PMFME.AIF.CONVERGENCE-SOP.2022-08-01",
  authority:
    "Ministry of Food Processing Industries and Department of Agriculture and Farmers Welfare, Government of India",
  documentTitle:
    "Standard Operating Procedure for convergence of AIF with PMFME and PMKSY",
  sourceType: "OFFICIAL_SOP",
  sourceUrl:
    "https://pmfme.mofpi.gov.in/pmfme/newsletters/docs/Standard%20Operating%20Procedure%20for%20Convergence%20of%20AIF%20of%20DA%26FW%20with%20PMFME%20and%20PMKSY%20of%20MoFPI.pdf",
  publicationDate: "2022-08-01",
  effectiveDate: "2022-08-01",
  retrievedAt: "2026-08-24T00:00:00+05:30",
  pageOrReference: "PMFME/AIF component and assistance matrix",
  notes:
    "Expressly supports convergence: PMFME capital subsidy with AIF 3 percent interest subvention and credit-guarantee support, subject to each scheme's rules.",
};

export const pmfmeProgramSources = [
  pmfmeOriginalGuidelineSource,
  pmfmeMay2022ModificationSource,
  pmfmeCurrentPortalSource,
] as const;
