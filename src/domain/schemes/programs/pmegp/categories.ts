import { percentage } from "../../../shared/decimal";
import type { Percentage } from "../../../shared/types";
import type { SourceReference } from "../../../shared/provenance";
import type {
  PmegpApplicantFacts,
  PmegpAreaResolution,
  PmegpBeneficiaryCategory,
  PmegpCategoryResolution,
  PmegpLocationFacts,
  PmegpResolverTrace,
} from "./contracts";
import {
  pmegpLevelsOfSupportSource,
  pmegpNewEligibilitySource,
} from "./sources";

function evidenceSources(
  ...values: readonly ({ readonly source: SourceReference } | undefined)[]
): readonly SourceReference[] {
  return values.flatMap((value) => (value ? [value.source] : []));
}

export function resolvePmegpBeneficiaryCategory(input: {
  readonly applicant: PmegpApplicantFacts;
  readonly location: PmegpLocationFacts;
}): PmegpCategoryResolution {
  const applicantCategories = input.applicant.specialCategories;
  const areaCategories = input.location.newEnterpriseSpecialAreas;
  if (!applicantCategories || !areaCategories) {
    return {
      category: "INSUFFICIENT_INFORMATION",
      qualifyingCategories: [],
      traces: [
        {
          ruleId: "PMEGP.NEW.CATEGORY.COMPLETE-EVIDENCE",
          result: "INSUFFICIENT_INFORMATION",
          explanationCode: "PMEGP_SPECIAL_CATEGORY_EVIDENCE_MISSING",
          sourceReferences: [pmegpLevelsOfSupportSource],
          evidenceSources: evidenceSources(applicantCategories, areaCategories),
        },
      ],
    };
  }

  const qualifyingCategories = [
    ...applicantCategories.value,
    ...areaCategories.value,
  ];
  const category: PmegpBeneficiaryCategory =
    qualifyingCategories.length > 0 ? "SPECIAL" : "GENERAL";
  return {
    category,
    qualifyingCategories,
    traces: [
      {
        ruleId: "PMEGP.NEW.CATEGORY.RESOLUTION",
        result: category,
        explanationCode:
          category === "SPECIAL"
            ? "PMEGP_VERIFIED_SPECIAL_CATEGORY_PRESENT"
            : "PMEGP_COMPLETE_CATEGORY_EVIDENCE_HAS_NO_SPECIAL_CATEGORY",
        sourceReferences: [
          pmegpLevelsOfSupportSource,
          pmegpNewEligibilitySource,
        ],
        evidenceSources: evidenceSources(applicantCategories, areaCategories),
      },
    ],
  };
}

export function resolvePmegpAreaClassification(
  location: PmegpLocationFacts,
): PmegpAreaResolution {
  if (!location.areaClassification) {
    return {
      classification: "UNKNOWN",
      traces: [
        {
          ruleId: "PMEGP.NEW.AREA.RESOLUTION",
          result: "UNKNOWN",
          explanationCode: "PMEGP_AREA_CLASSIFICATION_MISSING",
          sourceReferences: [pmegpLevelsOfSupportSource],
          evidenceSources: [],
        },
      ],
    };
  }
  return {
    classification: location.areaClassification.value,
    traces: [
      {
        ruleId: "PMEGP.NEW.AREA.RESOLUTION",
        result: location.areaClassification.value,
        explanationCode: "PMEGP_EXPLICIT_AREA_CLASSIFICATION_USED",
        sourceReferences: [pmegpLevelsOfSupportSource],
        evidenceSources: [location.areaClassification.source],
      },
    ],
  };
}

const newEnterpriseRateMatrix: Readonly<
  Record<"GENERAL" | "SPECIAL", Readonly<Record<"URBAN" | "RURAL", Percentage>>>
> = {
  GENERAL: { URBAN: percentage("15"), RURAL: percentage("25") },
  SPECIAL: { URBAN: percentage("25"), RURAL: percentage("35") },
};

export function resolvePmegpNewEnterpriseRate(input: {
  readonly category: PmegpBeneficiaryCategory;
  readonly areaClassification: PmegpAreaResolution["classification"];
}): Percentage | undefined {
  if (
    (input.category !== "GENERAL" && input.category !== "SPECIAL") ||
    input.areaClassification === "UNKNOWN"
  ) {
    return undefined;
  }
  return newEnterpriseRateMatrix[input.category][input.areaClassification];
}

export function categoryContributionPercentage(
  category: PmegpBeneficiaryCategory,
): Percentage | undefined {
  return category === "GENERAL"
    ? percentage("10")
    : category === "SPECIAL"
      ? percentage("5")
      : undefined;
}

export function upgradationRate(
  specialAreas: PmegpLocationFacts["upgradationSpecialAreas"],
): {
  readonly rate?: Percentage;
  readonly specialArea: boolean;
  readonly trace: PmegpResolverTrace;
} {
  if (!specialAreas) {
    return {
      specialArea: false,
      trace: {
        ruleId: "PMEGP.UPGRADATION.AREA-RATE",
        result: "INSUFFICIENT_INFORMATION",
        explanationCode: "PMEGP_UPGRADATION_AREA_EVIDENCE_MISSING",
        sourceReferences: [pmegpLevelsOfSupportSource],
        evidenceSources: [],
      },
    };
  }
  const specialArea = specialAreas.value.some(
    (area) => area === "NER" || area === "HILL_STATE",
  );
  return {
    rate: percentage(specialArea ? "20" : "15"),
    specialArea,
    trace: {
      ruleId: "PMEGP.UPGRADATION.AREA-RATE",
      result: specialArea ? "NER_OR_HILL_STATE" : "STANDARD_AREA",
      explanationCode: specialArea
        ? "PMEGP_UPGRADATION_SPECIAL_AREA_RATE"
        : "PMEGP_UPGRADATION_STANDARD_RATE",
      sourceReferences: [pmegpLevelsOfSupportSource],
      evidenceSources: [specialAreas.source],
    },
  };
}
