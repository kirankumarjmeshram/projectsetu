import { decimalValue, percentage } from "../../../shared/decimal";
import type { FinancingProgramDefinition } from "../../program";
import { classificationTag, programId, programVersionId } from "../../program";
import type { PmegpReleaseLifecycle } from "./contracts";
import { PMEGP_HANDLER_IDS } from "./rules";
import {
  pmegpBankFinanceSource,
  pmegpClaimReleaseSource,
  pmegpLevelsOfSupportSource,
  pmegpNegativeListSource,
  pmegpNewEligibilitySource,
  pmegpPhysicalVerificationSource,
  pmegpProgramSources,
  pmegpUdyamRevisionSource,
} from "./sources";

export const PMEGP_NEW_ENTERPRISE_PROGRAM_ID = programId(
  "GOI.PMEGP.NEW_ENTERPRISE",
);
export const PMEGP_REVISED_GUIDELINE_VERSION_ID = programVersionId(
  "2023-12-07-REVISED-GUIDELINES",
);
export const PMEGP_NEW_ENTERPRISE_VERSION_ID =
  PMEGP_REVISED_GUIDELINE_VERSION_ID;

export const pmegpNewEnterpriseReleaseLifecycle: PmegpReleaseLifecycle = {
  creditLinked: true,
  immediateBeneficiaryCash: false,
  releaseRecipient: "FINANCING_BANK",
  holdingMechanism: "TDR_SRF",
  lockInPeriodYears: decimalValue("3"),
  stages: [
    "ELIGIBLE",
    "CLAIMED",
    "RECEIVED_BY_BANK",
    "LOCKED",
    "VERIFIED",
    "ADJUSTED",
  ],
  claimConditions: [
    "FIRST_LOAN_INSTALLMENT_RELEASED_BEFORE_CLAIM",
    "EDP_TRAINING_COMPLETED_AND_PORTAL_UPDATED",
    "BENEFICIARY_CONTRIBUTION_DEPOSITED",
    "FIRST_DISBURSEMENT_NOT_LESS_THAN_ELIGIBLE_MARGIN_MONEY",
    "ACTIVITY_CONFIRMED_OUTSIDE_NEGATIVE_LIST",
  ],
  adjustmentConditions: [
    "THREE_YEAR_LOCK_IN_COMPLETED",
    "POSITIVE_PHYSICAL_VERIFICATION",
    "IMPLEMENTING_AGENCY_ADJUSTMENT_LETTER_RECEIVED_BY_BANK",
    "UDYAM_REGISTRATION_COMPLETED_BEFORE_VERIFICATION_AND_ADJUSTMENT",
  ],
  shortfallReconciliationMetadata: [
    "COMPARE_THIRD_YEAR_INCURRED_CAPITAL_AND_WORKING_CAPITAL_WITH_SANCTIONED_PROJECT_EXPENDITURE",
    "REFUND_EXCESS_MARGIN_MONEY_ATTRIBUTABLE_TO_EXPENDITURE_SHORTFALL_TO_KVIC",
    "NO_RECOVERY_ACCOUNTING_IS_PERFORMED_BY_THIS DOMAIN MODULE",
  ],
  sourceReferences: [
    pmegpBankFinanceSource,
    pmegpClaimReleaseSource,
    pmegpPhysicalVerificationSource,
    pmegpUdyamRevisionSource,
  ],
};

