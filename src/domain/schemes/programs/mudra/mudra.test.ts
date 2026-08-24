import { describe, expect, it } from "vitest";

import type { Assumption } from "../../../shared/assumptions";
import type { CalculationResult } from "../../../shared/calculation";
import { monetaryAmount } from "../../../shared/decimal";
import type { SourceReference } from "../../../shared/provenance";
import type { MudraEvaluationInput } from "./contracts";
import { evaluateMudra } from "./evaluation";
import { mudraProgramDefinition } from "./index";

const source: SourceReference = { id: "TEST.SOURCE", type: "USER_INPUT" };
const a = <T>(value: T): Assumption<T> => ({ value, source });
function unwrap<T>(result: CalculationResult<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected success");
  return result.value;
}
function input(amount: string): MudraEvaluationInput {
  return {
    projectId: "P1",
    evaluationAsOfDate: "2026-08-24",
    requestedCredit: a(monetaryAmount(amount)),
    activity: a("MANUFACTURING"),
    financingPurpose: a("BOTH"),
  };
}

describe("PMMY credit categories", () => {
  it.each([
    ["0", "SHISHU"],
    ["50000", "SHISHU"],
    ["50000.01", "KISHORE"],
    ["500000", "KISHORE"],
    ["500000.01", "TARUN"],
    ["1000000", "TARUN"],
    ["1000000.01", "TARUN_PLUS"],
    ["2000000", "TARUN_PLUS"],
  ] as const)("maps Rs %s to %s", (amount, category) => {
    const base = input(amount);
    const result = unwrap(
      evaluateMudra(
        category === "TARUN_PLUS"
          ? {
              ...base,
              hasPriorTarunLoan: a(true),
              priorTarunSuccessfullyRepaid: a(true),
            }
          : base,
      ),
    );
    expect(result.applicableCategory).toBe(category);
  });

  it("rejects requested credit above Rs 20 lakh", () => {
    const result = unwrap(evaluateMudra(input("2000000.01")));
    expect(result.applicableCategory).toBeUndefined();
    expect(result.eligibilityStatus).toBe("INELIGIBLE");
  });

  it("rejects negative requested credit as invalid input", () => {
    const result = evaluateMudra({
      ...input("1"),
      requestedCredit: a("-0.01" as never),
    });
    expect(result.ok).toBe(false);
  });
});

describe("PMMY Tarun Plus and credit boundaries", () => {
  it("requires explicit successful prior Tarun repayment", () => {
    const missing = unwrap(evaluateMudra(input("1500000")));
    expect(missing.eligibilityStatus).toBe("INSUFFICIENT_INFORMATION");
    const noPrior = unwrap(
      evaluateMudra({ ...input("1500000"), hasPriorTarunLoan: a(false) }),
    );
    expect(noPrior.eligibilityStatus).toBe("INELIGIBLE");
    const notRepaid = unwrap(
      evaluateMudra({
        ...input("1500000"),
        hasPriorTarunLoan: a(true),
        priorTarunSuccessfullyRepaid: a(false),
      }),
    );
    expect(notRepaid.eligibilityStatus).toBe("INELIGIBLE");
  });

  it("allows term loan, working capital and allied agriculture purposes", () => {
    const result = unwrap(
      evaluateMudra({
        ...input("50000"),
        activity: a("POULTRY"),
        financingPurpose: a("WORKING_CAPITAL"),
      }),
    );
    expect(result.termLoanAllowed).toBe(true);
    expect(result.workingCapitalAllowed).toBe(true);
    expect(result.collateralRequirementMetadata).toBe(
      "COLLATERAL_NOT_REQUIRED_UNDER_PROGRAM",
    );
    expect(result.eligibilityStatus).toBe("ELIGIBLE");
  });

  it("does not invent a subsidy benefit for MUDRA", () => {
    expect(mudraProgramDefinition.programTypes).toEqual(["CREDIT_PROGRAM"]);
    expect(mudraProgramDefinition.benefits).toEqual([]);
    const serialized = JSON.stringify(unwrap(evaluateMudra(input("50000"))));
    expect(serialized).not.toContain("subsidy");
  });

  it("retains the official current rule source in category traces", () => {
    const result = unwrap(evaluateMudra(input("50000")));
    expect(result.snapshot.programVersionId).toBe("2024-10-24-TARUN-PLUS");
    expect(
      result.ruleTraces[0]?.sourceReferences.map((item) => item.sourceId),
    ).toContain("PMMY.DFS.CURRENT.2026-02-05");
  });
});
