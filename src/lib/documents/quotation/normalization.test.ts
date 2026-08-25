import { describe, expect, it } from "vitest";

import {
  calculateQuotationTotals,
  computeQuotationLineFinancials,
  normalizeIndianNumberString,
} from "./normalization";

describe("Quotation Normalization & Indian Format Tests", () => {
  describe("normalizeIndianNumberString", () => {
    it("handles currency symbols and Indian commas", () => {
      expect(normalizeIndianNumberString("₹ 1,25,000.00")).toBe("125000");
      expect(normalizeIndianNumberString("Rs. 12,50,000/-")).toBe("1250000");
      expect(normalizeIndianNumberString("INR 1,23,45,678.50")).toBe(
        "12345678.5",
      );
      expect(normalizeIndianNumberString("50,000")).toBe("50000");
    });

    it("handles zero, empty and negative inputs", () => {
      expect(normalizeIndianNumberString("0")).toBe("0");
      expect(normalizeIndianNumberString("₹ 0.00")).toBe("0");
      expect(normalizeIndianNumberString("")).toBe("0");
      expect(normalizeIndianNumberString(null)).toBe("0");
      expect(normalizeIndianNumberString(undefined)).toBe("0");
      expect(normalizeIndianNumberString("-5,000")).toBe("-5000");
      expect(normalizeIndianNumberString("(2,500)")).toBe("-2500");
    });

    it("preserves exact large decimal numbers without floating point error", () => {
      const largeExact = "123456789012345.67";
      expect(normalizeIndianNumberString(largeExact)).toBe(largeExact);
    });
  });

  describe("computeQuotationLineFinancials", () => {
    it("computes line tax and splits CGST / SGST for intrastate quote", () => {
      const res = computeQuotationLineFinancials({
        quantity: "2",
        unitRate: "250000",
        discount: "50000",
        gstRate: "18",
        isInterstate: false,
      });

      // 2 * 250000 - 50000 = 450000 taxable
      expect(res.taxableAmount).toBe("450000");
      // 18% of 450000 = 81000 total tax => CGST = 40500, SGST = 40500, IGST = 0
      expect(res.cgst).toBe("40500");
      expect(res.sgst).toBe("40500");
      expect(res.igst).toBe("0");
      // Line Total = 450000 + 81000 = 531000
      expect(res.lineTotal).toBe("531000");
    });

    it("computes line tax as IGST for interstate quote", () => {
      const res = computeQuotationLineFinancials({
        quantity: "1",
        unitRate: "1000000",
        discount: "0",
        gstRate: "12",
        isInterstate: true,
      });

      expect(res.taxableAmount).toBe("1000000");
      expect(res.cgst).toBe("0");
      expect(res.sgst).toBe("0");
      expect(res.igst).toBe("120000");
      expect(res.lineTotal).toBe("1120000");
    });
  });

  describe("calculateQuotationTotals", () => {
    it("aggregates all line items, GST components, freight and installation accurately", () => {
      const lines = [
        {
          lineId: "l1",
          description: "Machine 1",
          quantity: "1",
          unit: "Nos",
          unitRate: "500000",
          discount: "0",
          taxableAmount: "500000",
          gstRate: "18",
          cgst: "45000",
          sgst: "45000",
          igst: "0",
          lineTotal: "590000",
        },
        {
          lineId: "l2",
          description: "Machine 2",
          quantity: "2",
          unit: "Nos",
          unitRate: "125000",
          discount: "0",
          taxableAmount: "250000",
          gstRate: "18",
          cgst: "22500",
          sgst: "22500",
          igst: "0",
          lineTotal: "295000",
        },
      ];

      const totals = calculateQuotationTotals(lines, {
        freight: "10000",
        installation: "25000",
      });

      expect(totals.subtotal).toBe("750000");
      expect(totals.taxableAmount).toBe("750000");
      expect(totals.cgst).toBe("67500");
      expect(totals.sgst).toBe("67500");
      expect(totals.freight).toBe("10000");
      expect(totals.installation).toBe("25000");
      // Grand Total = 750000 + 67500 + 67500 + 10000 + 25000 = 920000
      expect(totals.grandTotal).toBe("920000");
    });
  });
});
