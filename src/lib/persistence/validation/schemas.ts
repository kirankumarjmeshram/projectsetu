import { z } from "zod";

// ─── Decimal string validation ──────────────────────────────────────────────
const decimalStringSchema = z
  .string()
  .regex(
    /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/,
    "Expected a canonical decimal string (no scientific notation, NaN, or Infinity)",
  );

// ─── Snapshot envelope ──────────────────────────────────────────────────────
export const snapshotEnvelopeSchema = z.object({
  snapshotType: z.string().min(1),
  schemaVersion: z.number().int().positive(),
});

// ─── Project input snapshot data ────────────────────────────────────────────
export const projectInputSnapshotDataSchema = z
  .object({
    project: z.object({
      name: z.string().min(1),
      mode: z.enum(["SELF_FUNDED", "BANKABLE", "SUBSIDY"]),
      industryActivity: z.string().min(1),
      stage: z.enum([
        "CONCEPT",
        "PLANNING",
        "PRE_IMPLEMENTATION",
        "IMPLEMENTATION",
        "OPERATIONAL",
      ]),
      status: z.enum(["DRAFT", "IN_REVIEW", "FINALIZED", "ARCHIVED"]),
      projectionPeriodYears: z.number().int().positive(),
      location: z.object({
        address: z.object({
          lines: z.array(z.string()),
          villageTownCity: z.string().optional(),
          district: z.string(),
          state: z.string(),
          pinCode: z.string().optional(),
        }),
        areaClassification: z.enum(["RURAL", "URBAN", "UNCLASSIFIED"]),
        classificationSource: z.unknown().optional(),
      }),
      implementationPeriod: z
        .object({
          from: z.string(),
          until: z.string().optional(),
        })
        .optional(),
    }),
    applicant: z.unknown().optional(),
    costItems: z.array(z.unknown()).optional(),
    financing: z.unknown().optional(),
    operatingInputs: z.unknown().optional(),
    metadata: z
      .object({
        createdAt: z.string(),
        updatedAt: z.string(),
      })
      .optional(),
  })
  .passthrough();

// ─── Calculation snapshot data ──────────────────────────────────────────────
export const calculationSnapshotDataSchema = z
  .object({
    snapshotType: z.string().min(1),
    schemaVersion: z.number().int().positive(),
  })
  .passthrough();

// ─── Funding snapshot data ──────────────────────────────────────────────────
export const fundingSnapshotDataSchema = z
  .object({
    snapshotType: z.string().min(1),
    schemaVersion: z.number().int().positive(),
    projectId: z.string(),
    evaluationAsOfDate: z.string(),
    mode: z.string(),
    resolutionStatus: z.string(),
  })
  .passthrough();

// ─── Report sections ───────────────────────────────────────────────────────
export const reportSectionSelectionSchema = z.object({
  sectionCode: z.string(),
  included: z.boolean(),
  order: z.number().int().optional(),
});

// ─── Program context for reports ────────────────────────────────────────────
export const programContextSchema = z
  .object({
    programId: z.string(),
    versionId: z.string().optional(),
    evaluationAsOfDate: z.string().optional(),
  })
  .passthrough();

// ─── Validators ─────────────────────────────────────────────────────────────

/**
 * Validates a JSONB value read from the database as a project input snapshot.
 * Untrusted data must pass runtime validation before becoming domain data.
 */
export function validateProjectInputSnapshot(
  data: unknown,
): z.infer<typeof projectInputSnapshotDataSchema> {
  return projectInputSnapshotDataSchema.parse(data);
}

/**
 * Validates a JSONB value as a calculation snapshot envelope.
 * The full domain-specific validation is type-discriminated.
 */
export function validateCalculationSnapshot(
  data: unknown,
): z.infer<typeof calculationSnapshotDataSchema> {
  return calculationSnapshotDataSchema.parse(data);
}

/**
 * Validates a JSONB value as a funding composer snapshot.
 */
export function validateFundingSnapshot(
  data: unknown,
): z.infer<typeof fundingSnapshotDataSchema> {
  return fundingSnapshotDataSchema.parse(data);
}

/**
 * Validates a JSONB value as a report sections array.
 */
export function validateReportSections(
  data: unknown,
): z.infer<typeof reportSectionSelectionSchema>[] {
  return z.array(reportSectionSelectionSchema).parse(data);
}

/**
 * Validates that a string is a canonical decimal (no scientific notation,
 * NaN, Infinity). For use when reading decimal strings from JSONB.
 */
export function validateDecimalString(value: unknown): string {
  return decimalStringSchema.parse(value);
}
