import { describe, expect, it } from "vitest";

import type { Assumption } from "../shared/assumptions";
import type { CalculationResult } from "../shared/calculation";
import {
  decimalValue,
  monetaryAmount,
  percentage,
  toDecimal,
} from "../shared/decimal";
import type { MonetaryAmount } from "../shared/types";
import { sampleUserSource } from "../testing/domain-fixtures";
import { calculateFinancialBenefits } from "./benefits";
import {
  calculateBankFinanceCompliance,
  calculateContributionCompliance,
} from "./calculations";
import {
  evaluateProgramCompatibility,
  validateAssistanceAllocations,
} from "./compatibility";
import { calculateCostEligibility } from "./cost-eligibility";
import { evaluateProgramEligibility } from "./eligibility";
import { evaluateFinancingProgram, evaluateProgramStack } from "./evaluation";
import type {
  CostAssistanceAllocation,
  CostEligibilityRule,
  EligibilityRuleGroup,
  FinancingProgramDefinition,
  FinancialBenefitDefinition,
  ProgramCompatibilityStatus,
  ProgramConvergenceRule,
  ProgramEvaluationSnapshot,
  ProgramStackEvaluationInput,
  SameCostPolicy,
  SchemeCostItem,
} from "./program";
import { classificationTag, programId, programVersionId } from "./program";
import { FinancingProgramRegistry } from "./registry";
import { ProgramRuleHandlerRegistry } from "./rules";
import {
  capitalTag,
  createTestProgram,
  landTag,
  machineryTag,
  testRuleSource,
  workingCapitalTag,
} from "./testing/test-programs";

function unwrap<TValue>(result: CalculationResult<TValue>): TValue {
  expect(result.ok).toBe(true);
  if (!result.ok)
    throw new Error(result.errors.map((error) => error.code).join());
  return result.value;
}

function expectError<TValue>(
  result: CalculationResult<TValue>,
  code: string,
): void {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected failure.");
  expect(result.errors.map((error) => error.code)).toContain(code);
}

function m(value: string): MonetaryAmount {
  return monetaryAmount(value);
}

function assumedAmount(value: string): Assumption<MonetaryAmount> {
  return { value: m(value), source: sampleUserSource };
}

function costItem(
  costItemId: string,
  category: string,
  amount: string,
  tags: readonly ReturnType<typeof classificationTag>[],
): SchemeCostItem {
  return {
    costItemId,
    category,
    amount: m(amount),
    tags,
    sourceReferences: [sampleUserSource],
  };
}

function standardCosts(): readonly SchemeCostItem[] {
  return [
    costItem("land", "LAND", "100", [landTag]),
    costItem("machine", "MACHINERY", "500", [capitalTag, machineryTag]),
    costItem("working-capital", "WORKING_CAPITAL", "200", [workingCapitalTag]),
  ];
}

function emptyFacts() {
  return {};
}

function eligibleCosts(
  rules: readonly CostEligibilityRule[] = [],
  items = standardCosts(),
) {
  return unwrap(
    calculateCostEligibility({
      costItems: items,
      rules,
      facts: emptyFacts(),
    }),
  );
}

function register(
  ...definitions: readonly FinancingProgramDefinition[]
): FinancingProgramRegistry {
  const registry = new FinancingProgramRegistry();
  for (const definition of definitions) {
    unwrap(registry.registerProgramDefinition(definition));
  }
  return registry;
}

function snapshot(id: string, version = "v1"): ProgramEvaluationSnapshot {
  return {
    programId: programId(id),
    programVersionId: programVersionId(version),
    evaluationAsOfDate: "2025-01-01",
  };
}

function convergenceRule(
  status: ProgramCompatibilityStatus,
  policy: SameCostPolicy = "ALLOW_EXPLICIT_CONVERGENCE",
): ProgramConvergenceRule {
  return {
    convergenceRuleId: `rule-${status}`,
    programA: { programId: programId("TEST.CONVERGENCE_A") },
    programB: { programId: programId("TEST.CONVERGENCE_B") },
    effectiveFrom: "2024-01-01",
    compatibilityStatus: status,
    sameCostItemPolicy: policy,
    sourceReferences: [testRuleSource],
  };
}

