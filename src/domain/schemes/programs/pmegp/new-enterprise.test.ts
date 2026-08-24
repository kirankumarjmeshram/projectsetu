import { describe, expect, it } from "vitest";

import type { Assumption } from "../../../shared/assumptions";
import {
  decimalValue,
  monetaryAmount,
  toDecimal,
} from "../../../shared/decimal";
import type { SourceReference } from "../../../shared/provenance";
import { classificationTag } from "../../program";
import {
  calculatePmegpNewEnterpriseCost,
  createPmegpProgramRegistry,
  evaluatePmegpActivityEligibility,
  evaluatePmegpNewEnterprise,
  PMEGP_COST_TAGS,
  PMEGP_NEW_ENTERPRISE_PROGRAM_ID,
  PMEGP_REVISED_GUIDELINE_VERSION_ID,
  PMEGP_UPGRADATION_PROGRAM_ID,
  pmegpNewEnterpriseDefinition,
  resolvePmegpBeneficiaryCategory,
  resolvePmegpNewEnterpriseRate,
} from ".";
import type {
  PmegpCostItem,
  PmegpActivityClassification,
  PmegpNewEnterpriseEvaluationInput,
} from ".";

const source: SourceReference = {
  id: "pmegp-test-source",
  type: "USER_INPUT",
  reference: "Source-backed synthetic PMEGP test fact",
};

function fact<T>(value: T): Assumption<T> {
  return { value, source };
}

function cost(
  id: string,
  amount: string,
  tags: readonly string[] = [PMEGP_COST_TAGS.CAPITAL],
  extra: Partial<PmegpCostItem> = {},
): PmegpCostItem {
  return {
    costItemId: id,
    category: "SYNTHETIC",
    amount: monetaryAmount(amount),
    tags: tags.map(classificationTag),
    sourceReferences: [source],
    ...extra,
  };
}

function validInput(
  overrides: Partial<PmegpNewEnterpriseEvaluationInput> = {},
): PmegpNewEnterpriseEvaluationInput {
  return {
    projectId: "project-pmegp-new",
    evaluationAsOfDate: "2026-08-24",
    applicant: {
      entityType: fact("INDIVIDUAL"),
      ageYears: fact(decimalValue("19")),
      educationStandardPassed: fact(decimalValue("8")),
      hasPreviouslyAvailedGovernmentSubsidy: fact(false),
      existingUnitAssistedUnderGovernmentScheme: fact(false),
      familyHasExistingPmegpBeneficiary: fact(false),
      specialCategories: fact([]),
    },
    project: {
      projectType: fact("NEW_ENTERPRISE"),
      sector: fact("MANUFACTURING"),
    },
    location: {
      areaClassification: fact("URBAN"),
      newEnterpriseSpecialAreas: fact([]),
      isNer: fact(false),
    },
    activity: {
      classification: fact("STANDARD_ELIGIBLE"),
      isProhibitedByLocalAuthority: fact(false),
    },
    costItems: [cost("plant", "1000000")],
    ...overrides,
  };
}

