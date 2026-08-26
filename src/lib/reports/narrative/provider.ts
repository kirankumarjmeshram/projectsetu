import type { DprReportModel, ReportNarrative } from "../contracts";

export interface NarrativeRequest {
  readonly sectionId: string;
  readonly sectionTitle: string;
  readonly facts: Readonly<Record<string, string | readonly string[]>>;
  readonly allowedFinancialValues: readonly string[];
}

export interface NarrativeProvider {
  readonly name: string;
  generate(request: NarrativeRequest): Promise<ReportNarrative>;
}

export interface ExternalNarrativeGenerator {
  generateText(request: NarrativeRequest): Promise<string>;
}

const MAX_NARRATIVE_LENGTH = 4_000;
const numericToken = /(?:₹\s*)?-?\d[\d,]*(?:\.\d+)?%?/g;

function normalizeNumber(token: string): string {
  return token.replace(/[₹,%\s]/g, "").replace(/^\+/, "");
}

export function validateGeneratedNarrative(
  text: string,
  allowedValues: readonly string[],
): boolean {
  if (
    !text.trim() ||
    text.length > MAX_NARRATIVE_LENGTH ||
    /<\/?(?:script|iframe|object)\b/i.test(text)
  ) {
    return false;
  }
  const allowed = new Set(allowedValues.map(normalizeNumber));
  for (const token of text.match(numericToken) ?? []) {
    const normalized = normalizeNumber(token);
    if (
      !allowed.has(normalized) &&
      !["1", "2", "3", "4", "5"].includes(normalized)
    ) {
      return false;
    }
  }
  return true;
}

export class GuardedNarrativeProvider implements NarrativeProvider {
  readonly name = "guarded-optional-ai";

  constructor(
    private readonly fallback: NarrativeProvider,
    private readonly external?: ExternalNarrativeGenerator,
  ) {}

  async generate(request: NarrativeRequest): Promise<ReportNarrative> {
    if (!this.external) return this.fallback.generate(request);
    try {
      const text = await this.external.generateText(request);
      if (!validateGeneratedNarrative(text, request.allowedFinancialValues)) {
        return this.fallback.generate(request);
      }
      return { text, provenance: "AI_VALIDATED", approved: false };
    } catch {
      return this.fallback.generate(request);
    }
  }
}

/** Extracts the exact values an optional provider is permitted to repeat. */
export function collectAllowedFinancialValues(
  model: Pick<DprReportModel, "sections">,
): string[] {
  return model.sections.flatMap((section) =>
    section.tables.flatMap((table) =>
      table.rows.flatMap((row) =>
        row.flatMap((cell) =>
          cell.authoritativeValue ? [cell.authoritativeValue] : [],
        ),
      ),
    ),
  );
}
