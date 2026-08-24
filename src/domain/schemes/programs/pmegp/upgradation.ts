import { decimalValue, percentage } from "../../../shared/decimal";
import type { FinancingProgramDefinition } from "../../program";
import { programId, programVersionId } from "../../program";
import type { PmegpReleaseLifecycle } from "./contracts";
import { PMEGP_HANDLER_IDS } from "./rules";
import {
  pmegpClaimReleaseSource,
  pmegpLevelsOfSupportSource,
  pmegpProgramSources,
  pmegpUpgradationEligibilitySource,
  pmegpUpgradationLifecycleSource,
} from "./sources";

export const PMEGP_UPGRADATION_PROGRAM_ID = programId("GOI.PMEGP.UPGRADATION");
export const PMEGP_UPGRADATION_VERSION_ID = programVersionId(
  "2023-12-07-REVISED-GUIDELINES",
);

export const pmegpUpgradationReleaseLifecycle: PmegpReleaseLifecycle = {
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
    "SECOND_LOAN_SANCTIONED_AND_QUALIFYING_DISBURSEMENT_MADE",
    "BENEFICIARY_CONTRIBUTION_DEPOSITED",
    "UPGRADATION_MARGIN_MONEY_CLAIM_VALIDATED",
  ],
  adjustmentConditions: [
    "INDEPENDENT_THREE_YEAR_LOCK_IN_COMPLETED",
    "POSITIVE_PHYSICAL_VERIFICATION",
    "IMPLEMENTING_AGENCY_ADJUSTMENT_LETTER_RECEIVED_BY_BANK",
  ],
  shortfallReconciliationMetadata: [
    "UPGRADATION_ACTUAL_EXPENDITURE_RECONCILIATION_REMAINS_WORKFLOW_METADATA",
    "NO_TDR_SRF_LEDGER_OR_RECOVERY_ACCOUNTING_IS_PERFORMED",
  ],
  sourceReferences: [pmegpClaimReleaseSource, pmegpUpgradationLifecycleSource],
};

export const pmegpUpgradationDefinition: FinancingProgramDefinition = {
  programId: PMEGP_UPGRADATION_PROGRAM_ID,
  versionId: PMEGP_UPGRADATION_VERSION_ID,
  displayName: "PMEGP - Upgradation of Existing Unit",
  description:
    "Independent second-loan assistance for qualifying existing PMEGP, REGP, or MUDRA units.",
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
    groupId: "PMEGP.UPGRADATION.ELIGIBILITY",
    operator: "ALL",
    rules: [
      {
        ruleId: "PMEGP.UPGRADATION.PRIOR-PROGRAM",
        name: "Prior unit belongs to an expressly recognized program",
        type: "IN",
        factPath: "enterprise.priorProgram",
        expectedValues: ["PMEGP", "REGP", "MUDRA"],
        sourceReferences: [pmegpUpgradationEligibilitySource],
      },
      {
        ruleId: "PMEGP.UPGRADATION.PRIOR-MARGIN-MONEY",
        name: "Prior PMEGP/REGP margin money was adjusted where applicable",
        type: "CUSTOM_PREDICATE",
        predicateId: PMEGP_HANDLER_IDS.UPGRADATION_PRIOR_MARGIN_MONEY,
        sourceReferences: [pmegpUpgradationEligibilitySource],
      },
      {
        ruleId: "PMEGP.UPGRADATION.LOAN-REPAID",
        name: "First loan was repaid in stipulated time",
        type: "BOOLEAN",
        factPath: "enterprise.firstLoanRepaidOnTime",
        expectedValue: true,
        sourceReferences: [pmegpUpgradationEligibilitySource],
      },
      {
        ruleId: "PMEGP.UPGRADATION.PROFITABLE-HISTORY",
        name: "Unit has at least three profitable years",
        type: "MINIMUM",
        factPath: "enterprise.profitableYears",
        minimum: decimalValue("3"),
        sourceReferences: [pmegpUpgradationEligibilitySource],
      },
      {
        ruleId: "PMEGP.UPGRADATION.GOOD-TURNOVER",
        name: "Unit has good turnover",
        type: "BOOLEAN",
        factPath: "enterprise.hasGoodTurnover",
        expectedValue: true,
        sourceReferences: [pmegpUpgradationEligibilitySource],
      },
      {
        ruleId: "PMEGP.UPGRADATION.GROWTH-POTENTIAL",
        name: "Unit has potential for turnover and profit growth",
        type: "BOOLEAN",
        factPath: "enterprise.hasGrowthPotential",
        expectedValue: true,
        sourceReferences: [pmegpUpgradationEligibilitySource],
      },
      {
        ruleId: "PMEGP.UPGRADATION.UDYAM",
        name: "Unit is registered under Udyam",
        type: "BOOLEAN",
        factPath: "enterprise.udyamRegistered",
        expectedValue: true,
        sourceReferences: [pmegpUpgradationEligibilitySource],
      },
      {
        ruleId: "PMEGP.UPGRADATION.SECTOR",
        name: "Explicit PMEGP sector classification",
        type: "IN",
        factPath: "project.sector",
        expectedValues: ["MANUFACTURING", "SERVICE", "BUSINESS_TRADING"],
        sourceReferences: [pmegpLevelsOfSupportSource],
      },
      {
        ruleId: "PMEGP.UPGRADATION.AREA-RESOLVED",
        name: "Upgradation standard or NER/Hill-State rate area is resolved",
        type: "REQUIRED",
        factPath: "location.upgradationAreaType",
        sourceReferences: [pmegpLevelsOfSupportSource],
      },
      {
        ruleId: "PMEGP.UPGRADATION.ACTIVITY",
        name: "Activity remains permissible under current PMEGP rules",
        type: "CUSTOM_PREDICATE",
        predicateId: PMEGP_HANDLER_IDS.ACTIVITY,
        sourceReferences: [pmegpUpgradationEligibilitySource],
      },
    ],
  },
  costEligibilityRules: [],
  benefits: [
    {
      benefitId: "PMEGP.UPGRADATION.MARGIN-MONEY",
      name: "Calculated eligible PMEGP upgradation margin money",
      kind: "MARGIN_MONEY",
      basis: "CUSTOM",
      calculation: "CUSTOM",
      handlerId: PMEGP_HANDLER_IDS.UPGRADATION_MARGIN_MONEY,
      creditLinked: true,
      release: {
        mechanism: "BACK_ENDED",
        installments: [
          {
            installmentNumber: 1,
            percentage: percentage("100"),
            trigger: "LOAN_FIRST_DISBURSEMENT",
            conditions: pmegpUpgradationReleaseLifecycle.claimConditions,
          },
        ],
        conditions: [
          "RELEASED_TO_FINANCING_BANK_NOT_BENEFICIARY",
          "INDEPENDENT_THREE_YEAR_TDR_SRF_LOCK_IN",
          "ADJUSTMENT_REQUIRES_POSITIVE_PHYSICAL_VERIFICATION",
        ],
      },
      sourceReferences: [
        pmegpLevelsOfSupportSource,
        pmegpUpgradationLifecycleSource,
      ],
    },
  ],
  bankFinanceRequirement: {
    requirement: "REQUIRED",
    selfFinanceAllowed: false,
    creditLinkedBenefit: true,
    sourceReferences: [pmegpLevelsOfSupportSource],
  },
  handlerIds: [
    PMEGP_HANDLER_IDS.UPGRADATION_PRIOR_MARGIN_MONEY,
    PMEGP_HANDLER_IDS.ACTIVITY,
    PMEGP_HANDLER_IDS.UPGRADATION_MARGIN_MONEY,
  ],
};