describe("eligibility rule engine", () => {
  it("returns rule-level PASS results with source provenance", () => {
    const rules: EligibilityRuleGroup = {
      groupId: "all-rules",
      operator: "ALL",
      rules: [
        {
          ruleId: "entity-rule",
          name: "Entity type",
          type: "ENTITY_TYPE",
          factPath: "applicant.entityType",
          expectedValues: ["PROPRIETORSHIP", "PARTNERSHIP"],
          sourceReferences: [testRuleSource],
        },
        {
          ruleId: "age-rule",
          name: "Minimum age",
          type: "MINIMUM",
          factPath: "applicant.age",
          minimum: decimalValue("18"),
          sourceReferences: [testRuleSource],
        },
      ],
    };
    const result = evaluateProgramEligibility(rules, {
      applicant: { entityType: "PROPRIETORSHIP", age: "25" },
    });
    expect(result.status).toBe("ELIGIBLE");
    expect(
      result.ruleResults.find((rule) => rule.ruleId === "age-rule"),
    ).toMatchObject({
      status: "PASS",
      explanationCode: "RULE_CONDITION_SATISFIED",
      sourceReferences: [testRuleSource],
    });
  });

  it("returns INELIGIBLE with the exact failed rule", () => {
    const rules: EligibilityRuleGroup = {
      groupId: "root",
      operator: "ALL",
      rules: [
        {
          ruleId: "prior-assistance",
          name: "No prior assistance",
          type: "BOOLEAN",
          factPath: "applicant.receivedPriorAssistance",
          expectedValue: false,
          sourceReferences: [testRuleSource],
        },
      ],
    };
    const result = evaluateProgramEligibility(rules, {
      applicant: { receivedPriorAssistance: true },
    });
    expect(result.status).toBe("INELIGIBLE");
    expect(result.ruleResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "prior-assistance", status: "FAIL" }),
      ]),
    );
  });

  it("treats a missing required fact as insufficient information", () => {
    const result = evaluateProgramEligibility(
      {
        groupId: "root",
        operator: "ALL",
        rules: [
          {
            ruleId: "education",
            name: "Education evidence",
            type: "REQUIRED",
            factPath: "applicant.education",
            sourceReferences: [testRuleSource],
          },
        ],
      },
      {},
    );
    expect(result.status).toBe("INSUFFICIENT_INFORMATION");
    expect(result.ruleResults[1]).toMatchObject({
      status: "UNKNOWN",
      explanationCode: "REQUIRED_FACT_MISSING",
    });
  });

  it("supports ALL, ANY, NONE, and conditional-pass composition", () => {
    const result = evaluateProgramEligibility(
      {
        groupId: "all",
        operator: "ALL",
        rules: [
          {
            groupId: "any",
            operator: "ANY",
            rules: [
              {
                ruleId: "manufacturing",
                name: "Manufacturing",
                type: "EQUALS",
                factPath: "project.sector",
                expectedValue: "MANUFACTURING",
                sourceReferences: [testRuleSource],
              },
              {
                ruleId: "service",
                name: "Service",
                type: "EQUALS",
                factPath: "project.sector",
                expectedValue: "SERVICE",
                passAsConditional: true,
                sourceReferences: [testRuleSource],
              },
            ],
          },
          {
            groupId: "none",
            operator: "NONE",
            rules: [
              {
                ruleId: "excluded",
                name: "Excluded activity",
                type: "ACTIVITY_INCLUDED",
                factPath: "activity.tags",
                tags: [classificationTag("EXCLUDED.ACTIVITY")],
                sourceReferences: [testRuleSource],
              },
            ],
          },
        ],
      },
      { project: { sector: "SERVICE" }, activity: { tags: ["SERVICE"] } },
    );
    expect(result.status).toBe("CONDITIONALLY_ELIGIBLE");
  });

  it("supports explicit pure custom predicates and manual review when absent", () => {
    const group: EligibilityRuleGroup = {
      groupId: "root",
      operator: "ALL",
      rules: [
        {
          ruleId: "custom-rule",
          name: "Custom verified rule",
          type: "CUSTOM_PREDICATE",
          predicateId: "custom-predicate",
          sourceReferences: [testRuleSource],
        },
      ],
    };
    expect(evaluateProgramEligibility(group, {}).status).toBe(
      "MANUAL_REVIEW_REQUIRED",
    );
    const handlers = new ProgramRuleHandlerRegistry();
    unwrap(
      handlers.registerEligibilityHandler("custom-predicate", () => ({
        status: "PASS",
        explanationCode: "CUSTOM_RULE_PASSED",
      })),
    );
    expect(evaluateProgramEligibility(group, {}, handlers).status).toBe(
      "ELIGIBLE",
    );
  });

  it("evaluates activity, exclusion, location, range, and date primitives", () => {
    const result = evaluateProgramEligibility(
      {
        groupId: "root",
        operator: "ALL",
        rules: [
          {
            ruleId: "activity",
            name: "Activity included",
            type: "ACTIVITY_INCLUDED",
            factPath: "activity.tags",
            tags: [classificationTag("FOOD_PROCESSING")],
            sourceReferences: [testRuleSource],
          },
          {
            ruleId: "activity-exclusion",
            name: "Trading excluded",
            type: "ACTIVITY_EXCLUDED",
            factPath: "activity.tags",
            tags: [classificationTag("TRADING")],
            sourceReferences: [testRuleSource],
          },
          {
            ruleId: "location",
            name: "Location",
            type: "LOCATION",
            factPath: "location.area",
            expectedValues: ["RURAL"],
            sourceReferences: [testRuleSource],
          },
          {
            ruleId: "cost-range",
            name: "Cost range",
            type: "RANGE",
            factPath: "project.cost",
            minimum: decimalValue("100"),
            maximum: decimalValue("1000"),
            sourceReferences: [testRuleSource],
          },
          {
            ruleId: "date",
            name: "Formation date",
            type: "DATE_RANGE",
            factPath: "enterprise.formationDate",
            from: "2020-01-01",
            until: "2025-12-31",
            sourceReferences: [testRuleSource],
          },
        ],
      },
      {
        activity: { tags: ["FOOD_PROCESSING"] },
        location: { area: "RURAL" },
        project: { cost: "800" },
        enterprise: { formationDate: "2024-06-01" },
      },
    );
    expect(result.status).toBe("ELIGIBLE");
  });
});

