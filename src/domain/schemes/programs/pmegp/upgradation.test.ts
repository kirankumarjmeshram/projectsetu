import { describe, expect, it } from "vitest";

import type { Assumption } from "../../../shared/assumptions";
import { decimalValue, monetaryAmount } from "../../../shared/decimal";
import type { SourceReference } from "../../../shared/provenance";
import { classificationTag } from "../../program";
import {
  calculatePmegpUpgradationCost,
  createPmegpProgramRegistry,
  evaluatePmegpUpgradation,
  PMEGP_COST_TAGS,
  PMEGP_UPGRADATION_PROGRAM_ID,
  PMEGP_UPGRADATION_VERSION_ID,
  pmegpUpgradationDefinition,
  pmegpUpgradationReleaseLifecycle,
  upgradationRate,
} from ".";
import type {
  PmegpCostItem,
  PmegpPriorProgram,
  PmegpUpgradationEvaluationInput,
} from ".";

const source: SourceReference = {
  id: "pmegp-upgradation-test-source",
  type: "USER_INPUT",
};

function fact<T>(value: T): Assumption<T> {
  return { value, source };
}

function cost(amount: string): PmegpCostItem {
  return {
    costItemId: "upgradation-capital",
    category: "CAPITAL",
    amount: monetaryAmount(amount),
    tags: [classificationTag(PMEGP_COST_TAGS.CAPITAL)],
    sourceReferences: [source],
  };
}

function validInput(
  overrides: Partial<PmegpUpgradationEvaluationInput> = {},
): PmegpUpgradationEvaluationInput {
  return {
    projectId: "project-pmegp-upgradation",
    evaluationAsOfDate: "2026-08-24",
    project: { sector: fact("MANUFACTURING") },
    location: { upgradationSpecialAreas: fact([]) },
    activity: {
      classification: fact("STANDARD_ELIGIBLE"),
      isProhibitedByLocalAuthority: fact(false),
    },
    history: {
      priorProgram: fact("PMEGP"),
      priorMarginMoneyAdjusted: fact(true),
      firstLoanRepaidOnTime: fact(true),
      profitableYears: fact(decimalValue("3")),
      hasGoodTurnover: fact(true),
      hasGrowthPotential: fact(true),
      udyamRegistered: fact(true),
    },
    costItems: [cost("10000000")],
    ...overrides,
  };
}