export const pmegpNewEnterpriseDefinition: FinancingProgramDefinition = {
  programId: PMEGP_NEW_ENTERPRISE_PROGRAM_ID,
  versionId: PMEGP_NEW_ENTERPRISE_VERSION_ID,
  displayName: "PMEGP - New Enterprise",
  description:
    "Credit-linked composite assistance for a new PMEGP micro-enterprise, including calculated back-ended margin money.",
  programTypes: [
    "CREDIT_PROGRAM",
    "MARGIN_MONEY_SUBSIDY",
    "COMPOSITE_ASSISTANCE",
  ],
  effectiveFrom: "2023-12-07",
  status: "ACTIVE",
  jurisdiction: { country: "IN" },
  sourceReferences: pmegpProgramSources,
  eligibility: {
    groupId: "PMEGP.NEW.ELIGIBILITY",
    operator: "ALL",
    rules: [
      {
        ruleId: "PMEGP.NEW.ENTITY-TYPE",
        name: "Eligible applicant or entity type",
        type: "ENTITY_TYPE",
        factPath: "applicant.entityType",
        expectedValues: [
          "INDIVIDUAL",
          "SELF_HELP_GROUP",
          "REGISTERED_INSTITUTION",
          "PRODUCTION_COOPERATIVE",
          "CHARITABLE_TRUST",
        ],
        sourceReferences: [pmegpNewEligibilitySource],
      },
      {
        ruleId: "PMEGP.NEW.AGE",
        name: "Individual applicant is above 18 years",
        type: "CUSTOM_PREDICATE",
        predicateId: PMEGP_HANDLER_IDS.NEW_AGE,
        sourceReferences: [pmegpNewEligibilitySource],
      },
      {
        ruleId: "PMEGP.NEW.PROJECT-TYPE",
        name: "Project is a new enterprise",
        type: "EQUALS",
        factPath: "project.projectType",
        expectedValue: "NEW_ENTERPRISE",
        sourceReferences: [pmegpNewEligibilitySource],
      },
      {
        ruleId: "PMEGP.NEW.SECTOR",
        name: "Explicit PMEGP sector classification",
        type: "IN",
        factPath: "project.sector",
        expectedValues: ["MANUFACTURING", "SERVICE", "BUSINESS_TRADING"],
        sourceReferences: [pmegpLevelsOfSupportSource],
      },
      {
        ruleId: "PMEGP.NEW.NO-PRIOR-GOVERNMENT-SUBSIDY",
        name: "No prior government subsidy under another scheme",
        type: "BOOLEAN",
        factPath: "applicant.hasPreviouslyAvailedGovernmentSubsidy",
        expectedValue: false,
        sourceReferences: [pmegpNewEligibilitySource],
      },
      {
        ruleId: "PMEGP.NEW.NO-ASSISTED-EXISTING-UNIT",
        name: "No existing unit assisted under a government scheme",
        type: "BOOLEAN",
        factPath: "applicant.existingUnitAssistedUnderGovernmentScheme",
        expectedValue: false,
        sourceReferences: [pmegpNewEligibilitySource],
      },
      {
        ruleId: "PMEGP.NEW.ONE-BENEFICIARY-PER-FAMILY",
        name: "No existing PMEGP beneficiary in the defined family",
        description:
          "The revised guideline family definition is self and spouse; no family-tree inference is performed.",
        type: "BOOLEAN",
        factPath: "applicant.familyHasExistingPmegpBeneficiary",
        expectedValue: false,
        sourceReferences: [pmegpNewEligibilitySource],
      },
      {
        ruleId: "PMEGP.NEW.EDUCATION",
        name: "Education threshold by sector and project cost",
        type: "CUSTOM_PREDICATE",
        predicateId: PMEGP_HANDLER_IDS.NEW_EDUCATION,
        sourceReferences: [pmegpNewEligibilitySource],
      },
      {
        ruleId: "PMEGP.NEW.CAPITAL-EXPENDITURE",
        name: "Project includes eligible capital expenditure",
        type: "CUSTOM_PREDICATE",
        predicateId: PMEGP_HANDLER_IDS.NEW_CAPITAL_EXPENDITURE,
        sourceReferences: [pmegpNewEligibilitySource],
      },
      {
        ruleId: "PMEGP.NEW.CATEGORY-RESOLVED",
        name: "Beneficiary category is resolved from source-backed facts",
        type: "REQUIRED",
        factPath: "applicant.pmegpCategory",
        sourceReferences: [pmegpLevelsOfSupportSource],
      },
      {
        ruleId: "PMEGP.NEW.AREA-RESOLVED",
        name: "Rural or urban area is explicitly classified",
        type: "REQUIRED",
        factPath: "location.areaClassification",
        sourceReferences: [pmegpLevelsOfSupportSource],
      },
      {
        ruleId: "PMEGP.NEW.ACTIVITY",
        name: "Activity is allowed under current PMEGP rules",
        type: "CUSTOM_PREDICATE",
        predicateId: PMEGP_HANDLER_IDS.ACTIVITY,
        sourceReferences: [pmegpNewEligibilitySource, pmegpNegativeListSource],
      },
    ],
  },
  costEligibilityRules: [
    {
      ruleId: "PMEGP.NEW.LAND.EXCLUDED",
      type: "EXCLUDE_TAGS",
      tags: [classificationTag("LAND")],
      sourceReferences: [pmegpNewEligibilitySource],
    },
  ],
  benefits: [
    {
      benefitId: "PMEGP.NEW.MARGIN-MONEY",
      name: "Calculated eligible PMEGP margin money",
      kind: "MARGIN_MONEY",
      basis: "CUSTOM",
      calculation: "CUSTOM",
      handlerId: PMEGP_HANDLER_IDS.NEW_MARGIN_MONEY,
      creditLinked: true,
      release: {
        mechanism: "BACK_ENDED",
        installments: [
          {
            installmentNumber: 1,
            percentage: percentage("100"),
            trigger: "LOAN_FIRST_DISBURSEMENT",
            conditions: pmegpNewEnterpriseReleaseLifecycle.claimConditions,
          },
        ],
        conditions: [
          "RELEASED_TO_FINANCING_BANK_NOT_BENEFICIARY",
          "HELD_IN_TDR_SRF_FOR_THREE_YEARS",
          "ADJUSTED_ONLY_AFTER_VERIFICATION_AND_IMPLEMENTING_AGENCY_LETTER",
        ],
      },
      sourceReferences: [
        pmegpLevelsOfSupportSource,
        pmegpClaimReleaseSource,
        pmegpPhysicalVerificationSource,
      ],
    },
  ],
  bankFinanceRequirement: {
    requirement: "REQUIRED",
    selfFinanceAllowed: false,
    creditLinkedBenefit: true,
    sourceReferences: [pmegpBankFinanceSource],
  },
  nonFinancialBenefits: ["EDP_TRAINING_AND_HANDHOLDING"],
  handlerIds: [
    PMEGP_HANDLER_IDS.NEW_AGE,
    PMEGP_HANDLER_IDS.NEW_EDUCATION,
    PMEGP_HANDLER_IDS.NEW_CAPITAL_EXPENDITURE,
    PMEGP_HANDLER_IDS.ACTIVITY,
    PMEGP_HANDLER_IDS.NEW_MARGIN_MONEY,
  ],
};