describe("cost eligibility engine", () => {
  it("treats all items as eligible when no restriction is configured", () => {
    const result = eligibleCosts();
    expect(result.totalProjectCost).toBe("800");
    expect(result.eligibleProjectCost).toBe("800");
    expect(result.ineligibleProjectCost).toBe("0");
    expect(result.lines.every((line) => line.status === "ELIGIBLE")).toBe(true);
  });

  it("supports all-ineligible and mixed category inclusion", () => {
    const allIneligible = eligibleCosts([
      {
        ruleId: "exclude-all",
        type: "INCLUDE_CATEGORIES",
        categories: ["NOT_PRESENT"],
        sourceReferences: [testRuleSource],
      },
    ]);
    expect(allIneligible.eligibleProjectCost).toBe("0");
    expect(allIneligible.ineligibleProjectCost).toBe("800");

    const mixed = eligibleCosts([
      {
        ruleId: "machinery-only",
        type: "INCLUDE_CATEGORIES",
        categories: ["MACHINERY"],
        sourceReferences: [testRuleSource],
      },
    ]);
    expect(mixed.eligibleProjectCost).toBe("500");
    expect(mixed.ineligibleProjectCost).toBe("300");
  });

  it("supports excluded tags and categories with line-level traces", () => {
    const result = eligibleCosts([
      {
        ruleId: "exclude-land",
        type: "EXCLUDE_TAGS",
        tags: [landTag],
        sourceReferences: [testRuleSource],
      },
      {
        ruleId: "exclude-working-capital",
        type: "EXCLUDE_CATEGORIES",
        categories: ["WORKING_CAPITAL"],
        sourceReferences: [testRuleSource],
      },
    ]);
    expect(result.eligibleProjectCost).toBe("500");
    expect(result.lines[0]!.ruleResults[0]).toMatchObject({
      status: "EXCLUDED",
      sourceReferences: [testRuleSource],
    });
  });

  it("supports partial eligibility through percentage and absolute caps", () => {
    const percentageResult = eligibleCosts(
      [
        {
          ruleId: "fifty-percent",
          type: "PERCENTAGE_CAP",
          percentage: percentage("50"),
          sourceReferences: [testRuleSource],
        },
      ],
      [costItem("machine", "MACHINERY", "500", [machineryTag])],
    );
    expect(percentageResult.lines[0]).toMatchObject({
      status: "PARTIALLY_ELIGIBLE",
      eligibleAmount: "250",
      ineligibleAmount: "250",
    });

    const absoluteResult = eligibleCosts(
      [
        {
          ruleId: "cap",
          type: "ABSOLUTE_CAP",
          amount: m("300"),
          sourceReferences: [testRuleSource],
        },
      ],
      [costItem("machine", "MACHINERY", "500", [machineryTag])],
    );
    expect(absoluteResult.eligibleProjectCost).toBe("300");
  });

  it("supports duration and per-unit cost caps from normalized facts", () => {
    const item = costItem("lease", "RENT", "1200", [classificationTag("RENT")]);
    const result = unwrap(
      calculateCostEligibility({
        costItems: [item],
        rules: [
          {
            ruleId: "six-month-duration",
            type: "DURATION_CAP",
            maximumDuration: decimalValue("6"),
            durationFactPath: "project.leaseMonths",
            sourceReferences: [testRuleSource],
          },
          {
            ruleId: "per-outlet-cap",
            type: "PER_UNIT_CAP",
            maximumAmountPerUnit: m("175"),
            unitCountFactPath: "project.outletCount",
            sourceReferences: [testRuleSource],
          },
        ],
        facts: { project: { leaseMonths: "12", outletCount: "3" } },
      }),
    );
    expect(result.lines[0]).toMatchObject({
      status: "PARTIALLY_ELIGIBLE",
      eligibleAmount: "525",
      ineligibleAmount: "675",
    });
    expect(result.lines[0]!.ruleResults.map((rule) => rule.status)).toEqual([
      "CAPPED",
      "CAPPED",
    ]);
  });

  it("requires manual review when a cost-cap fact is absent", () => {
    const result = unwrap(
      calculateCostEligibility({
        costItems: [
          costItem("rent", "RENT", "100", [classificationTag("RENT")]),
        ],
        rules: [
          {
            ruleId: "duration",
            type: "DURATION_CAP",
            maximumDuration: decimalValue("6"),
            durationFactPath: "project.leaseMonths",
            sourceReferences: [testRuleSource],
          },
        ],
        facts: {},
      }),
    );
    expect(result.lines[0]).toMatchObject({
      status: "MANUAL_REVIEW_REQUIRED",
      eligibleAmount: "100",
    });
  });

  it("reconciles eligible plus ineligible to every line and total exactly", () => {
    const result = eligibleCosts([
      {
        ruleId: "thirty-three",
        type: "PERCENTAGE_CAP",
        percentage: percentage("33.333333333333333333"),
        sourceReferences: [testRuleSource],
      },
    ]);
    for (const line of result.lines) {
      expect(
        toDecimal(line.eligibleAmount).plus(line.ineligibleAmount).toFixed(),
      ).toBe(line.costItem.amount);
    }
    expect(
      toDecimal(result.eligibleProjectCost)
        .plus(result.ineligibleProjectCost)
        .toFixed(),
    ).toBe(result.totalProjectCost);
  });

  it("supports explicit deterministic custom cost handlers", () => {
    const handlers = new ProgramRuleHandlerRegistry();
    unwrap(
      handlers.registerCostHandler(
        "custom-half",
        ({ currentEligibleAmount }) => ({
          eligibleAmount: monetaryAmount(
            toDecimal(currentEligibleAmount).dividedBy("2").toFixed(),
          ),
        }),
      ),
    );
    const result = unwrap(
      calculateCostEligibility({
        costItems: [costItem("machine", "MACHINERY", "500", [machineryTag])],
        rules: [
          {
            ruleId: "custom",
            type: "CUSTOM_RULE",
            handlerId: "custom-half",
            sourceReferences: [testRuleSource],
          },
        ],
        facts: {},
        handlers,
      }),
    );
    expect(result.eligibleProjectCost).toBe("250");
  });

  it("does not let a custom cost rule re-include an amount excluded earlier", () => {
    const handlers = new ProgramRuleHandlerRegistry();
    unwrap(
      handlers.registerCostHandler("custom-reinclude", () => ({
        eligibleAmount: m("1"),
      })),
    );
    expectError(
      calculateCostEligibility({
        costItems: [costItem("land", "LAND", "100", [landTag])],
        rules: [
          {
            ruleId: "exclude-land",
            type: "EXCLUDE_TAGS",
            tags: [landTag],
            sourceReferences: [testRuleSource],
          },
          {
            ruleId: "reinclude",
            type: "CUSTOM_RULE",
            handlerId: "custom-reinclude",
            sourceReferences: [testRuleSource],
          },
        ],
        facts: {},
        handlers,
      }),
      "INVALID_CUSTOM_COST_ELIGIBILITY_AMOUNT",
    );
  });

  it("rejects duplicate cost items, negative amounts, and invalid caps", () => {
    const item = costItem("duplicate", "MACHINERY", "100", [machineryTag]);
    expectError(
      calculateCostEligibility({
        costItems: [item, item],
        rules: [],
        facts: {},
      }),
      "DUPLICATE_SCHEME_COST_ITEM",
    );
    expectError(
      calculateCostEligibility({
        costItems: [{ ...item, amount: m("-1") }],
        rules: [],
        facts: {},
      }),
      "NEGATIVE_SCHEME_COST_ITEM_AMOUNT",
    );
    expectError(
      calculateCostEligibility({
        costItems: [item],
        rules: [
          {
            ruleId: "invalid-rate",
            type: "PERCENTAGE_CAP",
            percentage: percentage("101"),
            sourceReferences: [testRuleSource],
          },
        ],
        facts: {},
      }),
      "INVALID_COST_ELIGIBILITY_PERCENTAGE",
    );
  });
});

