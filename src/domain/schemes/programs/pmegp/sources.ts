import type { RuleSourceReference } from "../../provenance";

const guidelineBase = {
  authority:
    "Ministry of Micro, Small and Medium Enterprises, Government of India",
  documentTitle:
    "Revised Prime Minister's Employment Generation Programme Guidelines",
  sourceType: "OFFICIAL_GUIDELINE",
  sourceUrl:
    "https://msme.gov.in/sites/default/files/Revisedguidelines07.12.2023.pdf",
  documentVersion: "Revised Guidelines dated 07-12-2023",
  publicationDate: "2023-12-07",
  effectiveDate: "2023-12-07",
  retrievedAt: "2026-08-24T00:00:00+05:30",
} as const;

function guidelineClause(
  sourceId: string,
  pageOrReference: string,
  notes: string,
): RuleSourceReference {
  return { ...guidelineBase, sourceId, pageOrReference, notes };
}

export const pmegpRevisedGuidelineSource: RuleSourceReference = {
  ...guidelineBase,
  sourceId: "PMEGP.GUIDELINE.2023-12-07",
  pageOrReference: "Complete revised guideline",
  notes:
    "Primary rule authority. The 07-12-2023 revision incorporates mandatory Udyam registration before physical verification and margin-money adjustment.",
};

export const pmegpLevelsOfSupportSource = guidelineClause(
  "PMEGP.GUIDELINE.2023-12-07.CLAUSE-3",
  "Clause 3 - Levels of support under PMEGP",
  "New-enterprise contribution/rate matrix and cost ceilings; independent upgradation contribution, rates, cost ceilings, and subsidy caps.",
);

export const pmegpNewEligibilitySource = guidelineClause(
  "PMEGP.GUIDELINE.2023-12-07.CLAUSE-4.1",
  "Clause 4.1 - PMEGP new enterprises",
  "Age, income, education, new-project, prior-assistance, entity, capital-expenditure, land, workshed, trading, transport, Udyam-stage, and family rules.",
);

export const pmegpUpgradationEligibilitySource = guidelineClause(
  "PMEGP.GUIDELINE.2023-12-07.CLAUSE-4.2",
  "Clause 4.2 - Up-gradation of existing PMEGP/REGP/MUDRA units",
  "Prior assistance adjustment where applicable, timely first-loan repayment, profitability, turnover, and growth-potential requirements.",
);

export const pmegpBankFinanceSource = guidelineClause(
  "PMEGP.GUIDELINE.2023-12-07.CLAUSE-8",
  "Clause 8 - Bank Finance",
  "90/95 percent bank-finance structure, capital/working-capital financing, sector working-capital limits, excess-cost treatment, and expenditure-shortfall refund metadata.",
);

export const pmegpClaimReleaseSource = guidelineClause(
  "PMEGP.GUIDELINE.2023-12-07.CLAUSES-11.17-11.23",
  "Clauses 11.17 to 11.23 - Margin-money claim and TDR/SRF",
  "First-disbursement, EDP, contribution and qualifying-disbursement claim conditions; release to financing bank; three-year TDR/SRF holding; no immediate beneficiary cash.",
);

export const pmegpPhysicalVerificationSource = guidelineClause(
  "PMEGP.GUIDELINE.2023-12-07.CLAUSE-14",
  "Clause 14 - Physical verification and margin-money adjustment",
  "Physical verification and implementing-agency adjustment letter after the lock-in period; the bank cannot adjust margin money early.",
);

export const pmegpNegativeListSource = guidelineClause(
  "PMEGP.GUIDELINE.2023-12-07.CLAUSE-30",
  "Clause 30 - Negative List of Activities",
  "Current prohibitions plus express non-vegetarian-food, value-addition, off-farm/farm-linked, dairy, poultry, aquaculture, insects/sericulture, and NER piggery exceptions.",
);

export const pmegpUpgradationLifecycleSource = guidelineClause(
  "PMEGP.GUIDELINE.2023-12-07.CLAUSE-72",
  "Clause 72 - Upgradation component",
  "Independent second-loan implementation, three-year TDR/SRF holding, physical verification, and adjustment behavior.",
);

export const pmegpUdyamRevisionSource: RuleSourceReference = {
  ...guidelineBase,
  sourceId: "PMEGP.OM.UDYAM.2023-12-07",
  documentTitle:
    "Office Memorandum - Approval for modifications in PMEGP guidelines making Udyam Registration mandatory",
  sourceType: "OFFICIAL_NOTIFICATION",
  pageOrReference:
    "O.M. No. PMEGP/UdyamReg./01/2023 and revised Clauses 4.1 and 26",
  notes:
    "Udyam registration is a pre-physical-verification and pre-adjustment lifecycle requirement for new units, not an application-time eligibility requirement.",
};

export const pmegpOfficialPortalSource: RuleSourceReference = {
  sourceId: "PMEGP.PORTAL.CURRENT.2026-08-24",
  authority:
    "Ministry of Micro, Small and Medium Enterprises, Government of India",
  documentTitle: "Official PMEGP Portal",
  sourceType: "OFFICIAL_PORTAL",
  sourceUrl: "https://pmegp.msme.gov.in/",
  retrievedAt: "2026-08-24T00:00:00+05:30",
  pageOrReference: "Scheme Guidelines and Eligibility Criteria",
  notes:
    "Current-operation evidence and current portal summary. It does not create a new rule version.",
};

export const pmegpMsmeSchemePageSource: RuleSourceReference = {
  sourceId: "PMEGP.MSME.SCHEME-PAGE.2026-08-24",
  authority:
    "Ministry of Micro, Small and Medium Enterprises, Government of India",
  documentTitle:
    "Prime Minister Employment Generation Programme and Other Credit Support Schemes",
  sourceType: "OFFICIAL_PORTAL",
  sourceUrl:
    "https://www.msme.gov.in/offerings/schemes-and-services/details/prime-minister-employment-generation-programme-and-other-credit-support-schemes-1-MDMzETMtQWa",
  retrievedAt: "2026-08-24T00:00:00+05:30",
  pageOrReference: "PMEGP scheme details",
  notes: "Current Ministry summary and link to the revised guideline.",
};

export const pmegpMsmeBookletSource: RuleSourceReference = {
  sourceId: "PMEGP.MSME.BOOKLET.2025",
  authority:
    "Ministry of Micro, Small and Medium Enterprises, Government of India",
  documentTitle: "MSME Scheme Booklet 2025",
  sourceType: "OFFICIAL_GUIDELINE",
  sourceUrl:
    "https://msme.gov.in/sites/default/files/MSMESchemebooklet2025.pdf",
  documentVersion: "2025 Scheme Booklet v2.0",
  publicationDate: "2025-02-14",
  retrievedAt: "2026-08-24T00:00:00+05:30",
  pageOrReference: "PMEGP summary",
  notes:
    "Supporting current-summary evidence only; the 07-12-2023 revised guideline remains the primary rule authority.",
};

export const pmegpProgramSources = [
  pmegpRevisedGuidelineSource,
  pmegpOfficialPortalSource,
  pmegpMsmeSchemePageSource,
  pmegpMsmeBookletSource,
] as const;
