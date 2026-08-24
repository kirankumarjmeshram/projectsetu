import { describe, expect, it } from "vitest";

import type { CalculationResult } from "../shared/calculation";
import { monetaryAmount, percentage } from "../shared/decimal";
import type {
  FinancingProgramDefinition,
  FinancialBenefitDefinition,
} from "./program";
import {
  classificationTag,
  InvalidProgramIdentityError,
  programId,
  programVersionId,
} from "./program";
import { FinancingProgramRegistry } from "./registry";
import { createTestProgram } from "./testing/test-programs";

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

function versionedDefinitions(): readonly FinancingProgramDefinition[] {
  return [
    createTestProgram({
      versionId: programVersionId("v1"),
      effectiveFrom: "2024-01-01",
      effectiveTo: "2024-12-31",
      status: "SUPERSEDED",
      benefits: [
        {
          ...createTestProgram().benefits[0]!,
          rate: percentage("20"),
        } as FinancialBenefitDefinition,
      ],
    }),
    createTestProgram({
      versionId: programVersionId("v2"),
      effectiveFrom: "2025-01-01",
      status: "ACTIVE",
      benefits: [
        {
          ...createTestProgram().benefits[0]!,
          rate: percentage("30"),
        } as FinancialBenefitDefinition,
      ],
    }),
  ];
}

describe("program identity", () => {
  it("supports open namespaced program ids and custom programs", () => {
    expect(programId("GOI.FUTURE_PROGRAM")).toBe("GOI.FUTURE_PROGRAM");
    expect(programId("CUSTOM.CONSULTANT_42")).toBe("CUSTOM.CONSULTANT_42");
    expect(programVersionId("2026-guidelines")).toBe("2026-guidelines");
    expect(classificationTag("LIVESTOCK.GOAT")).toBe("LIVESTOCK.GOAT");
  });

  it("rejects unnamespaced or malformed machine identities", () => {
    expect(() => programId("PMEGP")).toThrow(InvalidProgramIdentityError);
    expect(() => programId("goi.program")).toThrow(InvalidProgramIdentityError);
    expect(() => programVersionId("version one")).toThrow(
      InvalidProgramIdentityError,
    );
  });
});

describe("FinancingProgramRegistry", () => {
  it("registers and retrieves an arbitrary definition without a central enum", () => {
    const registry = new FinancingProgramRegistry();
    const definition = createTestProgram({
      programId: programId("CUSTOM.NEW_PROGRAM"),
    });
    unwrap(registry.registerProgramDefinition(definition));
    expect(
      unwrap(
        registry.getProgramDefinition(
          definition.programId,
          definition.versionId,
        ),
      ),
    ).toBe(definition);
  });

  it("selects the correct version by as-of date", () => {
    const registry = new FinancingProgramRegistry();
    for (const definition of versionedDefinitions()) {
      unwrap(registry.registerProgramDefinition(definition));
    }
    expect(
      unwrap(
        registry.resolveProgramVersion({
          programId: programId("TEST.CAPITAL_SUBSIDY"),
          asOfDate: "2024-06-01",
        }),
      ).versionId,
    ).toBe("v1");
    expect(
      unwrap(
        registry.resolveProgramVersion({
          programId: programId("TEST.CAPITAL_SUBSIDY"),
          asOfDate: "2025-06-01",
        }),
      ).versionId,
    ).toBe("v2");
  });

  it("keeps historical versions explicitly resolvable", () => {
    const registry = new FinancingProgramRegistry();
    for (const definition of versionedDefinitions()) {
      unwrap(registry.registerProgramDefinition(definition));
    }
    const historical = unwrap(
      registry.getProgramDefinition(
        programId("TEST.CAPITAL_SUBSIDY"),
        programVersionId("v1"),
      ),
    );
    expect(historical.status).toBe("SUPERSEDED");
    expect(
      historical.benefits[0]?.calculation === "PERCENTAGE"
        ? historical.benefits[0].rate
        : undefined,
    ).toBe("20");
  });

  it("retains retired versions but excludes them from active listings", () => {
    const registry = new FinancingProgramRegistry();
    const retired = createTestProgram({
      programId: programId("TEST.RETIRED"),
      status: "RETIRED",
      effectiveTo: "2024-12-31",
    });
    const active = createTestProgram({
      programId: programId("TEST.ACTIVE"),
    });
    unwrap(registry.registerProgramDefinition(retired));
    unwrap(registry.registerProgramDefinition(active));
    expect(
      unwrap(
        registry.getProgramDefinition(retired.programId, retired.versionId),
      ),
    ).toBe(retired);
    expect(
      unwrap(registry.listActivePrograms("2024-06-01")).map(
        (definition) => definition.programId,
      ),
    ).toEqual(["TEST.ACTIVE"]);
  });

  it("rejects mutation-by-reregistration of an existing version", () => {
    const registry = new FinancingProgramRegistry();
    const definition = createTestProgram();
    unwrap(registry.registerProgramDefinition(definition));
    expectError(
      registry.registerProgramDefinition({
        ...definition,
        displayName: "Changed historical rules",
      }),
      "PROGRAM_VERSION_ALREADY_REGISTERED",
    );
    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(definition.eligibility.rules)).toBe(true);
  });

  it("rejects invalid effective dates and reversed ranges", () => {
    const registry = new FinancingProgramRegistry();
    expectError(
      registry.registerProgramDefinition(
        createTestProgram({ effectiveFrom: "2024-02-30" }),
      ),
      "INVALID_PROGRAM_EFFECTIVE_FROM",
    );
    expectError(
      registry.registerProgramDefinition(
        createTestProgram({
          effectiveFrom: "2025-01-01",
          effectiveTo: "2024-12-31",
        }),
      ),
      "INVALID_PROGRAM_EFFECTIVE_RANGE",
    );
  });

  it("requires provenance and unique benefit identities", () => {
    const registry = new FinancingProgramRegistry();
    expectError(
      registry.registerProgramDefinition(
        createTestProgram({ sourceReferences: [] }),
      ),
      "MISSING_PROGRAM_PROVENANCE",
    );
    const definition = createTestProgram();
    expectError(
      registry.registerProgramDefinition(
        createTestProgram({
          benefits: [definition.benefits[0]!, definition.benefits[0]!],
        }),
      ),
      "DUPLICATE_PROGRAM_BENEFIT_ID",
    );
    expectError(
      registry.registerProgramDefinition(
        createTestProgram({
          overallBenefitCap: {
            amount: monetaryAmount("100"),
            sourceReferences: [],
          },
        }),
      ),
      "MISSING_OVERALL_PROGRAM_BENEFIT_CAP_PROVENANCE",
    );
  });

  it("requires explicit selection when latest effective dates are ambiguous", () => {
    const registry = new FinancingProgramRegistry();
    unwrap(registry.registerProgramDefinition(createTestProgram()));
    unwrap(
      registry.registerProgramDefinition(
        createTestProgram({ versionId: programVersionId("v1-alternate") }),
      ),
    );
    expectError(
      registry.resolveProgramVersion({
        programId: programId("TEST.CAPITAL_SUBSIDY"),
        asOfDate: "2024-06-01",
      }),
      "AMBIGUOUS_PROGRAM_VERSION_RESOLUTION",
    );
  });
});