describe("benefit calculations", () => {
  const release = { mechanism: "BACK_ENDED" } as const;

  function percentageBenefit(
    overrides: Partial<FinancialBenefitDefinition> = {},
  ): FinancialBenefitDefinition {
    return {
      benefitId: "benefit",
      name: "Generic percentage benefit",
      kind: "CAPITAL_SUBSIDY",
      calculation: "PERCENTAGE",
      basis: "ELIGIBLE_PROJECT_COST",
      rate: percentage("20"),
      creditLinked: false,
      release,
      sourceReferences: [testRuleSource],
      ...overrides,
    } as FinancialBenefitDefinition;
  }

  it("calculates percentage benefits with a machine-readable trace", () => {
    const result = unwrap(
      calculateFinancialBenefits({
        definitions: [percentageBenefit()],
        facts: {},
        costEligibility: eligibleCosts(),
      }),
    )[0]!;
    expect(result).toMatchObject({
      status: "CALCULATED",
      calculatedEligibleBenefit: "160",
      trace: {
        basisAmount: "800",
        rate: "20",
        rawBenefit: "160",
        calculatedEligibleBenefit: "160",
      },
      sourceReferences: [testRuleSource],
    });
  });

  it("supports fixed, zero-rate, zero-basis, and per-unit benefits", () => {
    const definitions: FinancialBenefitDefinition[] = [
      {
        ...percentageBenefit(),
        benefitId: "zero-rate",
        rate: percentage("0"),
      } as FinancialBenefitDefinition,
      {
        ...percentageBenefit(),
        benefitId: "fixed",
        calculation: "FIXED",
        basis: "FIXED_AMOUNT",
        fixedAmount: m("75"),
      } as FinancialBenefitDefinition,
      {
        ...percentageBenefit(),
        benefitId: "per-unit",
        calculation: "PER_UNIT",
        basis: "PER_UNIT",
        amountPerUnit: m("12.5"),
        unitCountFactPath: "activity.units",
      } as FinancialBenefitDefinition,
    ];
    const result = unwrap(
      calculateFinancialBenefits({
        definitions,
        facts: { activity: { units: "4" } },
        costEligibility: eligibleCosts([], []),
      }),
    );
    expect(result.map((benefit) => benefit.calculatedEligibleBenefit)).toEqual([
      "0",
      "75",
      "50",
    ]);
  });

  it("applies minimums, absolute ceilings, and percentage caps without rounding", () => {
    const result = unwrap(
      calculateFinancialBenefits({
        definitions: [
          percentageBenefit({
            rate: percentage("33.333333333333333333"),
            minimumBenefit: m("100"),
            caps: [
              {
                capId: "absolute-cap",
                type: "ABSOLUTE",
                amount: m("123.456789012345678901"),
                sourceReferences: [testRuleSource],
              },
              {
                capId: "basis-cap",
                type: "PERCENTAGE_OF_BASIS",
                percentage: percentage("10"),
                sourceReferences: [testRuleSource],
              },
            ],
          }),
        ],
        facts: {},
        costEligibility: eligibleCosts(),
      }),
    )[0]!;
    expect(result.calculatedEligibleBenefit).toBe("80");
    expect(result.trace!.appliedCaps.map((cap) => cap.capAmount)).toEqual([
      "123.456789012345678901",
      "80",
    ]);
  });

  it("selects an activity-specific cap using normal eligibility rules", () => {
    const capApplicability: EligibilityRuleGroup = {
      groupId: "rural-cap",
      operator: "ALL",
      rules: [
        {
          ruleId: "rural",
          name: "Rural location",
          type: "EQUALS",
          factPath: "location.area",
          expectedValue: "RURAL",
          sourceReferences: [testRuleSource],
        },
      ],
    };
    const definition = percentageBenefit({
      rate: percentage("50"),
      caps: [
        {
          capId: "rural-cap",
          type: "ABSOLUTE",
          amount: m("100"),
          applicability: capApplicability,
          sourceReferences: [testRuleSource],
        },
      ],
    });
    const rural = unwrap(
      calculateFinancialBenefits({
        definitions: [definition],
        facts: { location: { area: "RURAL" } },
        costEligibility: eligibleCosts(),
      }),
    )[0]!;
    const urban = unwrap(
      calculateFinancialBenefits({
        definitions: [definition],
        facts: { location: { area: "URBAN" } },
        costEligibility: eligibleCosts(),
      }),
    )[0]!;
    expect(rural.calculatedEligibleBenefit).toBe("100");
    expect(urban.calculatedEligibleBenefit).toBe("400");
  });

  it("returns insufficient information for missing bank-loan or unit bases", () => {
    const result = unwrap(
      calculateFinancialBenefits({
        definitions: [
          percentageBenefit({ basis: "BANK_LOAN" }),
          {
            ...percentageBenefit(),
            benefitId: "per-unit",
            calculation: "PER_UNIT",
            basis: "PER_UNIT",
            amountPerUnit: m("10"),
            unitCountFactPath: "activity.units",
          } as FinancialBenefitDefinition,
        ],
        facts: {},
        costEligibility: eligibleCosts(),
      }),
    );
    expect(result.map((benefit) => benefit.status)).toEqual([
      "INSUFFICIENT_INFORMATION",
      "INSUFFICIENT_INFORMATION",
    ]);
  });

  it("supports explicit custom benefit handlers without expression evaluation", () => {
    const handlers = new ProgramRuleHandlerRegistry();
    unwrap(handlers.registerBenefitHandler("fixed-custom", () => m("42.25")));
    const result = unwrap(
      calculateFinancialBenefits({
        definitions: [
          {
            ...percentageBenefit(),
            calculation: "CUSTOM",
            basis: "CUSTOM",
            handlerId: "fixed-custom",
          } as FinancialBenefitDefinition,
        ],
        facts: {},
        costEligibility: eligibleCosts(),
        handlers,
      }),
    )[0]!;
    expect(result.calculatedEligibleBenefit).toBe("42.25");
  });

  it("preserves valid release installments and rejects invalid totals", () => {
    const definition = percentageBenefit({
      release: {
        mechanism: "MULTIPLE_INSTALLMENTS",
        installments: [
          {
            installmentNumber: 1,
            percentage: percentage("40"),
            trigger: "LOAN_FIRST_DISBURSEMENT",
          },
          {
            installmentNumber: 2,
            percentage: percentage("60"),
            trigger: "PROJECT_COMPLETION",
          },
        ],
      },
    });
    const result = unwrap(
      calculateFinancialBenefits({
        definitions: [definition],
        facts: {},
        costEligibility: eligibleCosts(),
      }),
    )[0]!;
    expect(result.release).toEqual(definition.release);

    expectError(
      calculateFinancialBenefits({
        definitions: [
          percentageBenefit({
            release: {
              mechanism: "MULTIPLE_INSTALLMENTS",
              installments: [
                {
                  installmentNumber: 1,
                  percentage: percentage("90"),
                  trigger: "SANCTION",
                },
              ],
            },
          }),
        ],
        facts: {},
        costEligibility: eligibleCosts(),
      }),
      "INVALID_BENEFIT_RELEASE_INSTALLMENT_TOTAL",
    );
  });
});