describe("PMEGP upgradation", () => {
  it("is an independent authoritative program version", () => {
    expect(pmegpUpgradationDefinition.programId).toBe(
      PMEGP_UPGRADATION_PROGRAM_ID,
    );
    expect(pmegpUpgradationDefinition.versionId).toBe(
      PMEGP_UPGRADATION_VERSION_ID,
    );
    expect(pmegpUpgradationDefinition.effectiveFrom).toBe("2023-12-07");
  });

  it.each([
    ["MANUFACTURING", "10000000", "10000000"],
    ["MANUFACTURING", "10000001", "10000000"],
    ["SERVICE", "2500000", "2500000"],
    ["SERVICE", "2500001", "2500000"],
  ] as const)(
    "uses the independent %s project ceiling",
    (sector, amount, expected) => {
      const result = calculatePmegpUpgradationCost({
        sector,
        costItems: [cost(amount)],
      });
      expect(result.ok).toBe(true);
      if (result.ok)
        expect(result.value.pmegpAdmissibleProjectCost).toBe(expected);
    },
  );

  it.each([
    [[], "15", false],
    [["NER"], "20", true],
    [["HILL_STATE"], "20", true],
  ] as const)("resolves independent area rate %s", (areas, rate, special) => {
    const result = upgradationRate(fact(areas));
    expect(result.rate).toBe(rate);
    expect(result.specialArea).toBe(special);
  });

  it.each([
    ["MANUFACTURING", [], "1500000"],
    ["MANUFACTURING", ["NER"], "2000000"],
    ["SERVICE", [], "375000"],
    ["SERVICE", ["HILL_STATE"], "500000"],
  ] as const)(
    "applies the independent %s subsidy cap",
    (sector, areas, expected) => {
      const result = evaluatePmegpUpgradation(
        validInput({
          project: { sector: fact(sector) },
          location: { upgradationSpecialAreas: fact(areas) },
          costItems: [
            cost(sector === "MANUFACTURING" ? "10000000" : "2500000"),
          ],
        }),
        createPmegpProgramRegistry(),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.marginMoney.calculatedEligibleMarginMoney).toBe(
          expected,
        );
      }
    },
  );

  it.each(["PMEGP", "REGP", "MUDRA"] as const)(
    "accepts qualifying prior program %s",
    (priorProgram) => {
      const input = validInput();
      const result = evaluatePmegpUpgradation(
        {
          ...input,
          history: {
            ...input.history,
            priorProgram: fact(priorProgram),
            priorMarginMoneyAdjusted:
              priorProgram === "MUDRA" ? undefined : fact(true),
          },
        },
        createPmegpProgramRegistry(),
      );
      expect(result.ok && result.value.summary.eligibilityStatus).toBe(
        "ELIGIBLE",
      );
    },
  );

  it.each([
    ["PMEGP", false, "INELIGIBLE"],
    ["REGP", undefined, "INSUFFICIENT_INFORMATION"],
    ["MUDRA", undefined, "ELIGIBLE"],
  ] as const)(
    "handles prior margin-money adjustment for %s",
    (program, adjusted, status) => {
      const input = validInput();
      const result = evaluatePmegpUpgradation(
        {
          ...input,
          history: {
            ...input.history,
            priorProgram: fact(program as PmegpPriorProgram),
            priorMarginMoneyAdjusted:
              adjusted === undefined ? undefined : fact(adjusted),
          },
        },
        createPmegpProgramRegistry(),
      );
      expect(result.ok && result.value.summary.eligibilityStatus).toBe(status);
    },
  );

  it.each([
    ["firstLoanRepaidOnTime", false, "INELIGIBLE"],
    ["hasGoodTurnover", false, "INELIGIBLE"],
    ["hasGrowthPotential", false, "INELIGIBLE"],
    ["udyamRegistered", false, "INELIGIBLE"],
    ["firstLoanRepaidOnTime", undefined, "INSUFFICIENT_INFORMATION"],
    ["hasGoodTurnover", undefined, "INSUFFICIENT_INFORMATION"],
  ] as const)("does not default %s favorably", (key, value, status) => {
    const input = validInput();
    const result = evaluatePmegpUpgradation(
      {
        ...input,
        history: {
          ...input.history,
          [key]: value === undefined ? undefined : fact(value),
        },
      },
      createPmegpProgramRegistry(),
    );
    expect(result.ok && result.value.summary.eligibilityStatus).toBe(status);
  });

  it.each([
    ["2", "INELIGIBLE"],
    ["3", "ELIGIBLE"],
  ] as const)(
    "requires three profitable years at boundary %s",
    (years, status) => {
      const input = validInput();
      const result = evaluatePmegpUpgradation(
        {
          ...input,
          history: {
            ...input.history,
            profitableYears: fact(decimalValue(years)),
          },
        },
        createPmegpProgramRegistry(),
      );
      expect(result.ok && result.value.summary.eligibilityStatus).toBe(status);
    },
  );

  it("calculates 10% contribution and 90% bank-finance constraints exactly", () => {
    const result = evaluatePmegpUpgradation(
      validInput({
        actualBeneficiaryContribution: fact(monetaryAmount("1000000")),
        actualBankFinance: fact(monetaryAmount("9000000")),
      }),
      createPmegpProgramRegistry(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.contribution.requiredContribution).toBe("1000000");
    expect(
      result.value.summary.expectedBankFinanceConstraint?.expectedBankFinance,
    ).toBe("9000000");
    expect(result.value.summary.snapshot.programId).toBe(
      PMEGP_UPGRADATION_PROGRAM_ID,
    );
  });

  it("reports an exact upgradation contribution shortfall without mutation", () => {
    const input = validInput({
      actualBeneficiaryContribution: fact(monetaryAmount("999999.99")),
    });
    const original = structuredClone(input);
    const result = evaluatePmegpUpgradation(
      input,
      createPmegpProgramRegistry(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.contribution.complianceResult).toBe(
      "BELOW_REQUIREMENT",
    );
    expect(result.value.contribution.shortfall).toBe("0.01");
    expect(input).toEqual(original);
  });

  it("retains source IDs for upgradation rates, caps, and lifecycle", () => {
    const result = evaluatePmegpUpgradation(
      validInput(),
      createPmegpProgramRegistry(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sourceIds = result.value.summary.ruleTraces.flatMap((trace) =>
      trace.sourceReferences.map((reference) => reference.sourceId),
    );
    expect(sourceIds).toContain("PMEGP.GUIDELINE.2023-12-07.CLAUSE-4.2");
    expect(sourceIds).toContain("PMEGP.GUIDELINE.2023-12-07.CLAUSE-3");
    expect(
      pmegpUpgradationReleaseLifecycle.sourceReferences.map(
        (reference) => reference.sourceId,
      ),
    ).toContain("PMEGP.GUIDELINE.2023-12-07.CLAUSE-72");
  });

  it("retains an independent back-ended three-year lifecycle", () => {
    expect(pmegpUpgradationReleaseLifecycle.immediateBeneficiaryCash).toBe(
      false,
    );
    expect(pmegpUpgradationReleaseLifecycle.releaseRecipient).toBe(
      "FINANCING_BANK",
    );
    expect(pmegpUpgradationReleaseLifecycle.lockInPeriodYears).toBe("3");
    expect(pmegpUpgradationReleaseLifecycle.adjustmentConditions).toContain(
      "POSITIVE_PHYSICAL_VERIFICATION",
    );
  });

  it("fails version resolution before the authoritative effective date", () => {
    const result = evaluatePmegpUpgradation(
      { ...validInput(), evaluationAsOfDate: "2023-12-06" },
      createPmegpProgramRegistry(),
    );
    expect(result.ok).toBe(false);
  });
});
