import { ProjectSetuDecimal } from "@/domain/shared/decimal";
import type { ProjectCostCategory } from "@/domain/project-cost/project-cost";
import type { ProjectCostItemInput } from "@/lib/application/orchestrator/orchestrator-types";
import { generateId } from "@/lib/persistence/id";

import type {
  NormalizedQuotation,
  NormalizedQuotationLine,
  QuotationLineMapping,
} from "./contracts";
import { normalizeIndianNumberString } from "./normalization";

export interface LineAllocationSummary {
  readonly lineId: string;
  readonly lineTotal: string;
  readonly allocatedAmount: string;
  readonly remainingAmount: string;
  readonly isFullyAllocated: boolean;
}

/**
 * Calculates remaining mappable amount for a quotation line against active allocations.
 * Prevents double counting by ensuring total mapped amount never silently exceeds approved line total.
 */
export function computeLineAllocationSummary(
  line: NormalizedQuotationLine,
  activeMappings: readonly QuotationLineMapping[],
): LineAllocationSummary {
  const lineTotalDec = new ProjectSetuDecimal(
    normalizeIndianNumberString(line.lineTotal, "0"),
  );

  const allocatedDec = activeMappings
    .filter((m) => m.quotationLineId === line.lineId && m.status === "ACTIVE")
    .reduce(
      (sum, m) =>
        sum.plus(
          new ProjectSetuDecimal(
            normalizeIndianNumberString(m.mappedAmount, "0"),
          ),
        ),
      new ProjectSetuDecimal("0"),
    );

  const remainingDec = lineTotalDec.minus(allocatedDec);
  const remainingAmount = remainingDec.isNegative()
    ? "0"
    : remainingDec.toFixed();

  return {
    lineId: line.lineId,
    lineTotal: lineTotalDec.toFixed(),
    allocatedAmount: allocatedDec.toFixed(),
    remainingAmount,
    isFullyAllocated: remainingDec.lessThanOrEqualTo("0"),
  };
}

export interface MapQuotationLineInstruction {
  readonly quotationLineId: string;
  readonly costCategory: ProjectCostCategory;
  readonly mappingType:
    "NEW_ITEM" | "EXISTING_ITEM" | "PARTIAL_ALLOCATION" | "AGGREGATED";
  readonly targetCostItemId?: string; // for EXISTING_ITEM or AGGREGATED
  readonly customDescription?: string;
  readonly customAmount?: string; // for PARTIAL_ALLOCATION or custom amount override
  readonly includeGstInCost?: boolean;
}

export interface QuotationMappingResult {
  readonly success: boolean;
  readonly updatedCostItems: readonly ProjectCostItemInput[];
  readonly createdMappings: readonly QuotationLineMapping[];
  readonly error?: string;
}

/**
 * Maps approved quotation lines to authoritative Project Cost items.
 * Implements strict double-counting protection and attaches source provenance.
 */
export function mapQuotationLinesToProjectCost(
  quotation: NormalizedQuotation,
  instructions: readonly MapQuotationLineInstruction[],
  existingCostItems: readonly ProjectCostItemInput[],
  existingMappings: readonly QuotationLineMapping[],
): QuotationMappingResult {
  const updatedItems: ProjectCostItemInput[] = [...existingCostItems];
  const newMappings: QuotationLineMapping[] = [];

  for (const inst of instructions) {
    const line = quotation.lineItems.find(
      (l) => l.lineId === inst.quotationLineId,
    );
    if (!line) {
      return {
        success: false,
        updatedCostItems: existingCostItems,
        createdMappings: [],
        error: `Quotation line '${inst.quotationLineId}' not found.`,
      };
    }

    const alloc = computeLineAllocationSummary(line, [
      ...existingMappings,
      ...newMappings,
    ]);

    // Determine amount to map: either user custom amount or full remaining amount
    const requestedAmount = inst.customAmount
      ? normalizeIndianNumberString(inst.customAmount, "0")
      : inst.includeGstInCost
        ? alloc.remainingAmount
        : line.taxableAmount;

    const requestedDec = new ProjectSetuDecimal(requestedAmount);
    const remainingDec = new ProjectSetuDecimal(alloc.remainingAmount);

    if (requestedDec.greaterThan(remainingDec)) {
      return {
        success: false,
        updatedCostItems: existingCostItems,
        createdMappings: [],
        error: `Cannot map ₹${requestedAmount}. Exceeds remaining unallocated line amount of ₹${alloc.remainingAmount}.`,
      };
    }

    const mappingId = generateId();
    const sourceRefNotes = `Source: Quotation ${quotation.quotationNumber || quotation.documentId} | Vendor: ${quotation.supplier.name} | Item: ${line.description}`;

    if (inst.mappingType === "NEW_ITEM" || !inst.targetCostItemId) {
      const newCostItemId = generateId();
      const newItem: ProjectCostItemInput = {
        id: newCostItemId,
        description:
          inst.customDescription ||
          `${line.description} (${quotation.supplier.name})`,
        category: inst.costCategory as ProjectCostItemInput["category"],
        amount: requestedAmount,
        notes: sourceRefNotes,
      };
      updatedItems.push(newItem);

      newMappings.push({
        id: mappingId,
        projectId: quotation.projectId,
        documentId: quotation.documentId,
        quotationLineId: line.lineId,
        projectCostItemId: newCostItemId,
        costCategory: inst.costCategory,
        sourceAmount: line.lineTotal,
        mappedAmount: requestedAmount,
        mappingType: inst.mappingType,
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else if (inst.mappingType === "EXISTING_ITEM") {
      const idx = updatedItems.findIndex(
        (item) => item.id === inst.targetCostItemId,
      );
      if (idx === -1) {
        return {
          success: false,
          updatedCostItems: existingCostItems,
          createdMappings: [],
          error: `Target Project Cost item '${inst.targetCostItemId}' not found.`,
        };
      }
      const existing = updatedItems[idx];
      const updatedAmount = new ProjectSetuDecimal(existing.amount)
        .plus(requestedDec)
        .toFixed();

      updatedItems[idx] = {
        ...existing,
        amount: updatedAmount,
        notes: existing.notes
          ? `${existing.notes} | ${sourceRefNotes}`
          : sourceRefNotes,
      };

      newMappings.push({
        id: mappingId,
        projectId: quotation.projectId,
        documentId: quotation.documentId,
        quotationLineId: line.lineId,
        projectCostItemId: existing.id,
        costCategory: inst.costCategory,
        sourceAmount: line.lineTotal,
        mappedAmount: requestedAmount,
        mappingType: "EXISTING_ITEM",
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  return {
    success: true,
    updatedCostItems: updatedItems,
    createdMappings: newMappings,
  };
}