describe("funding constraints", () => {
  it("evaluates contribution above, exactly at, and below a minimum", () => {
    const requirement = {
      basis: "TOTAL_PROJECT_COST",
      minimumPercentage: percentage("10"),
      sourceReferences: [testRuleSource],
    } as const;
    const costEligibility = eligibleCosts();
    expect(
      unwrap(
        calculateContributionCompliance({
          requirement,
          costEligibility,
          actualContribution: assumedAmount("100"),
        }),
      ).status,
    ).toBe("MEETS_REQUIREMENT");
    expect(
      unwrap(
        calculateContributionCompliance({
          requirement,
          costEligibility,
          actualContribution: assumedAmount("80"),
        }),
      ),
    ).toMatchObject({ status: "MEETS_REQUIREMENT", shortfall: "0" });
    expect(
      unwrap(
        calculateContributionCompliance({
          requirement,
          costEligibility,
          actualContribution: assumedAmount("50"),
        }),
      ),
    ).toMatchObject({ status: "BELOW_REQUIREMENT", shortfall: "30" });
  });

  it("supports zero contribution requirement without inventing a contribution", () => {
    const result = unwrap(
      calculateContributionCompliance({
        requirement: {
          basis: "ELIGIBLE_PROJECT_COST",
          minimumPercentage: percentage("0"),
          sourceReferences: [testRuleSource],
        },
        costEligibility: eligibleCosts(),
      }),
    );
    expect(result).toMatchObject({
      status: "NOT_APPLICABLE",
      requiredMinimumContribution: "0",
      shortfall: "0",
    });
    expect(result).not.toHaveProperty("actualContribution");
  });

  it("does not mutate a below-minimum contribution", () => {
    const result = unwrap(
      calculateContributionCompliance({
        requirement: {
          basis: "TOTAL_PROJECT_COST",
          minimumAmount: m("100"),
          sourceReferences: [testRuleSource],
        },
        costEligibility: eligibleCosts(),
        actualContribution: assumedAmount("60"),
      }),
    );
    expect(result.actualContribution).toBe("60");
    expect(result.shortfall).toBe("40");
  });

  it("evaluates required, minimum, maximum, and prohibited bank finance", () => {
    const base = {
      requirement: "REQUIRED",
      selfFinanceAllowed: false,
      creditLinkedBenefit: true,
      sourceReferences: [testRuleSource],
    } as const;
    expect(
      unwrap(
        calculateBankFinanceCompliance({
          requirement: { ...base, minimumAmount: m("100") },
          actualBankFinance: assumedAmount("50"),
        }),
      ).status,
    ).toBe("BELOW_MINIMUM");
    expect(
      unwrap(
        calculateBankFinanceCompliance({
          requirement: { ...base, maximumAmount: m("500") },
          actualBankFinance: assumedAmount("600"),
        }),
      ).status,
    ).toBe("ABOVE_MAXIMUM");
    expect(
      unwrap(
        calculateBankFinanceCompliance({
          requirement: {
            ...base,
            requirement: "NOT_PERMITTED",
            selfFinanceAllowed: true,
          },
          actualBankFinance: assumedAmount("1"),
        }),
      ).status,
    ).toBe("FINANCE_NOT_PERMITTED");
  });

  it("requires source-backed actual financing and never infers a loan", () => {
    expectError(
      calculateContributionCompliance({
        costEligibility: eligibleCosts(),
        actualContribution: { value: m("10") } as Assumption<MonetaryAmount>,
      }),
      "MISSING_PROGRAM_FINANCING_SOURCE",
    );
    const result = unwrap(
      calculateBankFinanceCompliance({
        requirement: {
          requirement: "REQUIRED",
          selfFinanceAllowed: false,
          creditLinkedBenefit: true,
          sourceReferences: [testRuleSource],
        },
      }),
    );
    expect(result.status).toBe("INSUFFICIENT_INFORMATION");
    expect(result).not.toHaveProperty("actualBankFinance");
  });
});

