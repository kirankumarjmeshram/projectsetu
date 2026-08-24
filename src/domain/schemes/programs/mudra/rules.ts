import type { MudraActivity } from "./contracts";

export const MUDRA_ELIGIBLE_ACTIVITIES: readonly MudraActivity[] = [
  "MANUFACTURING",
  "TRADING",
  "SERVICE",
  "POULTRY",
  "DAIRY",
  "BEEKEEPING",
  "OTHER_ALLIED_TO_AGRICULTURE",
];

export const MUDRA_LENDING_INSTITUTION_CATEGORIES = [
  "PUBLIC_SECTOR_BANK",
  "PRIVATE_SECTOR_BANK",
  "FOREIGN_BANK",
  "REGIONAL_RURAL_BANK",
  "SMALL_FINANCE_BANK",
  "NBFC",
  "MFI",
  "NBFC_MFI",
] as const;
