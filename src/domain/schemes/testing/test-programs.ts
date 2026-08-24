import { monetaryAmount, percentage } from "../../shared/decimal";
import type { FinancingProgramDefinition } from "../program";
import { classificationTag, programId, programVersionId } from "../program";
import type { RuleSourceReference } from "../provenance";

export const testRuleSource: RuleSourceReference = {
  sourceId: "test-rule-source",
  authority: "ProjectSetu Test Authority",
  documentTitle: "Generic Program Test Rules",
  sourceType: "MANUAL_VERIFIED_RULE",
  documentVersion: "1",
  effectiveDate: "2024-01-01",
  pageOrReference: "TEST-SECTION-1",
};

export function createTestProgram(
  overrides: Partial<FinancingProgramDefinition> = {},
): FinancingProgramDefinition {
  return {
    programId: programId("TEST.CAPITAL_SUBSIDY"),
    versionId: programVersionId("v1"),
    displayName: "Test Capital Subsidy",
    programTypes: ["CAPITAL_SUBSIDY"],
    effectiveFrom: "2024-01-01",
    status: "ACTIVE",
    jurisdiction: { country: "IN" },
    sourceReferences: [testRuleSource],
    eligibility: {
      groupId: "test-eligibility",
      operator: "ALL",
      rules: [],
    },
    costEligibilityRules: [],
    benefits: [
      {
        benefitId: "capital-benefit",
        name: "Capital assistance",
        kind: "CAPITAL_SUBSIDY",
        calculation: "PERCENTAGE",
        basis: "ELIGIBLE_PROJECT_COST",
        rate: percentage("20"),
        creditLinked: false,
        release: { mechanism: "BACK_ENDED" },
        sourceReferences: [testRuleSource],
      },
    ],
    ...overrides,
  };
}

export const capitalTag = classificationTag("CAPITAL");
export const machineryTag = classificationTag("MACHINERY");
export const landTag = classificationTag("LAND");
export const workingCapitalTag = classificationTag("WORKING_CAPITAL");

export const zeroAmount = monetaryAmount("0");