describe("compatibility and convergence", () => {
  it("supports every configured compatibility status", () => {
    const statuses: readonly ProgramCompatibilityStatus[] = [
      "ALLOWED",
      "PROHIBITED",
      "ALLOWED_WITH_CONDITIONS",
      "ALLOWED_FOR_DISTINCT_COSTS",
      "ALLOWED_FOR_DISTINCT_BENEFIT_TYPES",
      "OFFICIAL_CONVERGENCE_SUPPORTED",
      "REQUIRES_MANUAL_REVIEW",
    ];
    for (const status of statuses) {
      expect(
        evaluateProgramCompatibility({
          programA: snapshot("TEST.CONVERGENCE_A"),
          programB: snapshot("TEST.CONVERGENCE_B"),
          asOfDate: "2025-01-01",
          rules: [convergenceRule(status)],
        }).status,
      ).toBe(status);
    }
  });

  it("treats a missing compatibility rule as UNKNOWN", () => {
    const result = evaluateProgramCompatibility({
      programA: snapshot("TEST.CONVERGENCE_A"),
      programB: snapshot("TEST.CONVERGENCE_B"),
      asOfDate: "2025-01-01",
      rules: [],
    });
    expect(result).toMatchObject({
      status: "UNKNOWN",
      sameCostItemPolicy: "MANUAL_REVIEW",
    });
  });

  it("resolves compatibility by program versions and effective date", () => {
    const oldRule = {
      ...convergenceRule("PROHIBITED"),
      effectiveTo: "2024-12-31",
    };
    const newRule = {
      ...convergenceRule("OFFICIAL_CONVERGENCE_SUPPORTED"),
      convergenceRuleId: "new-rule",
      effectiveFrom: "2025-01-01",
      programA: {
        programId: programId("TEST.CONVERGENCE_A"),
        versionIds: [programVersionId("v2")],
      },
    };
    const result = evaluateProgramCompatibility({
      programA: snapshot("TEST.CONVERGENCE_A", "v2"),
      programB: snapshot("TEST.CONVERGENCE_B"),
      asOfDate: "2025-06-01",
      rules: [oldRule, newRule],
    });
    expect(result.status).toBe("OFFICIAL_CONVERGENCE_SUPPORTED");
    expect(result.convergenceRuleId).toBe("new-rule");
  });
});

describe("assistance allocation and double-funding safeguards", () => {
  const item = costItem("machine", "MACHINERY", "100", [machineryTag]);
  const allocationA: CostAssistanceAllocation = {
    costItemId: "machine",
    programId: programId("TEST.CONVERGENCE_A"),
    programVersionId: programVersionId("v1"),
    benefitId: "benefit-a",
    benefitKind: "CAPITAL_SUBSIDY",
    eligibleBasisAmount: m("100"),
    benefitAmount: m("30"),
    allocationType: "FULL_COST_BASIS",
  };
  const allocationB: CostAssistanceAllocation = {
    ...allocationA,
    programId: programId("TEST.CONVERGENCE_B"),
    benefitId: "benefit-b",
    benefitAmount: m("20"),
  };

  function compatibility(
    policy: SameCostPolicy,
    status: ProgramCompatibilityStatus = "ALLOWED",
  ) {
    return evaluateProgramCompatibility({
      programA: snapshot("TEST.CONVERGENCE_A"),
      programB: snapshot("TEST.CONVERGENCE_B"),
      asOfDate: "2025-01-01",
      rules: [convergenceRule(status, policy)],
    });
  }

  it("detects prohibited same-cost double assistance", () => {
    const conflicts = validateAssistanceAllocations({
      allocations: [allocationA, allocationB],
      costItems: [item],
      compatibilityResults: [compatibility("NO_DOUBLE_ASSISTANCE")],
    });
    expect(conflicts.map((conflict) => conflict.code)).toContain(
      "DOUBLE_FUNDING_CONFLICT",
    );
  });

  it("allows different cost items under a distinct-cost rule", () => {
    const conflicts = validateAssistanceAllocations({
      allocations: [allocationA, { ...allocationB, costItemId: "building" }],
      costItems: [item, costItem("building", "BUILDING", "100", [capitalTag])],
      compatibilityResults: [
        compatibility("NO_DOUBLE_ASSISTANCE", "ALLOWED_FOR_DISTINCT_COSTS"),
      ],
    });
    expect(conflicts).toEqual([]);
  });

  it("allows explicitly identified distinct portions within the cost amount", () => {
    const conflicts = validateAssistanceAllocations({
      allocations: [
        {
          ...allocationA,
          eligibleBasisAmount: m("60"),
          allocationType: "DISTINCT_PORTION",
          portionId: "portion-a",
        },
        {
          ...allocationB,
          eligibleBasisAmount: m("40"),
          allocationType: "DISTINCT_PORTION",
          portionId: "portion-b",
        },
      ],
      costItems: [item],
      compatibilityResults: [compatibility("DISTINCT_COST_PORTIONS_ONLY")],
    });
    expect(conflicts).toEqual([]);

    const overlapping = validateAssistanceAllocations({
      allocations: [
        {
          ...allocationA,
          eligibleBasisAmount: m("70"),
          allocationType: "DISTINCT_PORTION",
          portionId: "portion-a",
        },
        {
          ...allocationB,
          eligibleBasisAmount: m("40"),
          allocationType: "DISTINCT_PORTION",
          portionId: "portion-b",
        },
      ],
      costItems: [item],
      compatibilityResults: [compatibility("DISTINCT_COST_PORTIONS_ONLY")],
    });
    expect(overlapping.map((conflict) => conflict.code)).toContain(
      "OVERLAPPING_COST_BASIS",
    );
  });

  it("allows explicit convergence but rejects assistance above cost", () => {
    expect(
      validateAssistanceAllocations({
        allocations: [allocationA, allocationB],
        costItems: [item],
        compatibilityResults: [
          compatibility(
            "ALLOW_EXPLICIT_CONVERGENCE",
            "OFFICIAL_CONVERGENCE_SUPPORTED",
          ),
        ],
      }),
    ).toEqual([]);

    const conflicts = validateAssistanceAllocations({
      allocations: [
        { ...allocationA, benefitAmount: m("70") },
        { ...allocationB, benefitAmount: m("40") },
      ],
      costItems: [item],
      compatibilityResults: [compatibility("ALLOW_UP_TO_COST")],
    });
    expect(conflicts.map((conflict) => conflict.code)).toContain(
      "DOUBLE_FUNDING_CONFLICT",
    );
  });

  it("distinguishes same and different benefit types", () => {
    const sameType = validateAssistanceAllocations({
      allocations: [allocationA, allocationB],
      costItems: [item],
      compatibilityResults: [
        compatibility(
          "ALLOW_DIFFERENT_BENEFIT_TYPES",
          "ALLOWED_FOR_DISTINCT_BENEFIT_TYPES",
        ),
      ],
    });
    expect(sameType.map((conflict) => conflict.code)).toContain(
      "INCOMPATIBLE_BENEFITS",
    );
    const differentType = validateAssistanceAllocations({
      allocations: [
        allocationA,
        { ...allocationB, benefitKind: "INTEREST_SUBVENTION" },
      ],
      costItems: [item],
      compatibilityResults: [
        compatibility(
          "ALLOW_DIFFERENT_BENEFIT_TYPES",
          "ALLOWED_FOR_DISTINCT_BENEFIT_TYPES",
        ),
      ],
    });
    expect(differentType).toEqual([]);
  });
});

