import { decimalValue, monetaryAmount } from "../../../shared/decimal";
import { programId } from "../../program";
import type { ProgramId } from "../../program";
import type { NlmActivity, NlmCostTag, NlmEntityType } from "./contracts";

export interface NlmActivityRule {
  readonly activity: NlmActivity;
  readonly programId: ProgramId;
  readonly displayName: string;
  readonly eligibleEntities: readonly NlmEntityType[];
  readonly eligibleCostTags: readonly NlmCostTag[];
  readonly unitOptions: readonly {
    readonly female: ReturnType<typeof decimalValue>;
    readonly male: ReturnType<typeof decimalValue>;
    readonly cap: ReturnType<typeof monetaryAmount>;
    readonly pastoralOnly?: boolean;
    readonly nonPastoralOnly?: boolean;
  }[];
  readonly fixedCap?: ReturnType<typeof monetaryAmount>;
}

const standardEntities: readonly NlmEntityType[] = [
  "INDIVIDUAL",
  "SHG",
  "FPO",
  "FCO",
  "JLG",
  "SECTION_8_COMPANY",
];

const breedingCosts: readonly NlmCostTag[] = [
  "SHED_HOUSING",
  "BREEDING_STOCK",
  "BREEDING_STOCK_TRANSPORT",
  "BREEDING_STOCK_INSURANCE",
  "MACHINERY_EQUIPMENT",
];

export const NLM_ACTIVITY_RULES: Readonly<
  Record<NlmActivity, NlmActivityRule>
> = {
  RURAL_POULTRY: {
    activity: "RURAL_POULTRY",
    programId: programId("GOI.NLM.RURAL_POULTRY"),
    displayName: "NLM - Rural Poultry Entrepreneurship",
    eligibleEntities: standardEntities,
    eligibleCostTags: [
      ...breedingCosts,
      "HATCHERY_INFRASTRUCTURE",
      "BROODER_INFRASTRUCTURE",
    ],
    unitOptions: [
      {
        female: decimalValue("1000"),
        male: decimalValue("100"),
        cap: monetaryAmount("2500000"),
      },
    ],
  },
  SHEEP_GOAT: {
    activity: "SHEEP_GOAT",
    programId: programId("GOI.NLM.SHEEP_GOAT"),
    displayName: "NLM - Sheep and Goat Entrepreneurship",
    eligibleEntities: standardEntities,
    eligibleCostTags: breedingCosts,
    unitOptions: [100, 200, 300, 400, 500].map((female) => ({
      female: decimalValue(String(female)),
      male: decimalValue(String(female / 20)),
      cap: monetaryAmount(String(female * 10000)),
    })),
  },
  PIGGERY: {
    activity: "PIGGERY",
    programId: programId("GOI.NLM.PIGGERY"),
    displayName: "NLM - Piggery Entrepreneurship",
    eligibleEntities: standardEntities,
    eligibleCostTags: breedingCosts,
    unitOptions: [
      {
        female: decimalValue("50"),
        male: decimalValue("5"),
        cap: monetaryAmount("1500000"),
      },
      {
        female: decimalValue("100"),
        male: decimalValue("10"),
        cap: monetaryAmount("3000000"),
      },
    ],
  },
  FEED_FODDER: {
    activity: "FEED_FODDER",
    programId: programId("GOI.NLM.FEED_FODDER"),
    displayName: "NLM - Feed and Fodder Value Addition",
    eligibleEntities: [
      ...standardEntities,
      "PRIVATE_COMPANY",
      "COOPERATIVE_SOCIETY",
    ],
    eligibleCostTags: [
      "MACHINERY_EQUIPMENT",
      "PROCESSING_INFRASTRUCTURE",
      "STORAGE_INFRASTRUCTURE",
      "FODDER_CULTIVATION",
    ],
    unitOptions: [],
    fixedCap: monetaryAmount("5000000"),
  },
  FODDER_SEED_PROCESSING: {
    activity: "FODDER_SEED_PROCESSING",
    programId: programId("GOI.NLM.FODDER_SEED_PROCESSING"),
    displayName: "NLM - Fodder Seed Processing and Grading",
    eligibleEntities: [
      "SHG",
      "FPO",
      "FCO",
      "JLG",
      "SECTION_8_COMPANY",
      "PRIVATE_COMPANY",
      "COOPERATIVE_SOCIETY",
    ],
    eligibleCostTags: [
      "MACHINERY_EQUIPMENT",
      "PROCESSING_INFRASTRUCTURE",
      "STORAGE_INFRASTRUCTURE",
    ],
    unitOptions: [],
    fixedCap: monetaryAmount("5000000"),
  },
  HORSE: {
    activity: "HORSE",
    programId: programId("GOI.NLM.HORSE"),
    displayName: "NLM - Indigenous Horse Entrepreneurship",
    eligibleEntities: standardEntities,
    eligibleCostTags: [...breedingCosts, "FODDER_CULTIVATION"],
    unitOptions: [
      {
        female: decimalValue("10"),
        male: decimalValue("2"),
        cap: monetaryAmount("5000000"),
      },
    ],
  },
  DONKEY: {
    activity: "DONKEY",
    programId: programId("GOI.NLM.DONKEY"),
    displayName: "NLM - Indigenous Donkey Entrepreneurship",
    eligibleEntities: standardEntities,
    eligibleCostTags: [...breedingCosts, "FODDER_CULTIVATION"],
    unitOptions: [
      {
        female: decimalValue("50"),
        male: decimalValue("5"),
        cap: monetaryAmount("5000000"),
      },
    ],
  },
  CAMEL: {
    activity: "CAMEL",
    programId: programId("GOI.NLM.CAMEL"),
    displayName: "NLM - Indigenous Camel Entrepreneurship",
    eligibleEntities: standardEntities,
    eligibleCostTags: [...breedingCosts, "FODDER_CULTIVATION"],
    unitOptions: [
      {
        female: decimalValue("10"),
        male: decimalValue("1"),
        cap: monetaryAmount("300000"),
        pastoralOnly: true,
      },
      {
        female: decimalValue("10"),
        male: decimalValue("1"),
        cap: monetaryAmount("500000"),
        nonPastoralOnly: true,
      },
      {
        female: decimalValue("50"),
        male: decimalValue("5"),
        cap: monetaryAmount("2500000"),
      },
      {
        female: decimalValue("100"),
        male: decimalValue("10"),
        cap: monetaryAmount("5000000"),
      },
    ],
  },
};

export const nlmActivities = Object.values(NLM_ACTIVITY_RULES);
