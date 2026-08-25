import { describe, expect, it } from "vitest";

import type { ProjectCostItemInput } from "@/lib/application/orchestrator/orchestrator-types";
import { buildManualQuotation } from "./extractor";
import {
  computeLineAllocationSummary,
  mapQuotationLinesToProjectCost,
} from "./mapping";

describe("Quotation to Project Cost Mapping & Double Counting Tests", () => {
  const sampleQuotation = buildManualQuotation({
    projectId: "proj-1",
    documentId: "doc-1",
    supplier: { name: "Shree Ganesh Engineering Pvt Ltd" },
    quotationNumber: "SGE/2026/042",
    lines: [
      {
        lineId: "line-1",
        description: "Automatic Milk Pasteurizer 1000 LPH",
        quantity: "1",
        unit: "Nos",
        unitRate: "500000.00",
        gstRate: "18.00", // Taxable: 500000, Total: 590000
      },
      {
        lineId: "line-2",
        description: "Plate Heat Exchanger",
        quantity: "1",
        unit: "Nos",
        unitRate: "200000.00",
        gstRate: "18.00", // Taxable: 200000, Total: 236000
      },
    ],
  });

  it("maps a quotation line to a NEW Project Cost item and records provenance", () => {
    const existingItems: ProjectCostItemInput[] = [];
    const res = mapQuotationLinesToProjectCost(
      sampleQuotation,
      [
        {
          quotationLineId: "line-1",
          costCategory: "PLANT_AND_MACHINERY",
          mappingType: "NEW_ITEM",
          includeGstInCost: true,
        },
      ],
      existingItems,
      [],
    );

    expect(res.success).toBe(true);
    expect(res.updatedCostItems).toHaveLength(1);
    expect(res.updatedCostItems[0].category).toBe("PLANT_AND_MACHINERY");
    expect(res.updatedCostItems[0].amount).toBe("590000");
    expect(res.updatedCostItems[0].notes).toContain("SGE/2026/042");
    expect(res.createdMappings).toHaveLength(1);
    expect(res.createdMappings[0].mappedAmount).toBe("590000");
  });

  it("prevents double-counting by rejecting allocations exceeding remaining line amount", () => {
    const existingMappings = [
      {
        id: "map-1",
        projectId: "proj-1",
        documentId: "doc-1",
        quotationLineId: "line-1",
        costCategory: "PLANT_AND_MACHINERY" as const,
        sourceAmount: "590000",
        mappedAmount: "500000",
        mappingType: "PARTIAL_ALLOCATION" as const,
        status: "ACTIVE" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Check remaining allocation
    const alloc = computeLineAllocationSummary(
      sampleQuotation.lineItems[0],
      existingMappings,
    );
    expect(alloc.allocatedAmount).toBe("500000");
    expect(alloc.remainingAmount).toBe("90000");
    expect(alloc.isFullyAllocated).toBe(false);

    // Attempt to map 1,00,000 when only 90,000 is remaining
    const res = mapQuotationLinesToProjectCost(
      sampleQuotation,
      [
        {
          quotationLineId: "line-1",
          costCategory: "PLANT_AND_MACHINERY",
          mappingType: "PARTIAL_ALLOCATION",
          customAmount: "100000.00",
        },
      ],
      [],
      existingMappings,
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain(
      "Exceeds remaining unallocated line amount of ₹90000",
    );
  });

  it("maps to an EXISTING Project Cost item by incrementing amount and appending notes", () => {
    const existingItems: ProjectCostItemInput[] = [
      {
        id: "cost-item-99",
        description: "Dairy Processing Equipment",
        category: "PLANT_AND_MACHINERY",
        amount: "300000.00",
        notes: "Initial estimate",
      },
    ];

    const res = mapQuotationLinesToProjectCost(
      sampleQuotation,
      [
        {
          quotationLineId: "line-2",
          costCategory: "PLANT_AND_MACHINERY",
          mappingType: "EXISTING_ITEM",
          targetCostItemId: "cost-item-99",
          customAmount: "200000.00",
        },
      ],
      existingItems,
      [],
    );

    expect(res.success).toBe(true);
    expect(res.updatedCostItems).toHaveLength(1);
    // 300000 + 200000 = 500000
    expect(res.updatedCostItems[0].amount).toBe("500000");
    expect(res.updatedCostItems[0].notes).toContain("SGE/2026/042");
  });
});
