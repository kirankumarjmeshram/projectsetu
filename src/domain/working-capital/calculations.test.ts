import { describe, expect, it } from "vitest";

import { decimalValue, monetaryAmount, percentage } from "../shared/decimal";
import type { SourceReference } from "../shared/provenance";
import type {
  CurrentAssetLine,
  CurrentLiabilityLine,
  WorkingCapitalAssessmentInput,
} from "./working-capital";
import {
  calculateHoldingPeriodRequirement,
  calculateWorkingCapital,
} from "./calculations";

const source: SourceReference = {
  id: "source-synthetic-working-capital",
  type: "USER_INPUT",
  reference: "Synthetic working-capital test",
};

function assetLine(
  id: string,
  amount: string,
  category: CurrentAssetLine["category"] = "OTHER_CURRENT_ASSET",
): CurrentAssetLine {
  return {
    id,
    name: "Demo Current Asset",
    side: "CURRENT_ASSET",
    category,
    annualBaseAmount: { value: monetaryAmount(amount), source },
  };
}

function liabilityLine(
  id: string,
  amount: string,
  category: CurrentLiabilityLine["category"] = "OTHER_CURRENT_LIABILITY",
): CurrentLiabilityLine {
  return {
    id,
    name: "Demo Current Liability",
    side: "CURRENT_LIABILITY",
    category,
    annualBaseAmount: { value: monetaryAmount(amount), source },
  };
}

function assessment(
  lines: WorkingCapitalAssessmentInput["lines"],
): WorkingCapitalAssessmentInput {
  return {
    projectId: "project-sample-manufacturing",
    projectionYear: 1,
    lines,
  };
}

describe("calculateWorkingCapital", () => {
  it("calculates current assets, liabilities, and a positive gap", () => {
    const result = calculateWorkingCapital(
      assessment([
        assetLine("inventory", "100", "RAW_MATERIAL_INVENTORY"),
        assetLine("receivables", "50", "RECEIVABLES"),
        liabilityLine("creditors", "30", "SUPPLIER_CREDIT"),
      ]),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.totalCurrentAssets).toBe("150");
      expect(result.value.totalCurrentLiabilities).toBe("30");
      expect(result.value.workingCapitalGap).toBe("120");
    }
  });

  it("handles zero gap and empty line collections", () => {
    const zeroGap = calculateWorkingCapital(
      assessment([
        assetLine("asset", "100"),
        liabilityLine("liability", "100"),
      ]),
    );
    const empty = calculateWorkingCapital(assessment([]));

    expect(zeroGap.ok && zeroGap.value.workingCapitalGap).toBe("0");
    expect(empty.ok && empty.value).toMatchObject({
      totalCurrentAssets: "0",
      totalCurrentLiabilities: "0",
      workingCapitalGap: "0",
    });
  });

  it("preserves a negative gap when liabilities exceed assets", () => {
    const result = calculateWorkingCapital(
      assessment([assetLine("asset", "50"), liabilityLine("liability", "100")]),
    );

    expect(result.ok && result.value.workingCapitalGap).toBe("-50");
  });

  it("applies only an explicitly supplied borrower margin", () => {
    const input: WorkingCapitalAssessmentInput = {
      ...assessment([
        assetLine("asset", "120"),
        liabilityLine("liability", "20"),
      ]),
      borrowerMargin: { value: percentage("10"), source },
    };

    const result = calculateWorkingCapital(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.borrowerContribution).toBe("10");
      expect(result.value.bankFinanceRequired).toBe("90");
    }
  });
});

describe("holding-period requirements", () => {
  it("uses an explicit day base without intermediate rounding", () => {
    const result = calculateHoldingPeriodRequirement(
      monetaryAmount("1200"),
      decimalValue("30"),
      decimalValue("360"),
    );

    expect(result.ok && result.value.requirement).toBe("100");
  });

  it("uses an explicitly supplied category holding period", () => {
    const input: WorkingCapitalAssessmentInput = {
      ...assessment([assetLine("inventory", "1200", "RAW_MATERIAL_INVENTORY")]),
      holdingPeriods: {
        inventoryDays: { value: decimalValue("30"), source },
      },
    };

    const result = calculateWorkingCapital(input, decimalValue("360"));

    expect(result.ok && result.value.totalCurrentAssets).toBe("100");
  });

  it("requires a day base and rejects impossible day structures", () => {
    const input: WorkingCapitalAssessmentInput = {
      ...assessment([
        {
          ...assetLine("inventory", "1200", "RAW_MATERIAL_INVENTORY"),
          holdingPeriodDays: { value: decimalValue("30"), source },
        },
      ]),
    };

    const missingBase = calculateWorkingCapital(input);
    const zeroBase = calculateHoldingPeriodRequirement(
      monetaryAmount("1200"),
      decimalValue("30"),
      decimalValue("0"),
    );
    const negativeDays = calculateHoldingPeriodRequirement(
      monetaryAmount("1200"),
      decimalValue("-1"),
      decimalValue("365"),
    );

    expect(missingBase.ok).toBe(false);
    expect(zeroBase.ok).toBe(false);
    expect(negativeDays.ok).toBe(false);
  });
});
