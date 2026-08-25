import { describe, expect, it } from "vitest";

import { buildQuotationComparisonMatrix } from "./comparison";
import { buildManualQuotation } from "./extractor";

describe("Quotation Comparison Matrix Tests", () => {
  const quoteA = buildManualQuotation({
    projectId: "proj-1",
    documentId: "doc-1",
    supplier: { name: "Supplier Alpha Pvt Ltd" },
    quotationNumber: "ALP-001",
    lines: [
      {
        description: "Machine X",
        quantity: "1",
        unitRate: "500000.00",
        gstRate: "18.00",
      },
    ],
    freight: "10000.00",
    installation: "20000.00",
  });

  const quoteB = buildManualQuotation({
    projectId: "proj-1",
    documentId: "doc-2",
    supplier: { name: "Supplier Beta Technologies" },
    quotationNumber: "BET-999",
    lines: [
      {
        description: "Machine X (Upgraded)",
        quantity: "1",
        unitRate: "480000.00",
        gstRate: "18.00",
      },
    ],
    freight: "15000.00",
    installation: "10000.00",
  });

  it("builds side-by-side comparison summaries without auto-selecting", () => {
    const matrix = buildQuotationComparisonMatrix([quoteA, quoteB]);

    expect(matrix.summaries).toHaveLength(2);
    expect(matrix.summaries[0].supplierName).toBe("Supplier Alpha Pvt Ltd");
    expect(matrix.summaries[0].taxableAmount).toBe("500000");
    expect(matrix.summaries[0].grandTotal).toBe("620000"); // 500000 + 90000 + 10000 + 20000

    expect(matrix.summaries[1].supplierName).toBe("Supplier Beta Technologies");
    expect(matrix.summaries[1].taxableAmount).toBe("480000");
    expect(matrix.summaries[1].grandTotal).toBe("591400"); // 480000 + 86400 + 15000 + 10000
  });
});
