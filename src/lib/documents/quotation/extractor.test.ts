import { describe, expect, it } from "vitest";

import type { DocumentMetadataRecord } from "../contracts";
import {
  buildManualQuotation,
  RuleBasedTextExtractionProvider,
} from "./extractor";

describe("Quotation Extraction Provider Tests", () => {
  const dummyDoc: DocumentMetadataRecord = {
    id: "doc-1",
    projectId: "proj-100",
    kind: "QUOTATION",
    displayName: "Supplier Quotation.pdf",
    originalFilename: "Supplier Quotation.pdf",
    mimeType: "application/pdf",
    status: "UPLOADED",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("builds manual quotation with clean normalized lines and totals", () => {
    const quote = buildManualQuotation({
      projectId: "proj-100",
      documentId: "doc-1",
      supplier: {
        name: "Acme Industrial Machinery Ltd",
        gstin: "27AAAAA0000A1Z5",
      },
      quotationNumber: "ACM-2026-88",
      lines: [
        {
          description: "Rotary Honey Extractor 24 Frame",
          quantity: "1",
          unit: "Nos",
          unitRate: "450000.00",
          gstRate: "18.00",
        },
        {
          description: "Stainless Steel Storage Tank 1000L",
          quantity: "2",
          unit: "Nos",
          unitRate: "125000.00",
          gstRate: "18.00",
        },
      ],
      freight: "15000.00",
      installation: "25000.00",
    });

    expect(quote.supplier.name).toBe("Acme Industrial Machinery Ltd");
    expect(quote.quotationNumber).toBe("ACM-2026-88");
    expect(quote.lineItems).toHaveLength(2);
    // Line 1: 450000 + 18% (81000) = 531000
    expect(quote.lineItems[0].lineTotal).toBe("531000");
    // Line 2: 250000 + 18% (45000) = 295000
    expect(quote.lineItems[1].lineTotal).toBe("295000");
    // Subtotal = 700000, Total tax = 126000, Freight = 15000, Install = 25000 => Grand total = 866000
    expect(quote.totals.grandTotal).toBe("866000");
  });

  it("extracts structured lines from synthetic quotation text with pipe formats", async () => {
    const provider = new RuleBasedTextExtractionProvider();
    const fixtureText = `
Supplier: Bharat Agro Machinery Works
Quotation No: BAM/2026/099
Date: 2026-08-20
Automatic Feed Mixer | 1 | 250000 | 18%
Pellet Making Mill | 1 | 450000 | 18%
Cooling Tower System | 1 | 150000 | 18%
`;
    const res = await provider.extract(dummyDoc, Buffer.from(fixtureText));

    expect(res.success).toBe(true);
    expect(res.status).toBe("PROPOSED");
    expect(res.normalizedQuotation).toBeDefined();
    expect(res.normalizedQuotation?.supplier.name).toBe(
      "Bharat Agro Machinery Works",
    );
    expect(res.normalizedQuotation?.quotationNumber).toBe("BAM/2026/099");
    expect(res.normalizedQuotation?.lineItems).toHaveLength(3);
  });

  it("flags MANUAL_REVIEW_REQUIRED for unparseable raw PDF/image content without crashing", async () => {
    const provider = new RuleBasedTextExtractionProvider();
    const binaryGarbage = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe]);
    const res = await provider.extract(dummyDoc, binaryGarbage);

    expect(res.success).toBe(true);
    expect(res.status).toBe("MANUAL_REVIEW_REQUIRED");
    expect(res.confidenceScore).toBe("0.0");
    expect(res.issues[0]).toContain("manual inspection");
  });
});
