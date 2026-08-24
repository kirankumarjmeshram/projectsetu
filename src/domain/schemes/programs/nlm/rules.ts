import { monetaryAmount, percentage } from "../../../shared/decimal";
import type { NlmCostTag } from "./contracts";

export const NLM_SUBSIDY_RATE = percentage("50");

export const NLM_ALWAYS_EXCLUDED_COST_TAGS: readonly NlmCostTag[] = [
  "LAND_PURCHASE",
  "LAND_RENT",
  "LAND_LEASE",
  "WORKING_CAPITAL",
  "PERSONAL_VEHICLE",
  "OFFICE_ACCOMMODATION",
];

export const NLM_ZERO = monetaryAmount("0");
