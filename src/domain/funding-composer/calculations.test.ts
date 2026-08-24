import { describe, expect, it } from "vitest";

import { monetaryAmount, percentage } from "../shared/decimal";
import { programId, programVersionId } from "../schemes/program";
import { composeMultiProgramFunding } from "./calculations";
import type { FundingComposerCalculationResult } from "./contracts";
import {
  amount,
  fixtureCompatibility,
  fixtureInput,
  fixtureProgram,
  fixtureRuleSource,
  registryWith,
  sourcedAmount,
} from "./test-fixtures";

function unwrap(result: FundingComposerCalculationResult) {
  if (!result.ok)
    throw new Error(result.errors.map((error) => error.code).join(","));
  return result.value;
}

describe("multi-program funding composition", () => {
  it("keeps a no-scheme bankable project as a first-class resolved mode", () => {
    const result = unwrap(
      composeMultiProgramFunding(fixtureInput(), registryWith(), []),
    );

    expect(result.mode).toBe("BANKABLE_PROJECT");
    expect(result.warnings).toEqual([]);
    expect(result.resolutionStatus).toBe("RESOLVED");
    expect(result.individualProgramEvaluations).toEqual([]);
    expect(result.compatibilityEvaluations).toEqual([]);
    expect(result.allocationLedger).toEqual([]);
    expect(result.summary.benefits.totalCalculatedCashBenefits).toBe("0");
    expect(result.summary.remainingInitialFundingRequirement).toBe("0");
  });

  it("reports an initial funding gap without inventing balancing finance", () => {
    const result = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          financing: {
            promoterContribution: sourcedAmount("100000"),
            bankFinance: sourcedAmount("500000"),
            otherFinance: [],
          },
        }),
        registryWith(),
        [],
      ),
    );

    expect(result.summary.actualPromoterContribution).toBe("100000");
    expect(result.summary.actualBankFinance).toBe("500000");
    expect(result.summary.remainingInitialFundingRequirement).toBe("400000");
    expect(result.warnings.map((warning) => warning.code)).toContain(
      "INITIAL_FUNDING_GAP_REMAINS",
    );
  });

  it("uses the same composer for one back-ended subsidy without treating it as initial cash", () => {
    const subsidy = fixtureProgram({
      id: "TEST.SUBSIDY",
      release: { mechanism: "BACK_ENDED" },
      contributionRequirement: {
        basis: "TOTAL_PROJECT_COST",
        minimumPercentage: percentage("10"),
        sourceReferences: [fixtureRuleSource],
      },
    });
    const result = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          selectedPrograms: [{ programId: subsidy.programId }],
        }),
        registryWith(subsidy),
        [],
      ),
    );

    expect(result.mode).toBe("SINGLE_PROGRAM");
    expect(
      result.individualProgramEvaluations[0]?.evaluation
        ?.totalCalculatedEligibleBenefit,
    ).toBe("200000");
    expect(result.summary.benefits.totalCalculatedCashBenefits).toBe("200000");
    expect(result.summary.benefits.totalDeferredConditionalAssistance).toBe(
      "200000",
    );
    expect(result.summary.benefits.totalInitiallyAvailableAssistance).toBe("0");
    expect(result.warnings.map((warning) => warning.code)).toContain(
      "BENEFIT_NOT_AVAILABLE_AS_INITIAL_FUNDING",
    );
  });

  it("composes explicitly compatible subsidy and credit without turning credit into subsidy", () => {
    const subsidy = fixtureProgram({ id: "TEST.SUBSIDY", rate: "10" });
    const credit = fixtureProgram({
      id: "TEST.CREDIT",
      programTypes: ["CREDIT_PROGRAM"],
      noBenefits: true,
      bankFinanceRequirement: {
        requirement: "REQUIRED",
        selfFinanceAllowed: false,
        maximumAmount: amount("900000"),
        creditLinkedBenefit: false,
        sourceReferences: [fixtureRuleSource],
      },
    });
    const input = fixtureInput({
      financing: {
        promoterContribution: sourcedAmount("100000"),
        bankFinance: sourcedAmount("800000"),
        otherFinance: [],
      },
      selectedPrograms: [
        { programId: subsidy.programId },
        { programId: credit.programId },
      ],
    });
    const result = unwrap(
      composeMultiProgramFunding(input, registryWith(subsidy, credit), [
        fixtureCompatibility({ left: "TEST.SUBSIDY", right: "TEST.CREDIT" }),
      ]),
    );

    expect(result.mode).toBe("MULTI_PROGRAM");
    expect(result.compatibilityEvaluations[0]?.status).toBe("COMPATIBLE");
    expect(result.summary.actualBankFinance).toBe("800000");
    expect(result.summary.benefits.capitalSubsidy).toBe("100000");
    expect(result.summary.benefits.totalInitiallyAvailableAssistance).toBe(
      "100000",
    );
    expect(result.summary.remainingInitialFundingRequirement).toBe("0");
    expect(
      result.individualProgramEvaluations.find(
        (program) => program.snapshot?.programId === credit.programId,
      )?.evaluation?.benefits,
    ).toEqual([]);
  });

  it("does not infer subsidy plus credit compatibility from benefit types", () => {
    const subsidy = fixtureProgram({ id: "TEST.SUBSIDY" });
    const credit = fixtureProgram({
      id: "TEST.CREDIT",
      programTypes: ["CREDIT_PROGRAM"],
      noBenefits: true,
    });
    const result = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          selectedPrograms: [
            { programId: subsidy.programId },
            { programId: credit.programId },
          ],
        }),
        registryWith(subsidy, credit),
        [],
      ),
    );

    expect(result.compatibilityEvaluations[0]?.status).toBe("UNKNOWN");
    expect(result.resolutionStatus).toBe("MANUAL_REVIEW_REQUIRED");
    expect(result.manualReviewItems.map((item) => item.code)).toContain(
      "COMPATIBILITY_EVIDENCE_NOT_FOUND",
    );
  });

  it("keeps credit guarantee and interest subvention outside initial funding", () => {
    const guarantee = fixtureProgram({
      id: "TEST.GUARANTEE",
      kind: "CREDIT_GUARANTEE",
      fixedAmount: "300000",
      programTypes: ["CREDIT_GUARANTEE"],
      release: { mechanism: "CUSTOM_CONDITIONAL" },
    });
    const interest = fixtureProgram({
      id: "TEST.INTEREST",
      kind: "INTEREST_SUBVENTION",
      fixedAmount: "50000",
      programTypes: ["INTEREST_SUBVENTION"],
      release: { mechanism: "POST_DISBURSEMENT" },
    });
    const result = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          selectedPrograms: [
            { programId: guarantee.programId },
            { programId: interest.programId },
          ],
        }),
        registryWith(guarantee, interest),
        [
          fixtureCompatibility({
            left: "TEST.GUARANTEE",
            right: "TEST.INTEREST",
          }),
        ],
      ),
    );

    expect(result.summary.benefits.creditGuarantee).toBe("300000");
    expect(result.summary.benefits.interestSubvention).toBe("50000");
    expect(result.summary.benefits.totalCalculatedCashBenefits).toBe("0");
    expect(result.summary.totalInitialFundingSources).toBe("1000000");
    expect(result.summary.remainingInitialFundingRequirement).toBe("0");
  });

  it("reports contribution shortfall without mutating actual contribution", () => {
    const program = fixtureProgram({
      id: "TEST.CONTRIBUTION",
      noBenefits: true,
      contributionRequirement: {
        basis: "TOTAL_PROJECT_COST",
        minimumPercentage: percentage("20"),
        sourceReferences: [fixtureRuleSource],
      },
    });
    const input = fixtureInput({
      financing: {
        promoterContribution: sourcedAmount("150000"),
        bankFinance: sourcedAmount("850000"),
        otherFinance: [],
      },
      selectedPrograms: [{ programId: program.programId }],
    });
    const result = unwrap(
      composeMultiProgramFunding(input, registryWith(program), []),
    );

    expect(result.summary.actualPromoterContribution).toBe("150000");
    expect(result.summary.requiredPromoterContribution).toBe("200000");
    expect(result.summary.contributionShortfall).toBe("50000");
    expect(result.conflicts.map((conflict) => conflict.code)).toContain(
      "CONTRIBUTION_CONSTRAINT_CONFLICT",
    );
  });

  it("takes the maximum independent contribution constraint rather than adding rates", () => {
    const totalCost = fixtureProgram({
      id: "TEST.CONTRIBUTION_A",
      noBenefits: true,
      contributionRequirement: {
        basis: "TOTAL_PROJECT_COST",
        minimumPercentage: percentage("10"),
        sourceReferences: [fixtureRuleSource],
      },
    });
    const eligibleCost = fixtureProgram({
      id: "TEST.CONTRIBUTION_B",
      noBenefits: true,
      costEligibilityRules: [
        {
          ruleId: "HALF-COST-CAP",
          type: "PERCENTAGE_CAP",
          percentage: percentage("50"),
          sourceReferences: [fixtureRuleSource],
        },
      ],
      contributionRequirement: {
        basis: "ELIGIBLE_PROJECT_COST",
        minimumPercentage: percentage("20"),
        sourceReferences: [fixtureRuleSource],
      },
    });
    const result = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          financing: {
            promoterContribution: sourcedAmount("100000"),
            bankFinance: sourcedAmount("900000"),
            otherFinance: [],
          },
          selectedPrograms: [
            { programId: totalCost.programId },
            { programId: eligibleCost.programId },
          ],
        }),
        registryWith(totalCost, eligibleCost),
        [
          fixtureCompatibility({
            left: "TEST.CONTRIBUTION_A",
            right: "TEST.CONTRIBUTION_B",
          }),
        ],
      ),
    );

    expect(
      result.contributionConstraints.map((item) => item.requiredContribution),
    ).toEqual(["100000", "100000"]);
    expect(result.summary.requiredPromoterContribution).toBe("100000");
    expect(result.summary.contributionShortfall).toBe("0");
  });

  it("detects required-versus-prohibited bank finance constraints", () => {
    const required = fixtureProgram({
      id: "TEST.BANK_REQUIRED",
      noBenefits: true,
      bankFinanceRequirement: {
        requirement: "REQUIRED",
        selfFinanceAllowed: false,
        creditLinkedBenefit: false,
        sourceReferences: [fixtureRuleSource],
      },
    });
    const prohibited = fixtureProgram({
      id: "TEST.BANK_PROHIBITED",
      noBenefits: true,
      bankFinanceRequirement: {
        requirement: "NOT_PERMITTED",
        selfFinanceAllowed: true,
        creditLinkedBenefit: false,
        sourceReferences: [fixtureRuleSource],
      },
    });
    const result = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          selectedPrograms: [
            { programId: required.programId },
            { programId: prohibited.programId },
          ],
        }),
        registryWith(required, prohibited),
        [
          fixtureCompatibility({
            left: "TEST.BANK_REQUIRED",
            right: "TEST.BANK_PROHIBITED",
          }),
        ],
      ),
    );

    expect(result.conflicts.map((conflict) => conflict.code)).toContain(
      "BANK_FINANCE_CONSTRAINT_CONFLICT",
    );
    expect(result.summary.actualBankFinance).toBe("800000");
  });

  it("enforces credit limits without increasing actual credit to the maximum", () => {
    const credit = fixtureProgram({
      id: "TEST.CREDIT_LIMIT",
      programTypes: ["CREDIT_PROGRAM"],
      noBenefits: true,
      bankFinanceRequirement: {
        requirement: "REQUIRED",
        selfFinanceAllowed: false,
        maximumAmount: amount("500000"),
        creditLinkedBenefit: false,
        sourceReferences: [fixtureRuleSource],
      },
    });
    const result = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          financing: {
            promoterContribution: sourcedAmount("200000"),
            bankFinance: sourcedAmount("800000"),
            requestedCredit: sourcedAmount("800000"),
            otherFinance: [],
          },
          selectedPrograms: [{ programId: credit.programId }],
        }),
        registryWith(credit),
        [],
      ),
    );

    expect(result.summary.actualBankFinance).toBe("800000");
    expect(result.summary.maximumPermittedBankFinance).toBe("500000");
    expect(result.bankFinanceConstraints[0]?.compliance).toBe("ABOVE_MAXIMUM");
    expect(result.bankFinanceConstraints[0]?.requestedCredit).toBe("800000");
    expect(result.bankFinanceConstraints[0]?.maximumEligibleCredit).toBe(
      "500000",
    );
    expect(result.bankFinanceConstraints[0]?.creditCompliance).toBe(
      "ABOVE_LIMIT",
    );
    expect(result.conflicts.map((conflict) => conflict.code)).toContain(
      "BANK_FINANCE_CONSTRAINT_CONFLICT",
    );
  });

  it("detects incompatible fixed contribution requirements", () => {
    const a = fixtureProgram({
      id: "TEST.FIXED_A",
      noBenefits: true,
      contributionRequirement: {
        basis: "TOTAL_PROJECT_COST",
        fixedPercentage: percentage("10"),
        sourceReferences: [fixtureRuleSource],
      },
    });
    const b = fixtureProgram({
      id: "TEST.FIXED_B",
      noBenefits: true,
      contributionRequirement: {
        basis: "TOTAL_PROJECT_COST",
        fixedPercentage: percentage("20"),
        sourceReferences: [fixtureRuleSource],
      },
    });
    const result = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          selectedPrograms: [
            { programId: a.programId },
            { programId: b.programId },
          ],
        }),
        registryWith(a, b),
        [fixtureCompatibility({ left: "TEST.FIXED_A", right: "TEST.FIXED_B" })],
      ),
    );

    expect(result.conflicts.map((conflict) => conflict.messageCode)).toContain(
      "FIXED_CONTRIBUTION_REQUIREMENTS_DISAGREE",
    );
  });

  it("preserves zero values and distinguishes them from missing financing", () => {
    const zeroResult = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          projectCost: {
            totalProjectCost: amount("0"),
            costItems: [
              {
                costItemId: "ZERO-COST",
                category: "OTHER",
                tags: [],
                amount: amount("0"),
                sourceReferences: [],
              },
            ],
          },
          financing: {
            promoterContribution: sourcedAmount("0"),
            bankFinance: sourcedAmount("0"),
            otherFinance: [],
          },
        }),
        registryWith(),
        [],
      ),
    );
    expect(zeroResult.conflicts).toEqual([]);
    expect(zeroResult.resolutionStatus).toBe("RESOLVED");
    expect(zeroResult.summary.totalInitialFundingSources).toBe("0");

    const missingResult = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          financing: { otherFinance: [] },
        }),
        registryWith(),
        [],
      ),
    );
    expect(missingResult.summary.totalInitialFundingSources).toBeUndefined();
    expect(missingResult.resolutionStatus).toBe("MANUAL_REVIEW_REQUIRED");
  });

  it("rejects negative source values and project-cost reconciliation failures", () => {
    const negative = composeMultiProgramFunding(
      fixtureInput({
        financing: {
          promoterContribution: sourcedAmount("-1"),
          bankFinance: sourcedAmount("800000"),
          otherFinance: [],
        },
      }),
      registryWith(),
      [],
    );
    expect(negative.ok).toBe(false);
    if (!negative.ok) {
      expect(negative.errors.map((error) => error.code)).toContain(
        "NEGATIVE_AUTHORITATIVE_FINANCING_AMOUNT",
      );
    }

    const mismatch = composeMultiProgramFunding(
      fixtureInput({
        projectCost: {
          ...fixtureInput().projectCost,
          totalProjectCost: amount("999999"),
        },
      }),
      registryWith(),
      [],
    );
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) {
      expect(mismatch.errors.map((error) => error.code)).toContain(
        "AUTHORITATIVE_PROJECT_COST_RECONCILIATION_FAILURE",
      );
    }
  });

  it("rejects non-finite and non-canonical runtime monetary inputs", () => {
    const invalidTotal = composeMultiProgramFunding(
      fixtureInput({
        projectCost: {
          totalProjectCost: "NaN" as never,
          costItems: [],
        },
      }),
      registryWith(),
      [],
    );
    expect(invalidTotal.ok).toBe(false);
    if (!invalidTotal.ok) {
      expect(invalidTotal.errors.map((error) => error.code)).toContain(
        "INVALID_AUTHORITATIVE_PROJECT_COST",
      );
    }

    const invalidFinance = composeMultiProgramFunding(
      fixtureInput({
        financing: {
          promoterContribution: {
            ...sourcedAmount("0"),
            value: "Infinity" as never,
          },
          bankFinance: sourcedAmount("800000"),
          otherFinance: [],
        },
      }),
      registryWith(),
      [],
    );
    expect(invalidFinance.ok).toBe(false);
    if (!invalidFinance.ok) {
      expect(invalidFinance.errors.map((error) => error.code)).toContain(
        "INVALID_AUTHORITATIVE_FINANCING_AMOUNT",
      );
    }
  });

  it("resolves versions by date and preserves explicit historical selection", () => {
    const oldVersion = fixtureProgram({
      id: "TEST.VERSIONED",
      version: "old",
      effectiveFrom: "2024-01-01",
      effectiveTo: "2024-12-31",
      rate: "10",
    });
    const newVersion = fixtureProgram({
      id: "TEST.VERSIONED",
      version: "new",
      effectiveFrom: "2025-01-01",
      rate: "20",
    });
    const registry = registryWith(oldVersion, newVersion);
    const oldResult = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          evaluationAsOfDate: "2024-06-01",
          selectedPrograms: [{ programId: oldVersion.programId }],
        }),
        registry,
        [],
      ),
    );
    const newResult = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          selectedPrograms: [{ programId: oldVersion.programId }],
        }),
        registry,
        [],
      ),
    );
    const explicitOld = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          selectedPrograms: [
            {
              programId: oldVersion.programId,
              versionId: programVersionId("old"),
            },
          ],
        }),
        registry,
        [],
      ),
    );

    expect(
      oldResult.individualProgramEvaluations[0]?.snapshot?.programVersionId,
    ).toBe("old");
    expect(
      newResult.individualProgramEvaluations[0]?.snapshot?.programVersionId,
    ).toBe("new");
    expect(
      explicitOld.individualProgramEvaluations[0]?.snapshot?.programVersionId,
    ).toBe("old");
  });

  it("returns typed duplicate and version-resolution conflicts without double counting", () => {
    const program = fixtureProgram({ id: "TEST.DUPLICATE" });
    const duplicate = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          selectedPrograms: [
            { programId: program.programId },
            { programId: program.programId, versionId: program.versionId },
          ],
        }),
        registryWith(program),
        [],
      ),
    );
    expect(duplicate.conflicts.map((conflict) => conflict.code)).toContain(
      "DUPLICATE_PROGRAM_SELECTION",
    );
    expect(duplicate.summary.benefits.capitalSubsidy).toBe("200000");

    const missing = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          selectedPrograms: [{ programId: programId("TEST.MISSING") }],
        }),
        registryWith(),
        [],
      ),
    );
    expect(missing.conflicts.map((conflict) => conflict.code)).toContain(
      "PROGRAM_VERSION_RESOLUTION_FAILURE",
    );
  });

  it("does not mutate authoritative source inputs or program definitions", () => {
    const program = fixtureProgram({ id: "TEST.IMMUTABLE" });
    const input = fixtureInput({
      selectedPrograms: [{ programId: program.programId }],
    });
    const inputBefore = JSON.stringify(input);
    const definitionBefore = JSON.stringify(program);

    unwrap(composeMultiProgramFunding(input, registryWith(program), []));

    expect(JSON.stringify(input)).toBe(inputBefore);
    expect(JSON.stringify(program)).toBe(definitionBefore);
  });

  it("preserves authoritative excluded costs while using only program-eligible basis", () => {
    const program = fixtureProgram({
      id: "TEST.EXCLUDES_LAND",
      rate: "20",
      costEligibilityRules: [
        {
          ruleId: "EXCLUDE-LAND",
          type: "EXCLUDE_CATEGORIES",
          categories: ["LAND"],
          sourceReferences: [fixtureRuleSource],
        },
      ],
    });
    const input = fixtureInput({
      projectCost: {
        totalProjectCost: amount("1000000"),
        costItems: [
          {
            costItemId: "LAND",
            category: "LAND",
            tags: [],
            amount: amount("400000"),
            sourceReferences: [],
          },
          {
            costItemId: "MACHINE",
            category: "PLANT_AND_MACHINERY",
            tags: [],
            amount: amount("600000"),
            sourceReferences: [],
          },
        ],
      },
      selectedPrograms: [{ programId: program.programId }],
    });
    const result = unwrap(
      composeMultiProgramFunding(input, registryWith(program), []),
    );

    expect(result.projectCost.totalProjectCost).toBe("1000000");
    expect(
      result.projectCost.costItems.find((item) => item.costItemId === "LAND")
        ?.amount,
    ).toBe("400000");
    expect(
      result.individualProgramEvaluations[0]?.evaluation?.costEligibility
        .eligibleProjectCost,
    ).toBe("600000");
    expect(result.summary.benefits.capitalSubsidy).toBe("120000");
  });

  it("uses exact Decimal arithmetic without intermediate rounding", () => {
    const program = fixtureProgram({
      id: "TEST.PRECISION",
      rate: "33.33333333333333333333333333333333333333",
    });
    const result = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          projectCost: {
            totalProjectCost: monetaryAmount("0.3"),
            costItems: [
              {
                costItemId: "PRECISE",
                category: "OTHER",
                tags: [],
                amount: monetaryAmount("0.3"),
                sourceReferences: [],
              },
            ],
          },
          financing: {
            promoterContribution: sourcedAmount("0.3"),
            bankFinance: sourcedAmount("0"),
            otherFinance: [],
          },
          selectedPrograms: [{ programId: program.programId }],
        }),
        registryWith(program),
        [],
      ),
    );

    expect(result.summary.benefits.capitalSubsidy).toBe(
      "0.09999999999999999999999999999999999999999",
    );
    expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity/);
  });
});
