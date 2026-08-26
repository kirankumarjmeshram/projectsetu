import Decimal from "decimal.js";

import type { ReportCell, ReportCellKind } from "./contracts";

export const PRESENTATION_ROUNDING = {
  currencyDecimalPlaces: 2,
  percentageDecimalPlaces: 2,
  ratioDecimalPlaces: 2,
  mode: Decimal.ROUND_HALF_UP,
} as const;

function groupIndianInteger(integer: string): string {
  const sign = integer.startsWith("-") ? "-" : "";
  const digits = sign ? integer.slice(1) : integer;
  if (digits.length <= 3) return `${sign}${digits}`;
  const tail = digits.slice(-3);
  const head = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${sign}${head},${tail}`;
}

export function formatDecimal(value: string, places: number): string {
  const fixed = new Decimal(value)
    .toDecimalPlaces(places, PRESENTATION_ROUNDING.mode)
    .toFixed(places);
  const [integer, fraction] = fixed.split(".");
  return fraction
    ? `${groupIndianInteger(integer)}.${fraction}`
    : groupIndianInteger(integer);
}

export function formatIndianCurrency(value: string): string {
  return `₹${formatDecimal(value, PRESENTATION_ROUNDING.currencyDecimalPlaces)}`;
}

export function financialCell(
  kind: Exclude<ReportCellKind, "TEXT" | "STATUS">,
  value: string,
  sourcePath: string,
): ReportCell {
  const places =
    kind === "MONEY"
      ? PRESENTATION_ROUNDING.currencyDecimalPlaces
      : kind === "PERCENT"
        ? PRESENTATION_ROUNDING.percentageDecimalPlaces
        : kind === "RATIO"
          ? PRESENTATION_ROUNDING.ratioDecimalPlaces
          : 0;
  const formatted = formatDecimal(value, places);
  return {
    kind,
    authoritativeValue: value,
    sourcePath,
    displayValue:
      kind === "MONEY"
        ? `₹${formatted}`
        : kind === "PERCENT"
          ? `${formatted}%`
          : formatted,
  };
}

export function textCell(
  value: string,
  kind: "TEXT" | "STATUS" = "TEXT",
): ReportCell {
  return { kind, displayValue: value };
}

export function sanitizeReportFilename(
  projectName: string,
  version: number,
): string {
  const safe = projectName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return `ProjectSetu_${safe || "Project"}_DPR_v${version}`;
}
