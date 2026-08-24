import { monetaryAmount, percentage } from "../../../shared/decimal";
import type {
  CmegpAreaClassification,
  CmegpBeneficiaryCategory,
  CmegpSector,
} from "./contracts";

export function cmegpProjectCeiling(sector: CmegpSector) {
  return monetaryAmount(sector === "MANUFACTURING" ? "10000000" : "5000000");
}

const rateMatrix = {
  SPECIAL: {
    URBAN: percentage("25"),
    RURAL: percentage("35"),
  },
  GENERAL: {
    URBAN: percentage("15"),
    RURAL: percentage("25"),
  },
} as const;

export function cmegpSubsidyRate(
  category: CmegpBeneficiaryCategory,
  area: CmegpAreaClassification,
) {
  return rateMatrix[category][area];
}

export function cmegpSubsidyCap(
  sector: CmegpSector,
  category: CmegpBeneficiaryCategory,
  area: CmegpAreaClassification,
) {
  if (sector === "MANUFACTURING") {
    if (category === "SPECIAL") {
      return monetaryAmount(area === "URBAN" ? "1250000" : "1750000");
    }
    return monetaryAmount(area === "URBAN" ? "750000" : "1250000");
  }
  if (category === "SPECIAL") {
    return monetaryAmount(area === "URBAN" ? "500000" : "700000");
  }
  return monetaryAmount(area === "URBAN" ? "300000" : "500000");
}

export function cmegpContributionRate(category: CmegpBeneficiaryCategory) {
  return percentage(category === "SPECIAL" ? "5" : "10");
}

export function cmegpWorkingCapitalRate(sector: CmegpSector) {
  return percentage(sector === "MANUFACTURING" ? "40" : "60");
}
