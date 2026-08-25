import { programId } from "@/domain/schemes/program";

import type { SchemeUiDescriptor } from "./types";

export const SCHEME_UI_DESCRIPTORS: readonly SchemeUiDescriptor[] = [
  {
    programId: programId("GOI.PMEGP.NEW_ENTERPRISE"),
    familyId: "GOI.PMEGP",
    code: "PMEGP",
    name: "Prime Minister's Employment Generation Programme (PMEGP)",
    category: "CENTRAL_SUBSIDY",
    sponsoringAgency: "Ministry of MSME / KVIC",
    shortSummary:
      "Credit-linked subsidy program for setting up new micro-enterprises in manufacturing and services sector.",
    subsidyRateDescription:
      "15% to 35% margin money subsidy depending on category and location",
    maxProjectCost: "₹50 Lakhs (Manufacturing) / ₹20 Lakhs (Service)",
    eligibleSectors: ["Manufacturing", "Services", "Agro-Processing"],
    dynamicFields: [
      {
        key: "pmegp.applicant_type",
        label: "Applicant Entity Type",
        type: "SELECT",
        options: [
          { label: "Individual Entrepreneur", value: "INDIVIDUAL" },
          { label: "Self Help Group (SHG)", value: "SHG" },
          { label: "Cooperative Society", value: "COOPERATIVE_SOCIETY" },
          { label: "Trust / Institution", value: "INSTITUTION" },
        ],
        defaultValue: "INDIVIDUAL",
        required: true,
      },
      {
        key: "pmegp.social_category",
        label: "Social Category / Caste",
        type: "SELECT",
        options: [
          { label: "General", value: "GENERAL" },
          { label: "OBC (Other Backward Class)", value: "OBC" },
          { label: "SC (Scheduled Caste)", value: "SC" },
          { label: "ST (Scheduled Tribe)", value: "ST" },
          { label: "Minority", value: "MINORITY" },
        ],
        defaultValue: "GENERAL",
        required: true,
      },
      {
        key: "pmegp.gender",
        label: "Promoter Gender",
        type: "RADIO",
        options: [
          { label: "Male", value: "MALE" },
          { label: "Female (Special Category Benefit)", value: "FEMALE" },
          { label: "Other", value: "OTHER" },
        ],
        defaultValue: "MALE",
        required: true,
      },
      {
        key: "pmegp.location_classification",
        label: "Unit Location Classification",
        type: "RADIO",
        options: [
          { label: "Rural (Higher 25%-35% Subsidy)", value: "RURAL" },
          { label: "Urban (15%-25% Subsidy)", value: "URBAN" },
        ],
        defaultValue: "RURAL",
        required: true,
      },
      {
        key: "pmegp.activity_type",
        label: "Activity Classification",
        type: "SELECT",
        options: [
          { label: "Manufacturing", value: "MANUFACTURING" },
          { label: "Service / Business", value: "SERVICE" },
        ],
        defaultValue: "MANUFACTURING",
        required: true,
      },
      {
        key: "pmegp.education_level",
        label: "Promoter Educational Qualification",
        type: "SELECT",
        options: [
          {
            label: "8th Pass or Above (Required for >₹10L Mfg / >₹5L Svc)",
            value: "GRADUATE",
          },
          { label: "Below 8th Standard", value: "BELOW_EIGHTH" },
        ],
        defaultValue: "GRADUATE",
        required: true,
      },
      {
        key: "pmegp.enterprise_status",
        label: "Enterprise Status",
        type: "SELECT",
        options: [
          { label: "New Enterprise / Greenfield", value: "NEW" },
          {
            label: "Existing Unit (Not eligible for 1st loan)",
            value: "EXISTING",
          },
        ],
        defaultValue: "NEW",
        required: true,
      },
      {
        key: "pmegp.edp_training_completed",
        label: "Entrepreneurship Development Program (EDP) Training",
        type: "BOOLEAN",
        description: "Completed or undertaking mandatory 10-day EDP training",
        defaultValue: true,
        required: true,
      },
      {
        key: "pmegp.prior_pmegp_subsidy",
        label:
          "Has the applicant or family claimed PMEGP / REGP / PMRY subsidy previously?",
        type: "BOOLEAN",
        description: "Must be false for 1st loan eligibility",
        defaultValue: false,
        required: true,
      },
      {
        key: "pmegp.is_negative_list",
        label:
          "Is the project in PMEGP Negative List (e.g. meat, alcohol, tobacco, polythene)?",
        type: "BOOLEAN",
        defaultValue: false,
        required: true,
      },
    ],
  },
  {
    programId: programId("MH.CMEGP.NEW_ENTERPRISE"),
    familyId: "MH.CMEGP",
    code: "CMEGP",
    name: "Maharashtra Chief Minister Employment Generation Programme (CMEGP)",
    category: "STATE_SUBSIDY",
    sponsoringAgency: "Government of Maharashtra (Industries Dept)",
    shortSummary:
      "State credit-linked subsidy for new MSME projects located in Maharashtra with back-ended margin money.",
    subsidyRateDescription:
      "15% to 35% margin money assistance based on category & region",
    maxProjectCost: "₹50 Lakhs (Manufacturing) / ₹20 Lakhs (Services)",
    eligibleSectors: ["Manufacturing", "Services", "Agro-Processing"],
    dynamicFields: [
      {
        key: "location.state",
        label: "Project State Location",
        type: "TEXT",
        defaultValue: "MAHARASHTRA",
        description: "Must be in Maharashtra for CMEGP eligibility",
        required: true,
      },
      {
        key: "applicant.entityType",
        label: "Applicant Entity Type",
        type: "SELECT",
        options: [
          { label: "Individual Entrepreneur", value: "INDIVIDUAL" },
          { label: "Partnership Firm", value: "PARTNERSHIP" },
          { label: "Approved Self Help Group (SHG)", value: "APPROVED_SHG" },
        ],
        defaultValue: "INDIVIDUAL",
        required: true,
      },
      {
        key: "cmegp.applicant_gender",
        label: "Applicant Gender",
        type: "RADIO",
        options: [
          { label: "Male", value: "MALE" },
          { label: "Female (Special Category)", value: "FEMALE" },
        ],
        defaultValue: "MALE",
        required: true,
      },
      {
        key: "cmegp.social_category",
        label: "Social Category",
        type: "SELECT",
        options: [
          { label: "General", value: "GENERAL" },
          { label: "SC (Scheduled Caste)", value: "SC" },
          { label: "ST (Scheduled Tribe)", value: "ST" },
          { label: "VJNT / SBC / OBC", value: "OBC" },
          { label: "Minority", value: "MINORITY" },
        ],
        defaultValue: "GENERAL",
        required: true,
      },
      {
        key: "cmegp.location_classification",
        label: "Location Area Classification",
        type: "RADIO",
        options: [
          { label: "Rural (Higher Subsidy)", value: "RURAL" },
          { label: "Urban", value: "URBAN" },
        ],
        defaultValue: "RURAL",
        required: true,
      },
    ],
  },
  {
    programId: programId("GOI.NLM.RURAL_POULTRY"),
    familyId: "GOI.NLM",
    code: "NLM_POULTRY",
    name: "National Livestock Mission (NLM) - Rural Poultry",
    category: "LIVESTOCK",
    sponsoringAgency: "Ministry of Fisheries, Animal Husbandry and Dairying",
    shortSummary:
      "50% capital subsidy (up to ₹25 Lakhs) for establishing rural poultry parent farms, hatcheries, and mother units.",
    subsidyRateDescription: "50% capital subsidy up to ₹25,00,000",
    maxProjectCost: "₹50 Lakhs benchmark",
    eligibleSectors: ["Poultry", "Livestock Breeding"],
    dynamicFields: [
      {
        key: "applicant.entityType",
        label: "Applicant Entity Type",
        type: "SELECT",
        options: [
          { label: "Individual", value: "INDIVIDUAL" },
          { label: "Self Help Group (SHG)", value: "SHG" },
          { label: "Farmer Producer Organisation (FPO)", value: "FPO" },
          { label: "Section 8 Company", value: "SECTION_8_COMPANY" },
        ],
        defaultValue: "INDIVIDUAL",
        required: true,
      },
      {
        key: "nlm.has_land_or_lease",
        label: "Applicant owns or holds registered lease for required land?",
        type: "BOOLEAN",
        defaultValue: true,
        required: true,
      },
      {
        key: "nlm.subsidy_already_claimed",
        label:
          "Has NLM capital subsidy been claimed previously for this activity?",
        type: "BOOLEAN",
        defaultValue: false,
        required: true,
      },
    ],
  },
  {
    programId: programId("GOI.PMFME.INDIVIDUAL_UNIT"),
    familyId: "GOI.PMFME",
    code: "PMFME",
    name: "PM Formalisation of Micro food processing Enterprises (PMFME)",
    category: "FOOD_PROCESSING",
    sponsoringAgency: "Ministry of Food Processing Industries (MoFPI)",
    shortSummary:
      "35% credit-linked capital subsidy (up to ₹10 Lakhs) for micro food processing enterprises under One District One Product (ODOP).",
    subsidyRateDescription: "35% credit-linked subsidy up to ₹10,00,000",
    maxProjectCost: "₹30 Lakhs (Typical)",
    eligibleSectors: ["Food Processing", "Agro-Processing"],
    dynamicFields: [
      {
        key: "applicant.entityType",
        label: "Applicant Entity Type",
        type: "SELECT",
        options: [
          { label: "Individual / Proprietorship", value: "INDIVIDUAL" },
          { label: "Farmer Producer Organisation (FPO)", value: "FPO" },
          { label: "Self Help Group (SHG)", value: "SHG" },
          { label: "Producer Cooperative", value: "PRODUCER_COOPERATIVE" },
        ],
        defaultValue: "INDIVIDUAL",
        required: true,
      },
    ],
  },
  {
    programId: programId("GOI.PMMY"),
    familyId: "GOI.PMMY",
    code: "MUDRA",
    name: "Pradhan Mantri MUDRA Yojana (PMMY)",
    category: "CREDIT_PROGRAM",
    sponsoringAgency: "Department of Financial Services / MUDRA",
    shortSummary:
      "Collateral-free institutional credit up to ₹20 Lakhs across Shishu, Kishore, and Tarun categories.",
    subsidyRateDescription: "Collateral-free credit (No direct subsidy)",
    maxProjectCost: "Up to ₹20 Lakhs loan",
    eligibleSectors: [
      "Manufacturing",
      "Trading",
      "Services",
      "All Non-Farm MSME",
    ],
    dynamicFields: [
      {
        key: "financing.requestedCredit",
        label: "Requested Credit / Loan Amount (₹)",
        type: "NUMBER",
        defaultValue: "1000000.00",
        description:
          "Shishu (up to ₹50k), Kishore (₹50k-₹5L), Tarun (₹5L-₹10L), Tarun Plus (₹10L-₹20L)",
        required: true,
      },
      {
        key: "activity.classification",
        label: "Activity Classification",
        type: "TEXT",
        defaultValue: "MANUFACTURING",
        required: true,
      },
    ],
  },
];

export function getSchemeDescriptor(
  id: string,
): SchemeUiDescriptor | undefined {
  return SCHEME_UI_DESCRIPTORS.find((s) => s.programId === id || s.code === id);
}
