import { calculationFailure, calculationSuccess } from "../shared/calculation";
import type { CalculationResult } from "../shared/calculation";
import { monetaryAmount, toDecimal, toMonetaryAmount } from "../shared/decimal";
import type { Identifier } from "../shared/types";
import type { MeansOfFinanceSummary } from "../financing/calculations";
import type { FinanceSource, FinanceSourceType } from "../financing/financing";
import type { ProjectCostSummary } from "../project-cost/calculations";
import { classificationTag } from "../schemes/program";
import type { ClassificationTag, SchemeCostItem } from "../schemes/program";
import type {
  AuthoritativeFinancingInput,
  AuthoritativeProjectCostInput,
  OtherSourceBackedFinance,
  SourceBackedAmount,
} from "./contracts";

const promoterTypes = new Set<FinanceSourceType>([
  "PROMOTER_CONTRIBUTION",
  "EQUITY",
  "OTHER_CONTRIBUTION",
]);
const bankTypes = new Set<FinanceSourceType>([
  "TERM_LOAN",
  "WORKING_CAPITAL_FINANCE",
  "OTHER_INSTITUTIONAL_FINANCE",
]);
const capitalCategories = new Set([
  "LAND",
  "LAND_DEVELOPMENT",
  "BUILDING",
  "CIVIL_WORKS",
  "PLANT_AND_MACHINERY",
  "EQUIPMENT",
  "ELECTRICAL_INSTALLATION",
  "FURNITURE",
  "VEHICLE",
  "COMPUTERS_AND_IT",
  "OTHER_FIXED_ASSET",
]);

function uniqueTags(tags: readonly ClassificationTag[]) {
  return [...new Set(tags)];
}

export function adaptProjectCostSummary(
  summary: ProjectCostSummary,
  additionalTagsByCostItem: Readonly<
    Record<Identifier, readonly ClassificationTag[]>
  > = {},
): AuthoritativeProjectCostInput {
  const costItems: SchemeCostItem[] = summary.lines.map((line) => {
    const tags = [classificationTag(line.input.category)];
    if (capitalCategories.has(line.input.category)) {
      tags.push(classificationTag("CAPITAL"));
    }
    if (line.input.category === "MARGIN_FOR_WORKING_CAPITAL") {
      tags.push(classificationTag("WORKING_CAPITAL"));
    }
    tags.push(...(additionalTagsByCostItem[line.input.id] ?? []));
    return {
      costItemId: line.input.id,
      category: line.input.category,
      amount: line.finalAmount,
      tags: uniqueTags(tags),
      sourceReferences: [
        ...(line.input.sourceReferences ?? []),
        line.input.amount.source,
      ],
    };
  });
  return { totalProjectCost: summary.totalProjectCost, costItems };
}

function aggregateSources(
  sources: readonly FinanceSource[],
): SourceBackedAmount | undefined {
  if (sources.length === 0) return undefined;
  const total = sources.reduce(
    (sum, source) => sum.plus(toDecimal(source.amount)),
    toDecimal(monetaryAmount("0")),
  );
  return {
    value: toMonetaryAmount(total),
    sourceReferences: sources.map((source) => source.source!),
  };
}

export function adaptMeansOfFinanceSummary(
  summary: MeansOfFinanceSummary,
  initialAvailability: (source: FinanceSource) => boolean = (source) =>
    source.type !== "GOVERNMENT_SUBSIDY_OR_GRANT",
): CalculationResult<AuthoritativeFinancingInput> {
  const missingSources = summary.sources.flatMap((source, index) =>
    source.source
      ? []
      : [
          {
            code: "MISSING_FINANCE_SOURCE_PROVENANCE",
            message:
              "Means-of-finance lines require source provenance before composition.",
            path: `sources.${index}.source`,
          },
        ],
  );
  if (missingSources.length > 0) return calculationFailure(...missingSources);

  const promoter = summary.sources.filter((source) =>
    promoterTypes.has(source.type),
  );
  const bank = summary.sources.filter((source) => bankTypes.has(source.type));
  const other = summary.sources.filter(
    (source) => !promoterTypes.has(source.type) && !bankTypes.has(source.type),
  );
  const otherFinance: OtherSourceBackedFinance[] = other.map((source) => ({
    financeSourceId: source.id,
    value: source.amount,
    sourceReferences: [source.source!],
    availableAtInitialFunding: initialAvailability(source),
  }));
  const promoterContribution = aggregateSources(promoter);
  const bankFinance = aggregateSources(bank);
  return calculationSuccess({
    ...(promoterContribution ? { promoterContribution } : {}),
    ...(bankFinance ? { bankFinance } : {}),
    otherFinance,
  });
}
