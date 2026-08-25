import { ProjectSetuDecimal } from "@/domain/shared/decimal";

/**
 * Safely sums an array of decimal strings without native floating point inaccuracies.
 */
export function sumDecimalStrings(
  values: (string | null | undefined)[],
): string {
  let total = new ProjectSetuDecimal("0");
  for (const v of values) {
    if (!v || v.trim() === "") continue;
    try {
      const d = new ProjectSetuDecimal(v.trim());
      if (d.isFinite()) {
        total = total.plus(d);
      }
    } catch {
      // ignore invalid input during editing
    }
  }
  return total.toFixed();
}

/**
 * Safely checks if a decimal string represents a negative value.
 */
export function isDecimalNegative(value: string | null | undefined): boolean {
  if (!value || value.trim() === "") return false;
  try {
    const d = new ProjectSetuDecimal(value.trim());
    return d.isFinite() && d.isNegative();
  } catch {
    return false;
  }
}

/**
 * Safely checks if a decimal string is zero.
 */
export function isDecimalZero(value: string | null | undefined): boolean {
  if (!value || value.trim() === "") return true;
  try {
    const d = new ProjectSetuDecimal(value.trim());
    return d.isFinite() && d.isZero();
  } catch {
    return false;
  }
}

export function formatIndianCurrency(
  value: string | number | null | undefined,
  options?: {
    includeSymbol?: boolean;
    showDecimals?: boolean;
    fallback?: string;
  },
): string {
  const includeSymbol = options?.includeSymbol ?? true;
  const showDecimals = options?.showDecimals ?? false;
  const fallback = options?.fallback ?? "-";

  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const strVal = String(value).trim();
  if (strVal === "NaN" || strVal === "Infinity" || strVal === "-Infinity") {
    return fallback;
  }

  const isNegative = strVal.startsWith("-");
  const cleanStr = isNegative ? strVal.slice(1) : strVal;

  const parts = cleanStr.split(".");
  const intPart = parts[0] || "0";
  let decPart = parts[1] ?? "";

  if (showDecimals) {
    decPart = decPart.padEnd(2, "0").slice(0, 2);
  }

  // Indian format: last 3 digits, then groups of 2 digits
  let formattedInt = "";
  if (intPart.length <= 3) {
    formattedInt = intPart;
  } else {
    const lastThree = intPart.slice(-3);
    const rest = intPart.slice(0, -3);
    const formattedRest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    formattedInt = `${formattedRest},${lastThree}`;
  }

  const symbol = includeSymbol ? "₹" : "";
  const decimals = showDecimals && decPart.length > 0 ? `.${decPart}` : "";
  const sign = isNegative ? "-" : "";

  return `${sign}${symbol}${formattedInt}${decimals}`;
}

export function formatLakhsCrores(
  value: string | number | null | undefined,
  options?: {
    includeSymbol?: boolean;
    fallback?: string;
  },
): string {
  const includeSymbol = options?.includeSymbol ?? true;
  const fallback = options?.fallback ?? "-";

  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const num =
    typeof value === "number" ? value : Number.parseFloat(String(value));
  if (Number.isNaN(num)) return fallback;

  const symbol = includeSymbol ? "₹" : "";
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  if (abs >= 10000000) {
    const cr = abs / 10000000;
    return `${sign}${symbol}${cr.toFixed(2)} Cr`;
  }
  if (abs >= 100000) {
    const lakh = abs / 100000;
    return `${sign}${symbol}${lakh.toFixed(2)} L`;
  }
  if (abs >= 1000) {
    const k = abs / 1000;
    return `${sign}${symbol}${k.toFixed(2)} K`;
  }

  return `${sign}${symbol}${abs.toFixed(0)}`;
}

export function formatPercentage(
  value: string | number | null | undefined,
  decimals: number = 2,
  fallback: string = "-",
): string {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const strVal = String(value).trim();
  if (strVal === "NaN" || strVal === "Infinity" || strVal === "-Infinity") {
    return fallback;
  }
  const num =
    typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(num)) return fallback;
  return `${num.toFixed(decimals)}%`;
}

export function formatRatio(
  value: string | number | null | undefined,
  suffix: string = "x",
  decimals: number = 2,
  fallback: string = "N/A",
): string {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const strVal = String(value).trim();
  if (strVal === "NaN" || strVal === "Infinity" || strVal === "-Infinity") {
    return fallback;
  }
  const num =
    typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(num)) return fallback;
  return `${num.toFixed(decimals)}${suffix}`;
}

export function formatYears(years: number | null | undefined): string {
  if (years === null || years === undefined) return "-";
  return `${years} Year${years === 1 ? "" : "s"}`;
}
