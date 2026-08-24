import { monetaryAmount, percentage } from "../shared/decimal";
import type { SourceReference } from "../shared/provenance";
import type { MonetaryAmount } from "../shared/types";
import type {
  BenefitKind,
  BenefitReleaseModel,
  FinancingProgramDefinition,
  ProgramConvergenceRule,
} from "../schemes/program";
import {
  classificationTag,
  programId,
  programVersionId,
} from "../schemes/program";
import type { RuleSourceReference } from "../schemes/provenance";
import { FinancingProgramRegistry } from "../schemes/registry";
import type { FundingComposerInput, SourceBackedAmount } from "./contracts";

export const fixtureSource: SourceReference = {
  id: "FUNDING-COMPOSER-FIXTURE",
  type: "USER_INPUT",
};

export const fixtureRuleSource: RuleSourceReference = {
  sourceId: "FUNDING-COMPOSER-RULE",
  authority: "ProjectSetu Test Authority",
  documentTitle: "Funding composer fixture rule",
  sourceType: "MANUAL_VERIFIED_RULE",
  publicationDate: "2024-01-01",
  effectiveDate: "2024-01-01",
};

export function sourcedAmount(value: string): SourceBackedAmount {
  return {
    value: monetaryAmount(value),
    sourceReferences: [fixtureSource],
  };
}

export function fixtureInput(
  overrides: Partial<FundingComposerInput> = {},
): FundingComposerInput {
  return {
    projectId: "PROJECT-1",
    evaluationAsOfDate: "2025-01-01",
    projectCost: {
      totalProjectCost: monetaryAmount("1000000"),
      costItems: [
        {
          costItemId: "MACHINE-A",
          category: "PLANT_AND_MACHINERY",
          tags: [classificationTag("CAPITAL"), classificationTag("MACHINERY")],
          amount: monetaryAmount("1000000"),
          sourceReferences: [fixtureSource],
        },
      ],
    },
    financing: {
      promoterContribution: sourcedAmount("200000"),
      bankFinance: sourcedAmount("800000"),
      otherFinance: [],
    },
    selectedPrograms: [],
    facts: {},
    ...overrides,
  };
}

export function fixtureProgram(input: {
  readonly id: string;
  readonly version?: string;
  readonly effectiveFrom?: string;
  readonly effectiveTo?: string;
  readonly kind?: BenefitKind;
  readonly benefitId?: string;
  readonly rate?: string;
  readonly fixedAmount?: string;
  readonly specificCostItemIds?: readonly string[];
  readonly release?: BenefitReleaseModel;
  readonly programTypes?: FinancingProgramDefinition["programTypes"];
  readonly contributionRequirement?: FinancingProgramDefinition["contributionRequirement"];
  readonly bankFinanceRequirement?: FinancingProgramDefinition["bankFinanceRequirement"];
  readonly eligibility?: FinancingProgramDefinition["eligibility"];
  readonly costEligibilityRules?: FinancingProgramDefinition["costEligibilityRules"];
  readonly noBenefits?: boolean;
}): FinancingProgramDefinition {
  const kind = input.kind ?? "CAPITAL_SUBSIDY";
  const release = input.release ?? { mechanism: "UPFRONT" as const };
  const benefits: FinancingProgramDefinition["benefits"] = input.noBenefits
    ? []
    : input.fixedAmount !== undefined
      ? [
          {
            benefitId: input.benefitId ?? `${input.id}.BENEFIT`,
            name: "Fixture benefit",
            kind,
            basis:
              input.specificCostItemIds === undefined
                ? "FIXED_AMOUNT"
                : "SPECIFIC_COST_COMPONENTS",
            ...(input.specificCostItemIds
              ? { specificCostItemIds: input.specificCostItemIds }
              : {}),
            calculation: "FIXED",
            fixedAmount: monetaryAmount(input.fixedAmount),
            creditLinked: false,
            release,
            sourceReferences: [fixtureRuleSource],
          },
        ]
      : [
          {
            benefitId: input.benefitId ?? `${input.id}.BENEFIT`,
            name: "Fixture benefit",
            kind,
            basis:
              input.specificCostItemIds === undefined
                ? "ELIGIBLE_PROJECT_COST"
                : "SPECIFIC_COST_COMPONENTS",
            ...(input.specificCostItemIds
              ? { specificCostItemIds: input.specificCostItemIds }
              : {}),
            calculation: "PERCENTAGE",
            rate: percentage(input.rate ?? "20"),
            creditLinked: false,
            release,
            sourceReferences: [fixtureRuleSource],
          },
        ];
  return {
    programId: programId(input.id),
    versionId: programVersionId(input.version ?? "v1"),
    displayName: input.id,
    programTypes: input.programTypes ?? ["CAPITAL_SUBSIDY"],
    effectiveFrom: input.effectiveFrom ?? "2024-01-01",
    ...(input.effectiveTo ? { effectiveTo: input.effectiveTo } : {}),
    status: "ACTIVE",
    jurisdiction: { country: "IN" },
    sourceReferences: [fixtureRuleSource],
    eligibility: input.eligibility ?? {
      groupId: `${input.id}.ELIGIBILITY`,
      operator: "ALL",
      rules: [],
    },
    costEligibilityRules: input.costEligibilityRules ?? [],
    benefits,
    ...(input.contributionRequirement
      ? { contributionRequirement: input.contributionRequirement }
      : {}),
    ...(input.bankFinanceRequirement
      ? { bankFinanceRequirement: input.bankFinanceRequirement }
      : {}),
  };
}

export function fixtureCompatibility(input: {
  readonly left: string;
  readonly right: string;
  readonly status?: ProgramConvergenceRule["compatibilityStatus"];
  readonly policy?: ProgramConvergenceRule["sameCostItemPolicy"];
  readonly leftVersions?: readonly string[];
  readonly rightVersions?: readonly string[];
  readonly allowedBenefitTypes?: ProgramConvergenceRule["allowedBenefitTypes"];
  readonly prohibitedBenefitTypes?: ProgramConvergenceRule["prohibitedBenefitTypes"];
}): ProgramConvergenceRule {
  return {
    convergenceRuleId: `RULE.${input.left}.${input.right}`,
    programA: {
      programId: programId(input.left),
      ...(input.leftVersions
        ? { versionIds: input.leftVersions.map(programVersionId) }
        : {}),
    },
    programB: {
      programId: programId(input.right),
      ...(input.rightVersions
        ? { versionIds: input.rightVersions.map(programVersionId) }
        : {}),
    },
    effectiveFrom: "2024-01-01",
    compatibilityStatus: input.status ?? "ALLOWED",
    sameCostItemPolicy: input.policy ?? "ALLOW_UP_TO_COST",
    ...(input.allowedBenefitTypes
      ? { allowedBenefitTypes: input.allowedBenefitTypes }
      : {}),
    ...(input.prohibitedBenefitTypes
      ? { prohibitedBenefitTypes: input.prohibitedBenefitTypes }
      : {}),
    sourceReferences: [fixtureRuleSource],
  };
}

export function registryWith(
  ...definitions: readonly FinancingProgramDefinition[]
): FinancingProgramRegistry {
  const registry = new FinancingProgramRegistry();
  for (const definition of definitions) {
    const result = registry.registerProgramDefinition(definition);
    if (!result.ok)
      throw new Error(result.errors.map((error) => error.code).join(","));
  }
  return registry;
}

export function amount(value: string): MonetaryAmount {
  return monetaryAmount(value);
}