describe("PMEGP new-enterprise version and calculation", () => {
  it("registers independent new-enterprise and upgradation identities", () => {
    const registry = createPmegpProgramRegistry();
    expect(
      registry.getProgramDefinition(
        PMEGP_NEW_ENTERPRISE_PROGRAM_ID,
        PMEGP_REVISED_GUIDELINE_VERSION_ID,
      ).ok,
    ).toBe(true);
    expect(PMEGP_NEW_ENTERPRISE_PROGRAM_ID).not.toBe(
      PMEGP_UPGRADATION_PROGRAM_ID,
    );
    expect(pmegpNewEnterpriseDefinition.effectiveFrom).toBe("2023-12-07");
    expect(pmegpNewEnterpriseDefinition.effectiveTo).toBeUndefined();
  });

  it.each([
    ["GENERAL", "URBAN", "15"],
    ["GENERAL", "RURAL", "25"],
    ["SPECIAL", "URBAN", "25"],
    ["SPECIAL", "RURAL", "35"],
  ] as const)("uses the %s/%s rate", (category, area, expected) => {
    expect(
      resolvePmegpNewEnterpriseRate({
        category,
        areaClassification: area,
      }),
    ).toBe(expected);
  });

  it.each([
    ["MANUFACTURING", "4999999", "4999999", "0"],
    ["MANUFACTURING", "5000000", "5000000", "0"],
    ["MANUFACTURING", "5000001", "5000000", "1"],
    ["SERVICE", "1999999", "1999999", "0"],
    ["SERVICE", "2000000", "2000000", "0"],
    ["SERVICE", "2000001", "2000000", "1"],
  ] as const)(
    "applies the %s ceiling at and above its boundary",
    (sector, amount, admissible, excess) => {
      const result = calculatePmegpNewEnterpriseCost({
        sector,
        costItems: [cost("capital", amount)],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.pmegpAdmissibleProjectCost).toBe(admissible);
      expect(result.value.excessProjectCostOutsideSubsidy).toBe(excess);
    },
  );

  it.each([
    ["MANUFACTURING", "390000", "WITHIN_LIMIT", "610000"],
    ["MANUFACTURING", "400000", "AT_LIMIT", "600000"],
    ["MANUFACTURING", "410000", "EXCEEDS_LIMIT", "590000"],
    ["SERVICE", "590000", "WITHIN_LIMIT", "410000"],
    ["SERVICE", "600000", "AT_LIMIT", "400000"],
    ["SERVICE", "610000", "EXCEEDS_LIMIT", "390000"],
  ] as const)(
    "enforces the %s working-capital share without intermediate rounding",
    (sector, wcAmount, expectedCompliance, capitalAmount) => {
      const result = calculatePmegpNewEnterpriseCost({
        sector,
        costItems: [
          cost("capital", capitalAmount),
          cost("wc", wcAmount, [PMEGP_COST_TAGS.WORKING_CAPITAL]),
        ],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.workingCapital.complianceResult).toBe(
        expectedCompliance,
      );
      const lineTotal = result.value.lines.reduce(
        (sum, line) => sum.plus(toDecimal(line.eligibleAmount)),
        toDecimal(decimalValue("0")),
      );
      expect(lineTotal.toFixed()).toBe(
        result.value.pmegpFinanceableProjectCost,
      );
    },
  );

  it("retains land in actual cost but excludes it from PMEGP financeable cost", () => {
    const result = calculatePmegpNewEnterpriseCost({
      sector: "MANUFACTURING",
      costItems: [
        cost("plant", "1000000"),
        cost("land", "250000", [PMEGP_COST_TAGS.LAND]),
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.actualProjectCost).toBe("1250000");
    expect(result.value.pmegpFinanceableProjectCost).toBe("1000000");
    expect(result.value.excludedCost).toBe("250000");
  });

  it.each([
    ["1", "120000"],
    ["3", "360000"],
    ["5", "360000"],
  ] as const)(
    "caps workshed cost at three years for duration %s",
    (years, eligible) => {
      const result = calculatePmegpNewEnterpriseCost({
        sector: "MANUFACTURING",
        costItems: [
          cost(
            "shed",
            eligible === "360000" && years === "5" ? "600000" : eligible,
            [PMEGP_COST_TAGS.CAPITAL, PMEGP_COST_TAGS.RENTED_WORKSHED],
            {
              annualAmount: fact(monetaryAmount("120000")),
              durationYears: fact(decimalValue(years)),
            },
          ),
        ],
      });
      expect(result.ok).toBe(true);
      if (result.ok)
        expect(result.value.pmegpFinanceableProjectCost).toBe(eligible);
    },
  );

  it("rejects a workshed line without explicit annual amount and duration", () => {
    const result = calculatePmegpNewEnterpriseCost({
      sector: "MANUFACTURING",
      costItems: [cost("shed", "100", [PMEGP_COST_TAGS.RENTED_WORKSHED])],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects zero workshed duration rather than treating positive zero as valid", () => {
    const result = calculatePmegpNewEnterpriseCost({
      sector: "MANUFACTURING",
      costItems: [
        cost("shed", "0", [PMEGP_COST_TAGS.RENTED_WORKSHED], {
          annualAmount: fact(monetaryAmount("100")),
          durationYears: fact(decimalValue("0")),
        }),
      ],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects working-capital-only projects through eligibility, not cost mutation", () => {
    const input = validInput({
      costItems: [cost("wc", "100000", [PMEGP_COST_TAGS.WORKING_CAPITAL])],
    });
    const original = structuredClone(input);
    const result = evaluatePmegpNewEnterprise(
      input,
      createPmegpProgramRegistry(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.summary.eligibilityStatus).toBe("INELIGIBLE");
    expect(input).toEqual(original);
  });

  it.each([
    [decimalValue("18"), "INELIGIBLE"],
    [decimalValue("18.0001"), "ELIGIBLE"],
  ] as const)("uses strict above-18 semantics", (age, status) => {
    const base = validInput();
    const result = evaluatePmegpNewEnterprise(
      {
        ...base,
        applicant: { ...base.applicant, ageYears: fact(age) },
      },
      createPmegpProgramRegistry(),
    );
    expect(result.ok && result.value.summary.eligibilityStatus).toBe(status);
  });

  it("treats missing age as insufficient information, never as favorable", () => {
    const base = validInput();
    const result = evaluatePmegpNewEnterprise(
      { ...base, applicant: { ...base.applicant, ageYears: undefined } },
      createPmegpProgramRegistry(),
    );
    expect(result.ok && result.value.summary.eligibilityStatus).toBe(
      "INSUFFICIENT_INFORMATION",
    );
  });

  it.each([
    ["MANUFACTURING", "1000000", undefined, "ELIGIBLE"],
    ["MANUFACTURING", "1000000.01", undefined, "INSUFFICIENT_INFORMATION"],
    ["SERVICE", "500000", undefined, "ELIGIBLE"],
    ["SERVICE", "500000.01", decimalValue("7"), "INELIGIBLE"],
    ["SERVICE", "500000.01", decimalValue("8"), "ELIGIBLE"],
  ] as const)(
    "applies education boundaries for %s at %s",
    (sector, amount, education, status) => {
      const base = validInput();
      const result = evaluatePmegpNewEnterprise(
        {
          ...base,
          project: { ...base.project, sector: fact(sector) },
          applicant: {
            ...base.applicant,
            educationStandardPassed: education ? fact(education) : undefined,
          },
          costItems: [cost("capital", amount)],
        },
        createPmegpProgramRegistry(),
      );
      expect(result.ok && result.value.summary.eligibilityStatus).toBe(status);
    },
  );

  it.each(["EXISTING_ENTERPRISE", "EXPANSION", "MODERNIZATION"] as const)(
    "rejects %s as a new project",
    (projectType) => {
      const base = validInput();
      const result = evaluatePmegpNewEnterprise(
        {
          ...base,
          project: { ...base.project, projectType: fact(projectType) },
        },
        createPmegpProgramRegistry(),
      );
      expect(result.ok && result.value.summary.eligibilityStatus).toBe(
        "INELIGIBLE",
      );
    },
  );

  it("calculates exact contribution, bank finance, subsidy, and snapshot", () => {
    const result = evaluatePmegpNewEnterprise(
      validInput({
        actualBeneficiaryContribution: fact(monetaryAmount("100000")),
        actualBankFinance: fact(monetaryAmount("900000")),
      }),
      createPmegpProgramRegistry(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.contribution.requiredContribution).toBe("100000");
    expect(
      result.value.summary.expectedBankFinanceConstraint?.expectedBankFinance,
    ).toBe("900000");
    expect(result.value.marginMoney.calculatedEligibleMarginMoney).toBe(
      "150000",
    );
    expect(result.value.summary.snapshot).toEqual({
      programId: PMEGP_NEW_ENTERPRISE_PROGRAM_ID,
      programVersionId: PMEGP_REVISED_GUIDELINE_VERSION_ID,
      evaluationAsOfDate: "2026-08-24",
    });
  });

  it.each([
    ["100000", "MEETS_REQUIREMENT", "0"],
    ["110000", "MEETS_REQUIREMENT", "0"],
    ["99999.99", "BELOW_REQUIREMENT", "0.01"],
  ] as const)(
    "compares general contribution %s against the exact 10% minimum",
    (actual, compliance, shortfall) => {
      const result = evaluatePmegpNewEnterprise(
        validInput({
          actualBeneficiaryContribution: fact(monetaryAmount(actual)),
        }),
        createPmegpProgramRegistry(),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.contribution.complianceResult).toBe(compliance);
      expect(result.value.contribution.shortfall).toBe(shortfall);
    },
  );

  it.each([
    ["50000", "MEETS_REQUIREMENT", "0"],
    ["60000", "MEETS_REQUIREMENT", "0"],
    ["49999", "BELOW_REQUIREMENT", "1"],
  ] as const)(
    "compares special contribution %s against the exact 5% minimum",
    (actual, compliance, shortfall) => {
      const base = validInput();
      const result = evaluatePmegpNewEnterprise(
        {
          ...base,
          applicant: {
            ...base.applicant,
            specialCategories: fact(["WOMAN"]),
          },
          actualBeneficiaryContribution: fact(monetaryAmount(actual)),
          actualBankFinance: fact(monetaryAmount("950000")),
        },
        createPmegpProgramRegistry(),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.contribution.requiredContribution).toBe("50000");
      expect(result.value.contribution.complianceResult).toBe(compliance);
      expect(result.value.contribution.shortfall).toBe(shortfall);
      expect(
        result.value.summary.expectedBankFinanceConstraint?.expectedBankFinance,
      ).toBe("950000");
    },
  );

  it("calculates margin money only on the ceiling-limited admissible cost", () => {
    const result = evaluatePmegpNewEnterprise(
      validInput({ costItems: [cost("plant", "6000000")] }),
      createPmegpProgramRegistry(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.costEligibility.excessProjectCostOutsideSubsidy).toBe(
      "1000000",
    );
    expect(result.value.marginMoney.calculatedEligibleMarginMoney).toBe(
      "750000",
    );
  });

  it.each([
    "INDIVIDUAL",
    "SELF_HELP_GROUP",
    "REGISTERED_INSTITUTION",
    "PRODUCTION_COOPERATIVE",
    "CHARITABLE_TRUST",
  ] as const)("supports verified applicant/entity type %s", (entityType) => {
    const base = validInput();
    const result = evaluatePmegpNewEnterprise(
      {
        ...base,
        applicant: { ...base.applicant, entityType: fact(entityType) },
      },
      createPmegpProgramRegistry(),
    );
    expect(result.ok && result.value.summary.eligibilityStatus).toBe(
      "ELIGIBLE",
    );
  });

  it.each([
    ["hasPreviouslyAvailedGovernmentSubsidy", true, "INELIGIBLE"],
    ["existingUnitAssistedUnderGovernmentScheme", true, "INELIGIBLE"],
    ["familyHasExistingPmegpBeneficiary", true, "INELIGIBLE"],
    [
      "hasPreviouslyAvailedGovernmentSubsidy",
      undefined,
      "INSUFFICIENT_INFORMATION",
    ],
    [
      "familyHasExistingPmegpBeneficiary",
      undefined,
      "INSUFFICIENT_INFORMATION",
    ],
  ] as const)(
    "does not default applicant fact %s favorably",
    (key, value, status) => {
      const base = validInput();
      const result = evaluatePmegpNewEnterprise(
        {
          ...base,
          applicant: {
            ...base.applicant,
            [key]: value === undefined ? undefined : fact(value),
          },
        },
        createPmegpProgramRegistry(),
      );
      expect(result.ok && result.value.summary.eligibilityStatus).toBe(status);
    },
  );

  it("does not invent a rate, contribution, or bank percentage for unknown area/category", () => {
    const base = validInput();
    const result = evaluatePmegpNewEnterprise(
      {
        ...base,
        applicant: { ...base.applicant, specialCategories: undefined },
        location: {
          ...base.location,
          areaClassification: undefined,
          newEnterpriseSpecialAreas: undefined,
        },
      },
      createPmegpProgramRegistry(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.summary.eligibilityStatus).toBe(
      "INSUFFICIENT_INFORMATION",
    );
    expect(result.value.summary.applicableMarginMoneyRate).toBeUndefined();
    expect(result.value.contribution.requiredContribution).toBeUndefined();
    expect(
      result.value.summary.expectedBankFinanceConstraint?.bankFinancePercentage,
    ).toBeUndefined();
  });

  it("retains source IDs on major calculation and lifecycle rules", () => {
    const result = evaluatePmegpNewEnterprise(
      validInput(),
      createPmegpProgramRegistry(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sourceIds = result.value.summary.ruleTraces.flatMap((trace) =>
      trace.sourceReferences.map((reference) => reference.sourceId),
    );
    expect(sourceIds).toContain("PMEGP.GUIDELINE.2023-12-07.CLAUSE-3");
    expect(sourceIds).toContain("PMEGP.GUIDELINE.2023-12-07.CLAUSE-4.1");
    expect(
      result.value.summary.releaseLifecycle.sourceReferences.map(
        (reference) => reference.sourceId,
      ),
    ).toContain("PMEGP.GUIDELINE.2023-12-07.CLAUSES-11.17-11.23");
  });

  it("resolves all applicant and area special categories into one special rate", () => {
    const resolution = resolvePmegpBeneficiaryCategory({
      applicant: {
        specialCategories: fact([
          "SC",
          "ST",
          "OBC",
          "MINORITY",
          "WOMAN",
          "EX_SERVICEMAN",
          "TRANSGENDER",
          "DIFFERENTLY_ABLED",
        ]),
      },
      location: {
        newEnterpriseSpecialAreas: fact([
          "NER",
          "ASPIRATIONAL_DISTRICT",
          "HILL_AREA",
          "BORDER_AREA",
        ]),
      },
    });
    expect(resolution.category).toBe("SPECIAL");
    expect(resolution.qualifyingCategories).toHaveLength(12);
  });

  it.each([
    "SC",
    "ST",
    "OBC",
    "MINORITY",
    "WOMAN",
    "EX_SERVICEMAN",
    "TRANSGENDER",
    "DIFFERENTLY_ABLED",
  ] as const)("resolves applicant category %s independently", (category) => {
    expect(
      resolvePmegpBeneficiaryCategory({
        applicant: { specialCategories: fact([category]) },
        location: { newEnterpriseSpecialAreas: fact([]) },
      }).category,
    ).toBe("SPECIAL");
  });

  it.each([
    "NER",
    "ASPIRATIONAL_DISTRICT",
    "HILL_AREA",
    "BORDER_AREA",
  ] as const)("resolves special area %s independently", (area) => {
    expect(
      resolvePmegpBeneficiaryCategory({
        applicant: { specialCategories: fact([]) },
        location: { newEnterpriseSpecialAreas: fact([area]) },
      }).category,
    ).toBe("SPECIAL");
  });

  it("keeps unknown category evidence insufficient", () => {
    expect(
      resolvePmegpBeneficiaryCategory({ applicant: {}, location: {} }).category,
    ).toBe("INSUFFICIENT_INFORMATION");
  });
});

describe("PMEGP activity rules", () => {
  function activity(
    classification: PmegpActivityClassification,
    location: Record<string, unknown> = {},
  ) {
    return evaluatePmegpActivityEligibility({
      activity: {
        classification: fact(classification),
        isProhibitedByLocalAuthority: fact(false),
      },
      location: location as never,
    });
  }

  it.each([
    "SLAUGHTERED_MEAT_PROCESSING",
    "TOBACCO_PRODUCT",
    "LIQUOR_OR_INTOXICANT_ACTIVITY",
    "TODDY_FOR_SALE",
    "CROP_CULTIVATION_OR_PLANTATION",
  ] as const)("prohibits %s", (classification) => {
    expect(activity(classification).status).toBe("PROHIBITED");
  });

  it.each([
    "NON_VEGETARIAN_HOTEL_OR_DHABA",
    "AGRICULTURAL_VALUE_ADDITION",
    "OFF_FARM_OR_FARM_LINKED_ACTIVITY",
    "DAIRY",
    "POULTRY",
    "AQUACULTURE",
    "BEEKEEPING_OR_INSECT_ACTIVITY",
    "SERICULTURE_FARM_LINKED",
  ] as const)("allows documented exception %s", (classification) => {
    expect(activity(classification).status).toBe("ALLOWED");
  });

  it("allows piggery only with explicit NER evidence", () => {
    expect(activity("PIGGERY").status).toBe("MANUAL_REVIEW_REQUIRED");
    expect(activity("PIGGERY", { isNer: fact(true) }).status).toBe(
      "ALLOWED_WITH_CONDITIONS",
    );
    expect(activity("PIGGERY", { isNer: fact(false) }).status).toBe(
      "PROHIBITED",
    );
  });

  it("does not fabricate trading or transport portfolio availability", () => {
    expect(activity("GENERAL_RETAIL").portfolioConstraintStatus).toBe(
      "MANUAL_REVIEW_REQUIRED",
    );
    expect(activity("INDIVIDUAL_TRANSPORT").portfolioConstraintStatus).toBe(
      "MANUAL_REVIEW_REQUIRED",
    );
  });
});