describe("program and stack evaluation", () => {
  function stackInput(
    selectedPrograms: ProgramStackEvaluationInput["selectedPrograms"],
  ): ProgramStackEvaluationInput {
    return {
      projectId: "project-013",
      evaluationAsOfDate: "2025-06-01",
      selectedPrograms,
      facts: {},
      costItems: [costItem("machine", "MACHINERY", "1000", [capitalTag])],
      actualBeneficiaryContribution: assumedAmount("200"),
      actualBankFinance: assumedAmount("800"),
    };
  }

  it("supports a permanent no-scheme Bankable Project mode", () => {
    const result = unwrap(
      evaluateProgramStack(stackInput([]), new FinancingProgramRegistry(), []),
    );
    expect(result).toEqual({
      projectId: "project-013",
      mode: "BANKABLE_PROJECT",
      selectedPrograms: [],
      individualEvaluations: [],
      compatibilityResults: [],
      allocations: [],
      conflicts: [],
      warnings: [],
      manualReviewItems: [],
      combinedCalculatedEligibleBenefits: "0",
      combinedEligibleBenefits: "0",
    });
  });

  it("registers and evaluates a new custom program without engine switches", () => {
    const definition = createTestProgram({
      programId: programId("CUSTOM.CONSULTANT_PROGRAM"),
      programTypes: ["CUSTOM"],
    });
    const registry = register(definition);
    const result = unwrap(
      evaluateFinancingProgram(
        {
          projectId: "project-013",
          selection: {
            programId: definition.programId,
            versionId: definition.versionId,
          },
          evaluationAsOfDate: "2025-01-01",
          facts: {},
          costItems: [costItem("machine", "MACHINERY", "1000", [capitalTag])],
        },
        registry,
      ),
    );
    expect(result.totalCalculatedEligibleBenefit).toBe("200");
    expect(result.programTypes).toEqual(["CUSTOM"]);
  });

  it("applies an overall program ceiling with a source-backed trace", () => {
    const definition = createTestProgram({
      overallBenefitCap: {
        amount: m("150"),
        sourceReferences: [testRuleSource],
      },
    });
    const result = unwrap(
      evaluateFinancingProgram(
        {
          projectId: "project-013",
          selection: {
            programId: definition.programId,
            versionId: definition.versionId,
          },
          evaluationAsOfDate: "2025-01-01",
          facts: {},
          costItems: [costItem("machine", "MACHINERY", "1000", [capitalTag])],
        },
        register(definition),
      ),
    );
    expect(result.totalCalculatedEligibleBenefit).toBe("150");
    expect(result.appliedOverallBenefitCap).toEqual({
      calculatedBeforeCap: "200",
      capAmount: "150",
      calculatedAfterCap: "150",
      sourceReferences: [testRuleSource],
    });
  });

  it("reproduces old and new program-version rates", () => {
    const v1 = createTestProgram({
      versionId: programVersionId("v1"),
      effectiveTo: "2024-12-31",
      status: "SUPERSEDED",
    });
    const v2 = createTestProgram({
      versionId: programVersionId("v2"),
      effectiveFrom: "2025-01-01",
      benefits: [
        {
          ...createTestProgram().benefits[0]!,
          rate: percentage("30"),
        } as FinancialBenefitDefinition,
      ],
    });
    const registry = register(v1, v2);
    const historical = unwrap(
      evaluateFinancingProgram(
        {
          ...stackInput([]),
          selection: { programId: v1.programId, versionId: v1.versionId },
          evaluationAsOfDate: "2024-06-01",
        },
        registry,
      ),
    );
    const current = unwrap(
      evaluateFinancingProgram(
        {
          ...stackInput([]),
          selection: { programId: v2.programId },
        },
        registry,
      ),
    );
    expect(historical.totalCalculatedEligibleBenefit).toBe("200");
    expect(current.totalCalculatedEligibleBenefit).toBe("300");
  });

  it("supports credit-only, interest-subvention, and credit-guarantee programs", () => {
    for (const [id, type] of [
      ["TEST.CREDIT_ONLY", "CREDIT_PROGRAM"],
      ["TEST.INTEREST_ONLY", "INTEREST_SUBVENTION"],
      ["TEST.GUARANTEE_ONLY", "CREDIT_GUARANTEE"],
    ] as const) {
      const definition = createTestProgram({
        programId: programId(id),
        programTypes: [type],
        benefits:
          type === "CREDIT_PROGRAM"
            ? []
            : [
                {
                  ...createTestProgram().benefits[0]!,
                  benefitId: `${id}-benefit`,
                  kind:
                    type === "INTEREST_SUBVENTION"
                      ? "INTEREST_SUBVENTION"
                      : "CREDIT_GUARANTEE",
                },
              ],
      });
      const evaluation = unwrap(
        evaluateFinancingProgram(
          {
            projectId: "project-013",
            selection: {
              programId: definition.programId,
              versionId: definition.versionId,
            },
            evaluationAsOfDate: "2025-01-01",
            facts: {},
            costItems: [costItem("machine", "MACHINERY", "100", [capitalTag])],
          },
          register(definition),
        ),
      );
      expect(evaluation.programTypes).toEqual([type]);
      expect(evaluation.totalCalculatedEligibleBenefit).toBe(
        type === "CREDIT_PROGRAM" ? "0" : "20",
      );
    }
  });

  it("combines subsidy and interest subvention only under an explicit rule", () => {
    const subsidy = createTestProgram({
      programId: programId("TEST.CONVERGENCE_A"),
    });
    const interest = createTestProgram({
      programId: programId("TEST.CONVERGENCE_B"),
      programTypes: ["INTEREST_SUBVENTION"],
      benefits: [
        {
          ...createTestProgram().benefits[0]!,
          benefitId: "interest-benefit",
          kind: "INTEREST_SUBVENTION",
        },
      ],
    });
    const rule = {
      ...convergenceRule(
        "ALLOWED_FOR_DISTINCT_BENEFIT_TYPES",
        "ALLOW_DIFFERENT_BENEFIT_TYPES",
      ),
      allowedBenefitTypes: ["CAPITAL_SUBSIDY", "INTEREST_SUBVENTION"] as const,
    };
    const result = unwrap(
      evaluateProgramStack(
        stackInput([
          { programId: subsidy.programId, versionId: subsidy.versionId },
          { programId: interest.programId, versionId: interest.versionId },
        ]),
        register(subsidy, interest),
        [rule],
      ),
    );
    expect(result.conflicts).toEqual([]);
    expect(result.combinedEligibleBenefits).toBe("400");
  });

  it("supports credit plus subsidy when compatibility explicitly permits it", () => {
    const subsidy = createTestProgram({
      programId: programId("TEST.CONVERGENCE_A"),
    });
    const credit = createTestProgram({
      programId: programId("TEST.CONVERGENCE_B"),
      programTypes: ["CREDIT_PROGRAM"],
      benefits: [],
    });
    const result = unwrap(
      evaluateProgramStack(
        stackInput([
          { programId: subsidy.programId },
          { programId: credit.programId },
        ]),
        register(subsidy, credit),
        [convergenceRule("ALLOWED")],
      ),
    );
    expect(result.conflicts).toEqual([]);
    expect(result.combinedEligibleBenefits).toBe("200");
  });

  it("enforces benefit-type compatibility even for a non-cost benefit basis", () => {
    const subsidy = createTestProgram({
      programId: programId("TEST.CONVERGENCE_A"),
    });
    const interestTemplate = createTestProgram().benefits[0]!;
    const interest = createTestProgram({
      programId: programId("TEST.CONVERGENCE_B"),
      programTypes: ["INTEREST_SUBVENTION"],
      benefits: [
        {
          ...interestTemplate,
          benefitId: "fixed-interest-support",
          kind: "INTEREST_SUBVENTION",
          basis: "FIXED_AMOUNT",
          calculation: "FIXED",
          fixedAmount: m("10"),
        },
      ],
    });
    const result = unwrap(
      evaluateProgramStack(
        stackInput([
          { programId: subsidy.programId },
          { programId: interest.programId },
        ]),
        register(subsidy, interest),
        [
          {
            ...convergenceRule("ALLOWED"),
            allowedBenefitTypes: ["CAPITAL_SUBSIDY"],
          },
        ],
      ),
    );
    expect(result.conflicts).toEqual([
      expect.objectContaining({
        code: "INCOMPATIBLE_BENEFITS",
        benefitIds: ["fixed-interest-support"],
      }),
    ]);
    expect(result).not.toHaveProperty("combinedEligibleBenefits");
  });

  it("never silently allows unknown or prohibited combinations", () => {
    const left = createTestProgram({
      programId: programId("TEST.CONVERGENCE_A"),
    });
    const right = createTestProgram({
      programId: programId("TEST.CONVERGENCE_B"),
    });
    const registry = register(left, right);
    const selections = [
      { programId: left.programId },
      { programId: right.programId },
    ];
    const unknown = unwrap(
      evaluateProgramStack(stackInput(selections), registry, []),
    );
    expect(unknown.conflicts.map((conflict) => conflict.code)).toContain(
      "MISSING_CONVERGENCE_RULE",
    );
    expect(unknown).not.toHaveProperty("combinedEligibleBenefits");

    const prohibited = unwrap(
      evaluateProgramStack(stackInput(selections), registry, [
        convergenceRule("PROHIBITED", "NO_DOUBLE_ASSISTANCE"),
      ]),
    );
    expect(prohibited.conflicts.map((conflict) => conflict.code)).toContain(
      "PROGRAM_CONFLICT",
    );
  });
});
