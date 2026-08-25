import { describe, expect, it } from "vitest";

import {
  formatIndianCurrency,
  formatLakhsCrores,
  formatPercentage,
  formatRatio,
  formatYears,
} from "./formatters";

describe("formatIndianCurrency", () => {
  it("formats standard amounts in Indian grouping", () => {
    expect(formatIndianCurrency("2500000")).toBe("₹25,00,000");
    expect(formatIndianCurrency("125000")).toBe("₹1,25,000");
    expect(formatIndianCurrency("10000000")).toBe("₹1,00,00,000");
    expect(formatIndianCurrency("500")).toBe("₹500");
    expect(formatIndianCurrency("0")).toBe("₹0");
  });

  it("handles decimal places when requested", () => {
    expect(formatIndianCurrency("2500000.50", { showDecimals: true })).toBe(
      "₹25,00,000.50",
    );
    expect(formatIndianCurrency("2500000", { showDecimals: true })).toBe(
      "₹25,00,000.00",
    );
  });

  it("handles negative amounts", () => {
    expect(formatIndianCurrency("-125000")).toBe("-₹1,25,000");
  });

  it("handles null/undefined/empty gracefully", () => {
    expect(formatIndianCurrency(null)).toBe("-");
    expect(formatIndianCurrency(undefined)).toBe("-");
    expect(formatIndianCurrency("")).toBe("-");
  });
});

describe("formatLakhsCrores", () => {
  it("formats values in Lakhs and Crores", () => {
    expect(formatLakhsCrores("2500000")).toBe("₹25.00 L");
    expect(formatLakhsCrores("15000000")).toBe("₹1.50 Cr");
    expect(formatLakhsCrores("50000")).toBe("₹50.00 K");
  });
});

describe("formatPercentage", () => {
  it("formats percentage values", () => {
    expect(formatPercentage("12.5")).toBe("12.50%");
    expect(formatPercentage(25)).toBe("25.00%");
    expect(formatPercentage(null)).toBe("-");
  });
});

describe("formatRatio", () => {
  it("formats financial ratios", () => {
    expect(formatRatio("1.854")).toBe("1.85x");
    expect(formatRatio(null)).toBe("N/A");
  });
});

describe("formatYears", () => {
  it("formats years", () => {
    expect(formatYears(1)).toBe("1 Year");
    expect(formatYears(5)).toBe("5 Years");
  });
});
