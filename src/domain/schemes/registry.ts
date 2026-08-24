import type {
  CalculationError,
  CalculationResult,
} from "../shared/calculation";
import { calculationFailure, calculationSuccess } from "../shared/calculation";
import { monetaryAmount, toDecimal } from "../shared/decimal";
import type { ISODate } from "../shared/types";
import type {
  FinancingProgramDefinition,
  ProgramId,
  ProgramVersionId,
} from "./program";

function isValidIsoDate(value: string): value is ISODate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function appliesOnDate(
  definition: FinancingProgramDefinition,
  asOfDate: ISODate,
): boolean {
  return (
    definition.effectiveFrom <= asOfDate &&
    (definition.effectiveTo === undefined || definition.effectiveTo >= asOfDate)
  );
}

function validateDefinition(
  definition: FinancingProgramDefinition,
): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  if (!isValidIsoDate(definition.effectiveFrom)) {
    errors.push({
      code: "INVALID_PROGRAM_EFFECTIVE_FROM",
      message: "Program effectiveFrom must be a valid ISO calendar date.",
      path: "effectiveFrom",
    });
  }
  if (
    definition.effectiveTo !== undefined &&
    !isValidIsoDate(definition.effectiveTo)
  ) {
    errors.push({
      code: "INVALID_PROGRAM_EFFECTIVE_TO",
      message: "Program effectiveTo must be a valid ISO calendar date.",
      path: "effectiveTo",
    });
  }
  if (
    definition.effectiveTo !== undefined &&
    definition.effectiveTo < definition.effectiveFrom
  ) {
    errors.push({
      code: "INVALID_PROGRAM_EFFECTIVE_RANGE",
      message: "Program effectiveTo must not precede effectiveFrom.",
      path: "effectiveTo",
    });
  }
  if (definition.programTypes.length === 0) {
    errors.push({
      code: "MISSING_PROGRAM_TYPE",
      message: "A program definition must identify at least one program type.",
      path: "programTypes",
    });
  }
  if (definition.sourceReferences.length === 0) {
    errors.push({
      code: "MISSING_PROGRAM_PROVENANCE",
      message: "A program version must retain at least one source reference.",
      path: "sourceReferences",
    });
  }
  try {
    if (
      definition.overallBenefitCap !== undefined &&
      toDecimal(
        monetaryAmount(definition.overallBenefitCap.amount),
      ).isNegative()
    ) {
      errors.push({
        code: "NEGATIVE_OVERALL_PROGRAM_BENEFIT_CAP",
        message: "Overall program benefit cap must not be negative.",
        path: "overallBenefitCap",
      });
    }
  } catch {
    errors.push({
      code: "INVALID_OVERALL_PROGRAM_BENEFIT_CAP",
      message:
        "Overall program benefit cap must be a canonical monetary value.",
      path: "overallBenefitCap",
    });
  }
  if (
    definition.overallBenefitCap !== undefined &&
    definition.overallBenefitCap.sourceReferences.length === 0
  ) {
    errors.push({
      code: "MISSING_OVERALL_PROGRAM_BENEFIT_CAP_PROVENANCE",
      message: "Overall program benefit cap must retain source provenance.",
      path: "overallBenefitCap.sourceReferences",
    });
  }

  const benefitIds = new Set<string>();
  for (const [index, benefit] of definition.benefits.entries()) {
    if (benefitIds.has(benefit.benefitId)) {
      errors.push({
        code: "DUPLICATE_PROGRAM_BENEFIT_ID",
        message: "Benefit ids must be unique within a program version.",
        path: `benefits.${index}.benefitId`,
      });
    }
    benefitIds.add(benefit.benefitId);
  }
  return errors;
}

function deepFreeze<TValue>(value: TValue): TValue {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Append-only in-memory domain registry. Persistence belongs to a future adapter. */
export class FinancingProgramRegistry {
  readonly #definitions = new Map<string, FinancingProgramDefinition>();

  registerProgramDefinition(
    definition: FinancingProgramDefinition,
  ): CalculationResult<FinancingProgramDefinition> {
    const errors = validateDefinition(definition);
    if (errors.length > 0) return calculationFailure(...errors);

    const key = this.key(definition.programId, definition.versionId);
    if (this.#definitions.has(key)) {
      return calculationFailure({
        code: "PROGRAM_VERSION_ALREADY_REGISTERED",
        message:
          "Registered program versions are immutable; create a new version id for changed rules.",
        path: "versionId",
      });
    }
    const immutableDefinition = deepFreeze(definition);
    this.#definitions.set(key, immutableDefinition);
    return calculationSuccess(immutableDefinition);
  }

  getProgramDefinition(
    programId: ProgramId,
    versionId: ProgramVersionId,
  ): CalculationResult<FinancingProgramDefinition> {
    const definition = this.#definitions.get(this.key(programId, versionId));
    return definition
      ? calculationSuccess(definition)
      : calculationFailure({
          code: "PROGRAM_VERSION_NOT_FOUND",
          message: "The requested program version is not registered.",
        });
  }

  resolveProgramVersion(input: {
    readonly programId: ProgramId;
    readonly asOfDate: ISODate;
  }): CalculationResult<FinancingProgramDefinition> {
    if (!isValidIsoDate(input.asOfDate)) {
      return calculationFailure({
        code: "INVALID_PROGRAM_RESOLUTION_DATE",
        message: "Program resolution date must be a valid ISO calendar date.",
        path: "asOfDate",
      });
    }
    const candidates = [...this.#definitions.values()]
      .filter(
        (definition) =>
          definition.programId === input.programId &&
          !["DRAFT", "SUSPENDED", "ARCHIVED"].includes(definition.status) &&
          appliesOnDate(definition, input.asOfDate),
      )
      .sort((left, right) =>
        right.effectiveFrom.localeCompare(left.effectiveFrom),
      );

    if (candidates.length === 0) {
      return calculationFailure({
        code: "PROGRAM_VERSION_NOT_EFFECTIVE",
        message:
          "No registered selectable version applies on the requested date.",
      });
    }
    if (
      candidates.length > 1 &&
      candidates[0]!.effectiveFrom === candidates[1]!.effectiveFrom
    ) {
      return calculationFailure({
        code: "AMBIGUOUS_PROGRAM_VERSION_RESOLUTION",
        message:
          "Multiple program versions share the latest effective date; explicit version selection is required.",
      });
    }
    return calculationSuccess(candidates[0]!);
  }

  listActivePrograms(
    asOfDate: ISODate,
  ): CalculationResult<readonly FinancingProgramDefinition[]> {
    if (!isValidIsoDate(asOfDate)) {
      return calculationFailure({
        code: "INVALID_PROGRAM_LIST_DATE",
        message: "Active-program date must be a valid ISO calendar date.",
        path: "asOfDate",
      });
    }
    return calculationSuccess(
      [...this.#definitions.values()]
        .filter(
          (definition) =>
            definition.status === "ACTIVE" &&
            appliesOnDate(definition, asOfDate),
        )
        .sort((left, right) =>
          left.programId === right.programId
            ? left.effectiveFrom.localeCompare(right.effectiveFrom)
            : left.programId.localeCompare(right.programId),
        ),
    );
  }

  listRegisteredVersions(
    programId: ProgramId,
  ): readonly FinancingProgramDefinition[] {
    return [...this.#definitions.values()]
      .filter((definition) => definition.programId === programId)
      .sort((left, right) =>
        left.effectiveFrom.localeCompare(right.effectiveFrom),
      );
  }

  private key(programId: ProgramId, versionId: ProgramVersionId): string {
    return `${programId}::${versionId}`;
  }
}
