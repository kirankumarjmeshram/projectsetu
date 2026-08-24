import { describe, expect, it } from "vitest";

import { monetaryAmount } from "../shared/decimal";
import { classificationTag } from "../schemes/program";
import { composeMultiProgramFunding } from "./calculations";
import type {
  FundingComposerCalculationResult,
  FundingComposerInput,
} from "./contracts";
import {
  fixtureCompatibility,
  fixtureInput,
  fixtureProgram,
  fixtureSource,
  registryWith,
} from "./test-fixtures";

function unwrap(result: FundingComposerCalculationResult) {
  if (!result.ok)
    throw new Error(result.errors.map((error) => error.code).join(","));
  return result.value;
}

function twoCostInput(): FundingComposerInput {
  return fixtureInput({
    projectCost: {
      totalProjectCost: monetaryAmount("1000000"),
      costItems: [
        {
          costItemId: "MACHINE-A",
          category: "PLANT_AND_MACHINERY",
          tags: [classificationTag("CAPITAL")],
          amount: monetaryAmount("600000"),
          sourceReferences: [fixtureSource],
        },
        {
          costItemId: "MACHINE-B",
          category: "EQUIPMENT",
          tags: [classificationTag("CAPITAL")],
          amount: monetaryAmount("400000"),
          sourceReferences: [fixtureSource],
        },
      ],
    },
  });
}

