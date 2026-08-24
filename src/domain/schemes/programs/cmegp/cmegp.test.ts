import { describe, expect, it } from "vitest";

import type { Assumption } from "../../../shared/assumptions";
import type { CalculationResult } from "../../../shared/calculation";
import { decimalValue, monetaryAmount } from "../../../shared/decimal";
import type { SourceReference } from "../../../shared/provenance";
import type {
  CmegpAreaClassification,
  CmegpBeneficiaryCategory,
  CmegpCostItem,
  CmegpEvaluationInput,
  CmegpSector,
} from "./contracts";
import { evaluateCmegp } from "./evaluation";

const source: SourceReference = { id: "TEST.SOURCE", type: "USER_INPUT" };
const a = <T>(value: T): Assumption<T> => ({ value, source });
const cost = (
  id: string,
  amount: string,
  tag: CmegpCostItem["tag"] = "MACHINERY_EQUIPMENT",
): CmegpCostItem => ({
  costItemId: id,
  description: id,
  amount: monetaryAmount(amount),
  tag,
  sourceReferences: [source],
});
function unwrap<T>(result: CalculationResult<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected success");
  return result.value;
}
function input(
  overrides: Partial<CmegpEvaluationInput> = {},
): CmegpEvaluationInput {
  return {
    projectId: "P1",
    evaluationAsOfDate: "2026-08-24",
    projectState: a("MAHARASHTRA"),
    sector: a("MANUFACTURING"),
    beneficiaryCategory: a("GENERAL"),
    areaClassification: a("URBAN"),
    entityType: a("INDIVIDUAL"),
    applicantAgeYears: a(decimalValue("18")),
    activityClassification: a("MANUFACTURING"),
    hasPriorGovernmentSubsidyBenefit: a(false),
    actualBeneficiaryContribution: a(monetaryAmount("1000000")),
    costItems: [cost("M", "10000000")],
    ...overrides,
  };
}

describe("CMEGP 2025 rate and cap matrix", () => {
  it.each([
    ["GENERAL", "URBAN", "SERVICE", "15", "300000"],
    ["GENERAL", "RURAL", "SERVICE", "25", "500000"],
    ["SPECIAL", "URBAN", "SERVICE", "25", "500000"],
    ["SPECIAL", "RURAL", "SERVICE", "35", "700000"],
    ["GENERAL", "URBAN", "MANUFACTURING", "15", "750000"],
    ["GENERAL", "RURAL", "MANUFACTURING", "25", "1250000"],
    ["SPECIAL", "URBAN", "MANUFACTURING", "25", "1250000"],
    ["SPECIAL", "RURAL", "MANUFACTURING", "35", "1750000"],
  ] as readonly [
    CmegpBeneficiaryCategory,
    CmegpAreaClassification,
    CmegpSector,
    string,
    string,
  ][])(
    "%s %s %s uses rate %s and cap %s",
    (category, area, sector, rate, cap) => {
      const projectCost = sector === "MANUFACTURING" ? "10000000" : "5000000";
      const contribution = category === "GENERAL" ? "1000000" : "500000";
      const result = unwrap(
        evaluateCmegp(
          input({
            sector: a(sector),
            beneficiaryCategory: a(category),
            areaClassification: a(area),
            activityClassification: a(
              sector === "MANUFACTURING" ? "MANUFACTURING" : "SERVICE",
            ),
            actualBeneficiaryContribution: a(monetaryAmount(contribution)),
            costItems: [cost("M", projectCost)],
          }),
        ),
      );
      expect(result.subsidyRate).toBe(rate);
      expect(result.subsidyCap).toBe(cap);
      expect(result.calculatedEligibleSubsidy).toBe(cap);
    },
  );

  it("uses Rs 1 crore manufacturing and Rs 50 lakh service/agri-allied ceilings", () => {
    const manufacturing = unwrap(evaluateCmegp(input()));
    const service = unwrap(
      evaluateCmegp(
        input({
          sector: a("SERVICE"),
          activityClassification: a("SERVICE"),
          actualBeneficiaryContribution: a(monetaryAmount("500000")),
          costItems: [cost("M", "10000000")],
        }),
      ),
    );
    expect(manufacturing.projectCeiling).toBe("10000000");
    expect(service.projectCeiling).toBe("5000000");
    expect(service.admissibleProjectCost).toBe("5000000");
  });

  it("does not inherit PMEGP rates or caps", () => {
    const result = unwrap(
      evaluateCmegp(
        input({
          beneficiaryCategory: a("SPECIAL"),
          areaClassification: a("RURAL"),
          actualBeneficiaryContribution: a(monetaryAmount("500000")),
        }),
      ),
    );
    expect(result.subsidyRate).toBe("35");
    expect(result.subsidyCap).toBe("1750000");
    expect(result.ruleTraces[1]?.sourceReferences[0]?.sourceId).toBe(
      "CMEGP.GR.2025-05-21",
    );
  });
});

