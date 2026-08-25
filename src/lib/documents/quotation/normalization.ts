import { ProjectSetuDecimal } from "@/domain/shared/decimal";

import type { NormalizedQuotationLine, QuotationTotals } from "./contracts";

/**
 * Normalizes Indian currency strings and comma-separated numbers into clean decimal strings.
 * Handles ₹, Rs., Rs, INR, trailing /-, and Indian comma grouping (e.g. "1,25,000.00").
 */
export function normalizeIndianNumberString(
  input: string | number | null | undefined,
  fallback: string = "0",
): string {
  if (input === null || input === undefined) {
    return fallback;
  }

  let str = String(input).trim();
  if (
    str === "" ||
    str === "-" ||
    str === "N/A" ||
    str === "nil" ||
    str === "null"
  ) {
    return fallback;
  }

  // Remove currency prefixes & suffixes without stripping decimal point
  str = str.replace(/₹|Rs\.|Rs|INR/gi, "");
  str = str.replace(/\/-$/, "");
  str = str.replace(/,/g, "");
  str = str.trim();

  // Strip brackets if written like (1000) for negative
  const isNegative = str.startsWith("(") && str.endsWith(")");
  if (isNegative) {
    str = `-${str.slice(1, -1).trim()}`;
  }

  try {
    const d = new ProjectSetuDecimal(str);
    if (!d.isFinite()) return fallback;
    return d.toFixed();
  } catch {
    return fallback;
  }
}

/**
 * Calculates line tax, split CGST/SGST/IGST, and line total using exact ProjectSetuDecimal arithmetic.
 */
export function computeQuotationLineFinancials(input: {
  quantity: string;
  unitRate: string;
  discount?: string | null;
  gstRate?: string | null;
  isInterstate?: boolean;
}): {
  taxableAmount: string;
  cgst: string;
  sgst: string;
  igst: string;
  lineTotal: string;
} {
  const qty = new ProjectSetuDecimal(
    normalizeIndianNumberString(input.quantity, "1"),
  );
  const rate = new ProjectSetuDecimal(
    normalizeIndianNumberString(input.unitRate, "0"),
  );
  const discount = new ProjectSetuDecimal(
    normalizeIndianNumberString(input.discount, "0"),
  );

  const baseProduct = qty.times(rate);
  const taxableDec = baseProduct.minus(discount);
  const taxableAmount = taxableDec.isNegative() ? "0" : taxableDec.toFixed();

  let cgstDec = new ProjectSetuDecimal("0");
  let sgstDec = new ProjectSetuDecimal("0");
  let igstDec = new ProjectSetuDecimal("0");
  let taxDec = new ProjectSetuDecimal("0");

  if (input.gstRate) {
    const rateStr = normalizeIndianNumberString(input.gstRate, "0");
    const gstRateDec = new ProjectSetuDecimal(rateStr).dividedBy(100);
    taxDec = taxableDec.times(gstRateDec);

    if (input.isInterstate) {
      igstDec = taxDec;
    } else {
      cgstDec = taxDec.dividedBy(2);
      sgstDec = taxDec.dividedBy(2);
    }
  }

  const lineTotalDec = taxableDec.plus(taxDec);

  return {
    taxableAmount,
    cgst: cgstDec.toFixed(),
    sgst: sgstDec.toFixed(),
    igst: igstDec.toFixed(),
    lineTotal: lineTotalDec.toFixed(),
  };
}

/**
 * Aggregates all quotation line items and additional charges into authoritative QuotationTotals.
 */
export function calculateQuotationTotals(
  lineItems: readonly NormalizedQuotationLine[],
  additionalCharges?: {
    freight?: string | null;
    installation?: string | null;
    otherCharges?: string | null;
    otherTax?: string | null;
  },
): QuotationTotals {
  let subtotalDec = new ProjectSetuDecimal("0");
  let discountDec = new ProjectSetuDecimal("0");
  let taxableDec = new ProjectSetuDecimal("0");
  let cgstDec = new ProjectSetuDecimal("0");
  let sgstDec = new ProjectSetuDecimal("0");
  let igstDec = new ProjectSetuDecimal("0");
  const otherTaxDec = new ProjectSetuDecimal(
    normalizeIndianNumberString(additionalCharges?.otherTax, "0"),
  );

  for (const line of lineItems) {
    const lineQty = new ProjectSetuDecimal(
      normalizeIndianNumberString(line.quantity, "1"),
    );
    const lineRate = new ProjectSetuDecimal(
      normalizeIndianNumberString(line.unitRate, "0"),
    );
    const lineDisc = new ProjectSetuDecimal(
      normalizeIndianNumberString(line.discount, "0"),
    );
    const lineTaxable = new ProjectSetuDecimal(
      normalizeIndianNumberString(line.taxableAmount, "0"),
    );
    const lineCgst = new ProjectSetuDecimal(
      normalizeIndianNumberString(line.cgst, "0"),
    );
    const lineSgst = new ProjectSetuDecimal(
      normalizeIndianNumberString(line.sgst, "0"),
    );
    const lineIgst = new ProjectSetuDecimal(
      normalizeIndianNumberString(line.igst, "0"),
    );

    subtotalDec = subtotalDec.plus(lineQty.times(lineRate));
    discountDec = discountDec.plus(lineDisc);
    taxableDec = taxableDec.plus(lineTaxable);
    cgstDec = cgstDec.plus(lineCgst);
    sgstDec = sgstDec.plus(lineSgst);
    igstDec = igstDec.plus(lineIgst);
  }

  const freightDec = new ProjectSetuDecimal(
    normalizeIndianNumberString(additionalCharges?.freight, "0"),
  );
  const installationDec = new ProjectSetuDecimal(
    normalizeIndianNumberString(additionalCharges?.installation, "0"),
  );
  const otherChargesDec = new ProjectSetuDecimal(
    normalizeIndianNumberString(additionalCharges?.otherCharges, "0"),
  );

  const grandTotalDec = taxableDec
    .plus(cgstDec)
    .plus(sgstDec)
    .plus(igstDec)
    .plus(otherTaxDec)
    .plus(freightDec)
    .plus(installationDec)
    .plus(otherChargesDec);

  return {
    subtotal: subtotalDec.toFixed(),
    discount: discountDec.toFixed(),
    taxableAmount: taxableDec.toFixed(),
    cgst: cgstDec.toFixed(),
    sgst: sgstDec.toFixed(),
    igst: igstDec.toFixed(),
    otherTax: otherTaxDec.toFixed(),
    freight: freightDec.toFixed(),
    installation: installationDec.toFixed(),
    otherCharges: otherChargesDec.toFixed(),
    grandTotal: grandTotalDec.toFixed(),
  };
}