describe("funding compatibility and allocations", () => {
  it("evaluates every unique pair and never infers transitive compatibility", () => {
    const a = fixtureProgram({ id: "TEST.A", noBenefits: true });
    const b = fixtureProgram({ id: "TEST.B", noBenefits: true });
    const c = fixtureProgram({ id: "TEST.C", noBenefits: true });
    const result = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          selectedPrograms: [
            { programId: c.programId },
            { programId: a.programId },
            { programId: b.programId },
          ],
        }),
        registryWith(a, b, c),
        [
          fixtureCompatibility({ left: "TEST.A", right: "TEST.B" }),
          fixtureCompatibility({ left: "TEST.B", right: "TEST.C" }),
        ],
      ),
    );

    expect(result.compatibilityEvaluations).toHaveLength(3);
    expect(
      result.compatibilityEvaluations.find(
        (pair) =>
          pair.leftProgram.programId === a.programId &&
          pair.rightProgram.programId === c.programId,
      )?.status,
    ).toBe("UNKNOWN");
    expect(result.resolutionStatus).toBe("MANUAL_REVIEW_REQUIRED");
  });

  it("returns explicit program incompatibility as a blocking conflict", () => {
    const a = fixtureProgram({ id: "TEST.A", noBenefits: true });
    const b = fixtureProgram({ id: "TEST.B", noBenefits: true });
    const result = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          selectedPrograms: [
            { programId: a.programId },
            { programId: b.programId },
          ],
        }),
        registryWith(a, b),
        [
          fixtureCompatibility({
            left: "TEST.A",
            right: "TEST.B",
            status: "PROHIBITED",
            policy: "NO_DOUBLE_ASSISTANCE",
          }),
        ],
      ),
    );

    expect(result.compatibilityEvaluations[0]?.status).toBe("INCOMPATIBLE");
    expect(result.conflicts.map((conflict) => conflict.code)).toContain(
      "PROGRAM_INCOMPATIBILITY",
    );
    expect(result.resolutionStatus).toBe("UNRESOLVED");
  });

  it("applies compatibility evidence only to the configured program versions", () => {
    const old = fixtureProgram({
      id: "TEST.VERSION_A",
      version: "old",
      effectiveFrom: "2024-01-01",
      effectiveTo: "2024-12-31",
      noBenefits: true,
    });
    const current = fixtureProgram({
      id: "TEST.VERSION_A",
      version: "current",
      effectiveFrom: "2025-01-01",
      noBenefits: true,
    });
    const b = fixtureProgram({ id: "TEST.VERSION_B", noBenefits: true });
    const rule = fixtureCompatibility({
      left: "TEST.VERSION_A",
      right: "TEST.VERSION_B",
      leftVersions: ["old"],
    });
    const registry = registryWith(old, current, b);
    const oldResult = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          evaluationAsOfDate: "2024-06-01",
          selectedPrograms: [
            { programId: old.programId },
            { programId: b.programId },
          ],
        }),
        registry,
        [rule],
      ),
    );
    const currentResult = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          selectedPrograms: [
            { programId: current.programId },
            { programId: b.programId },
          ],
        }),
        registry,
        [rule],
      ),
    );

    expect(oldResult.compatibilityEvaluations[0]?.status).toBe("COMPATIBLE");
    expect(currentResult.compatibilityEvaluations[0]?.status).toBe("UNKNOWN");
  });

  it("preserves conditional compatibility and its source-backed conditions", () => {
    const a = fixtureProgram({ id: "TEST.A", noBenefits: true });
    const b = fixtureProgram({ id: "TEST.B", noBenefits: true });
    const rule = {
      ...fixtureCompatibility({
        left: "TEST.A",
        right: "TEST.B",
        status: "ALLOWED_WITH_CONDITIONS",
      }),
      conditions: ["SEPARATE_LEDGER_REQUIRED"],
    };
    const result = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          selectedPrograms: [
            { programId: a.programId },
            { programId: b.programId },
          ],
        }),
        registryWith(a, b),
        [rule],
      ),
    );

    expect(result.compatibilityEvaluations[0]?.status).toBe(
      "CONDITIONALLY_COMPATIBLE",
    );
    expect(result.compatibilityEvaluations[0]?.conditions).toEqual([
      "SEPARATE_LEDGER_REQUIRED",
    ]);
    expect(result.resolutionStatus).toBe("RESOLVED_WITH_WARNINGS");
  });

  it("enforces benefit-level restrictions independently of program eligibility", () => {
    const subsidy = fixtureProgram({
      id: "TEST.SUBSIDY",
      specificCostItemIds: ["MACHINE-A"],
    });
    const grant = fixtureProgram({
      id: "TEST.GRANT",
      kind: "GRANT",
      specificCostItemIds: ["MACHINE-B"],
    });
    const result = unwrap(
      composeMultiProgramFunding(
        {
          ...twoCostInput(),
          selectedPrograms: [
            { programId: subsidy.programId },
            { programId: grant.programId },
          ],
        },
        registryWith(subsidy, grant),
        [
          fixtureCompatibility({
            left: "TEST.SUBSIDY",
            right: "TEST.GRANT",
            prohibitedBenefitTypes: ["GRANT"],
          }),
        ],
      ),
    );

    expect(result.benefitCompatibilityEvaluations[0]?.status).toBe(
      "INCOMPATIBLE",
    );
    expect(result.conflicts.map((conflict) => conflict.code)).toContain(
      "BENEFIT_INCOMPATIBILITY",
    );
  });

  it("detects same-cost double subsidy without double counting a resolved stack", () => {
    const a = fixtureProgram({ id: "TEST.A", rate: "10" });
    const b = fixtureProgram({ id: "TEST.B", rate: "20" });
    const result = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          selectedPrograms: [
            { programId: a.programId },
            { programId: b.programId },
          ],
        }),
        registryWith(a, b),
        [
          fixtureCompatibility({
            left: "TEST.A",
            right: "TEST.B",
            policy: "NO_DOUBLE_ASSISTANCE",
          }),
        ],
      ),
    );

    expect(result.conflicts.map((conflict) => conflict.code)).toEqual(
      expect.arrayContaining([
        "DOUBLE_FUNDING_CONFLICT",
        "COST_OVERALLOCATION",
      ]),
    );
    expect(result.resolutionStatus).toBe("UNRESOLVED");
  });

  it("auto-allocates officially compatible benefits to distinct cost lines", () => {
    const a = fixtureProgram({
      id: "TEST.A",
      fixedAmount: "60000",
      specificCostItemIds: ["MACHINE-A"],
    });
    const b = fixtureProgram({
      id: "TEST.B",
      fixedAmount: "40000",
      specificCostItemIds: ["MACHINE-B"],
    });
    const result = unwrap(
      composeMultiProgramFunding(
        {
          ...twoCostInput(),
          selectedPrograms: [
            { programId: a.programId },
            { programId: b.programId },
          ],
        },
        registryWith(a, b),
        [
          fixtureCompatibility({
            left: "TEST.A",
            right: "TEST.B",
            status: "ALLOWED_FOR_DISTINCT_COSTS",
            policy: "NO_DOUBLE_ASSISTANCE",
          }),
        ],
      ),
    );

    expect(result.conflicts).toEqual([]);
    expect(result.allocationLedger.map((entry) => entry.costItemId)).toEqual([
      "MACHINE-A",
      "MACHINE-B",
    ]);
    expect(result.summary.benefits.capitalSubsidy).toBe("100000");
  });

  it("accepts exact manual partial portions and rejects over-allocation", () => {
    const a = fixtureProgram({
      id: "TEST.A",
      fixedAmount: "60000",
      specificCostItemIds: ["MACHINE-A"],
    });
    const b = fixtureProgram({
      id: "TEST.B",
      fixedAmount: "40000",
      specificCostItemIds: ["MACHINE-A"],
    });
    const rule = fixtureCompatibility({
      left: "TEST.A",
      right: "TEST.B",
      status: "ALLOWED_FOR_DISTINCT_COSTS",
      policy: "DISTINCT_COST_PORTIONS_ONLY",
    });
    const base = fixtureInput({
      selectedPrograms: [
        { programId: a.programId },
        { programId: b.programId },
      ],
      requestedAllocations: [
        {
          allocationId: "ALLOC-A",
          programId: a.programId,
          benefitId: "TEST.A.BENEFIT",
          costItemId: "MACHINE-A",
          costPortionId: "PORTION-600",
          allocatedCostAmount: monetaryAmount("600000"),
        },
        {
          allocationId: "ALLOC-B",
          programId: b.programId,
          benefitId: "TEST.B.BENEFIT",
          costItemId: "MACHINE-A",
          costPortionId: "PORTION-400",
          allocatedCostAmount: monetaryAmount("400000"),
        },
      ],
    });
    const valid = unwrap(
      composeMultiProgramFunding(base, registryWith(a, b), [rule]),
    );
    expect(valid.conflicts).toEqual([]);
    expect(
      valid.allocationLedger.map((entry) => entry.allocatedCostAmount),
    ).toEqual(["600000", "400000"]);
    expect(valid.allocationLedger.at(-1)?.remainingCostAmount).toBe("0");
    expect(valid.summary.benefits.capitalSubsidy).toBe("100000");

    const over = unwrap(
      composeMultiProgramFunding(
        {
          ...base,
          requestedAllocations: base.requestedAllocations?.map((allocation) =>
            allocation.allocationId === "ALLOC-B"
              ? { ...allocation, allocatedCostAmount: monetaryAmount("500000") }
              : allocation,
          ),
        },
        registryWith(a, b),
        [rule],
      ),
    );
    expect(over.conflicts.map((conflict) => conflict.code)).toContain(
      "COST_OVERALLOCATION",
    );
  });

  it("requires explicit portions when a distinct-portion rule has competing auto claims", () => {
    const a = fixtureProgram({
      id: "TEST.A",
      fixedAmount: "60000",
      specificCostItemIds: ["MACHINE-A"],
    });
    const b = fixtureProgram({
      id: "TEST.B",
      fixedAmount: "40000",
      specificCostItemIds: ["MACHINE-A"],
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
        [
          fixtureCompatibility({
            left: "TEST.A",
            right: "TEST.B",
            status: "ALLOWED_FOR_DISTINCT_COSTS",
            policy: "DISTINCT_COST_PORTIONS_ONLY",
          }),
        ],
      ),
    );

    expect(result.conflicts.map((conflict) => conflict.code)).toEqual(
      expect.arrayContaining(["ALLOCATION_REQUIRED", "COST_OVERALLOCATION"]),
    );
  });

  it("validates unknown costs, unknown benefits, duplicate portions and ineligible costs", () => {
    const a = fixtureProgram({
      id: "TEST.A",
      fixedAmount: "10000",
      specificCostItemIds: ["MACHINE-A"],
    });
    const base = twoCostInput();
    const result = unwrap(
      composeMultiProgramFunding(
        {
          ...base,
          selectedPrograms: [{ programId: a.programId }],
          requestedAllocations: [
            {
              allocationId: "UNKNOWN-COST",
              programId: a.programId,
              benefitId: "TEST.A.BENEFIT",
              costItemId: "MISSING-COST",
              costPortionId: "P1",
              allocatedCostAmount: monetaryAmount("1"),
            },
            {
              allocationId: "UNKNOWN-BENEFIT",
              programId: a.programId,
              benefitId: "MISSING-BENEFIT",
              costItemId: "MACHINE-A",
              costPortionId: "P2",
              allocatedCostAmount: monetaryAmount("1"),
            },
            {
              allocationId: "INELIGIBLE-COST",
              programId: a.programId,
              benefitId: "TEST.A.BENEFIT",
              costItemId: "MACHINE-B",
              costPortionId: "P3",
              allocatedCostAmount: monetaryAmount("1"),
            },
            {
              allocationId: "VALID-A",
              programId: a.programId,
              benefitId: "TEST.A.BENEFIT",
              costItemId: "MACHINE-A",
              costPortionId: "DUPLICATE",
              allocatedCostAmount: monetaryAmount("1"),
            },
            {
              allocationId: "VALID-B",
              programId: a.programId,
              benefitId: "TEST.A.BENEFIT",
              costItemId: "MACHINE-A",
              costPortionId: "DUPLICATE",
              allocatedCostAmount: monetaryAmount("1"),
            },
          ],
        },
        registryWith(a),
        [],
      ),
    );

    expect(result.conflicts.map((conflict) => conflict.code)).toEqual(
      expect.arrayContaining([
        "UNKNOWN_COST_ITEM",
        "UNKNOWN_BENEFIT",
        "INELIGIBLE_COST_ALLOCATION",
        "DUPLICATE_COST_PORTION",
      ]),
    );
  });

  it("rejects negative manual allocation amounts", () => {
    const a = fixtureProgram({ id: "TEST.A" });
    const result = composeMultiProgramFunding(
      fixtureInput({
        selectedPrograms: [{ programId: a.programId }],
        requestedAllocations: [
          {
            allocationId: "NEGATIVE",
            programId: a.programId,
            benefitId: "TEST.A.BENEFIT",
            costItemId: "MACHINE-A",
            costPortionId: "P1",
            allocatedCostAmount: monetaryAmount("-1"),
          },
        ],
      }),
      registryWith(a),
      [],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((error) => error.code)).toContain(
        "NEGATIVE_ALLOCATION_AMOUNT",
      );
    }
  });

  it("preserves individual ineligibility while evaluating the remaining program", () => {
    const ineligible = fixtureProgram({
      id: "TEST.INELIGIBLE",
      noBenefits: true,
      eligibility: {
        groupId: "INELIGIBLE-GROUP",
        operator: "ALL",
        rules: [
          {
            ruleId: "MUST-BE-TRUE",
            name: "Required fact",
            type: "BOOLEAN",
            factPath: "project.qualifies",
            expectedValue: true,
            sourceReferences: [],
          },
        ],
      },
    });
    const eligible = fixtureProgram({ id: "TEST.ELIGIBLE", noBenefits: true });
    const result = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          facts: { project: { qualifies: false } },
          selectedPrograms: [
            { programId: ineligible.programId },
            { programId: eligible.programId },
          ],
        }),
        registryWith(ineligible, eligible),
        [
          fixtureCompatibility({
            left: "TEST.INELIGIBLE",
            right: "TEST.ELIGIBLE",
          }),
        ],
      ),
    );

    expect(result.resolutionStatus).toBe("INELIGIBLE_SELECTION");
    expect(result.individualProgramEvaluations).toHaveLength(2);
    expect(
      result.individualProgramEvaluations.find(
        (program) => program.snapshot?.programId === eligible.programId,
      )?.evaluation?.eligibility.status,
    ).toBe("ELIGIBLE");
  });

  it("preserves missing eligibility facts as insufficient information", () => {
    const program = fixtureProgram({
      id: "TEST.MISSING_FACT",
      noBenefits: true,
      eligibility: {
        groupId: "MISSING-FACT-GROUP",
        operator: "ALL",
        rules: [
          {
            ruleId: "REQUIRED-LOCATION",
            name: "Location required",
            type: "REQUIRED",
            factPath: "location.state",
            sourceReferences: [],
          },
        ],
      },
    });
    const result = unwrap(
      composeMultiProgramFunding(
        fixtureInput({ selectedPrograms: [{ programId: program.programId }] }),
        registryWith(program),
        [],
      ),
    );

    expect(
      result.individualProgramEvaluations[0]?.evaluation?.eligibility.status,
    ).toBe("INSUFFICIENT_INFORMATION");
    expect(result.resolutionStatus).toBe("MANUAL_REVIEW_REQUIRED");
    expect(result.manualReviewItems.map((item) => item.code)).toContain(
      "PROGRAM_INSUFFICIENT_INFORMATION",
    );
  });

  it("is order-independent for equivalent three-program inputs", () => {
    const programs = [
      fixtureProgram({ id: "TEST.A", noBenefits: true }),
      fixtureProgram({ id: "TEST.B", noBenefits: true }),
      fixtureProgram({ id: "TEST.C", noBenefits: true }),
    ];
    const rules = [
      fixtureCompatibility({ left: "TEST.A", right: "TEST.B" }),
      fixtureCompatibility({ left: "TEST.A", right: "TEST.C" }),
      fixtureCompatibility({ left: "TEST.B", right: "TEST.C" }),
    ];
    const registry = registryWith(...programs);
    const first = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          selectedPrograms: programs.map((program) => ({
            programId: program.programId,
          })),
        }),
        registry,
        rules,
      ),
    );
    const second = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          selectedPrograms: [...programs]
            .reverse()
            .map((program) => ({ programId: program.programId })),
        }),
        registry,
        rules,
      ),
    );

    expect(second.summary).toEqual(first.summary);
    expect(second.compatibilityEvaluations).toEqual(
      first.compatibilityEvaluations,
    );
    expect(second.resolutionStatus).toBe(first.resolutionStatus);
  });
});