describe("CMEGP eligibility, costs and lifecycle", () => {
  it("requires explicit Maharashtra project jurisdiction", () => {
    const other = unwrap(
      evaluateCmegp(input({ projectState: a("KARNATAKA") })),
    );
    expect(other.jurisdiction).toBe("OTHER");
    expect(other.eligibilityStatus).toBe("INELIGIBLE");
    const missing = unwrap(evaluateCmegp(input({ projectState: undefined })));
    expect(missing.eligibilityStatus).toBe("INSUFFICIENT_INFORMATION");
  });

  it("uses 10 percent general and 5 percent special contribution", () => {
    const general = unwrap(evaluateCmegp(input()));
    const special = unwrap(
      evaluateCmegp(
        input({
          beneficiaryCategory: a("SPECIAL"),
          actualBeneficiaryContribution: a(monetaryAmount("500000")),
        }),
      ),
    );
    expect(general.requiredContribution).toBe("1000000");
    expect(special.requiredContribution).toBe("500000");
    expect(general.expectedBankFinance).toBe("8250000");
  });

  it("caps working capital at 40 percent manufacturing and 60 percent service", () => {
    const manufacturing = unwrap(
      evaluateCmegp(
        input({
          costItems: [
            cost("M", "600", "MACHINERY_EQUIPMENT"),
            cost("W", "500", "WORKING_CAPITAL"),
          ],
          actualBeneficiaryContribution: a(monetaryAmount("100")),
        }),
      ),
    );
    const service = unwrap(
      evaluateCmegp(
        input({
          sector: a("SERVICE"),
          activityClassification: a("SERVICE"),
          costItems: [
            cost("M", "400", "MACHINERY_EQUIPMENT"),
            cost("W", "700", "WORKING_CAPITAL"),
          ],
          actualBeneficiaryContribution: a(monetaryAmount("100")),
        }),
      ),
    );
    expect(manufacturing.costLines[1]?.eligibleAmount).toBe("400");
    expect(service.costLines[1]?.eligibleAmount).toBe("600");
  });

  it("leaves land, rent, vehicle and other costs for manual review", () => {
    const result = unwrap(
      evaluateCmegp(
        input({
          costItems: [
            cost("M", "1000"),
            cost("L", "10", "LAND"),
            cost("R", "20", "RENTAL_OR_LEASE"),
            cost("V", "30", "VEHICLE"),
            cost("O", "40", "OTHER"),
          ],
          actualBeneficiaryContribution: a(monetaryAmount("110")),
        }),
      ),
    );
    expect(result.eligibleProjectCost).toBe("1000");
    expect(result.excludedCosts).toBe("100");
    expect(result.eligibilityStatus).toBe("MANUAL_REVIEW_REQUIRED");
  });

  it("preserves the current two-year verification and three-year adjustment flow", () => {
    const result = unwrap(evaluateCmegp(input()));
    expect(result.releaseMetadata.immediateBeneficiaryCash).toBe(false);
    expect(result.releaseMetadata.physicalVerificationAfterYears).toBe("2");
    expect(result.releaseMetadata.adjustmentAfterYears).toBe("3");
    expect(
      result.ruleTraces.at(-1)?.sourceReferences.map((item) => item.sourceId),
    ).toContain("CMEGP.GR.2025-10-28");
  });

  it("rejects negative costs, underage applicants, prior subsidy and negative-list activities", () => {
    expect(
      evaluateCmegp(
        input({ costItems: [{ ...cost("N", "1"), amount: "-1" as never }] }),
      ).ok,
    ).toBe(false);
    expect(
      unwrap(
        evaluateCmegp(input({ applicantAgeYears: a(decimalValue("17.99")) })),
      ).eligibilityStatus,
    ).toBe("INELIGIBLE");
    expect(
      unwrap(
        evaluateCmegp(input({ hasPriorGovernmentSubsidyBenefit: a(true) })),
      ).eligibilityStatus,
    ).toBe("INELIGIBLE");
    expect(
      unwrap(
        evaluateCmegp(
          input({ activityClassification: a("STATE_NEGATIVE_LIST_ACTIVITY") }),
        ),
      ).eligibilityStatus,
    ).toBe("INELIGIBLE");
  });

  it("uses exact Decimal arithmetic without intermediate rounding", () => {
    const result = unwrap(
      evaluateCmegp(
        input({
          costItems: [cost("M", "0.3")],
          actualBeneficiaryContribution: a(monetaryAmount("0.03")),
        }),
      ),
    );
    expect(result.rawSubsidy).toBe("0.045");
    expect(result.expectedBankFinance).toBe("0.225");
  });
});
