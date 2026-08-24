import { describe, expect, it } from "vitest";

import { monetaryAmount } from "../shared/decimal";
import { classificationTag, programId } from "../schemes/program";
import {
  CMEGP_PROGRAM_ID,
  cmegpProgramDefinition,
} from "../schemes/programs/cmegp";
import {
  MUDRA_PROGRAM_ID,
  mudraProgramDefinition,
} from "../schemes/programs/mudra";
import { nlmProgramDefinitions } from "../schemes/programs/nlm";
import {
  createPmegpRuleHandlers,
  pmegpNewEnterpriseDefinition,
} from "../schemes/programs/pmegp";
import {
  PMFME_PROGRAM_IDS,
  pmfmeAifConvergenceRule,
  pmfmeProgramDefinitions,
} from "../schemes/programs/pmfme";
import { composeMultiProgramFunding } from "./calculations";
import type { FundingComposerCalculationResult } from "./contracts";
import {
  fixtureInput,
  fixtureProgram,
  fixtureSource,
  registryWith,
  sourcedAmount,
} from "./test-fixtures";

function unwrap(result: FundingComposerCalculationResult) {
  if (!result.ok)
    throw new Error(result.errors.map((error) => error.code).join(","));
  return result.value;
}

describe("live program integration through generic contracts", () => {
  it("resolves official PMFME plus AIF convergence without a live-ID branch", () => {
    const pmfme = pmfmeProgramDefinitions.find(
      (definition) =>
        definition.programId === PMFME_PROGRAM_IDS.INDIVIDUAL_UNIT,
    )!;
    const aif = fixtureProgram({
      id: "GOI.AIF",
      kind: "INTEREST_SUBVENTION",
      fixedAmount: "30000",
      programTypes: ["INTEREST_SUBVENTION", "CREDIT_GUARANTEE"],
      release: { mechanism: "POST_DISBURSEMENT" },
    });
    const result = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          facts: { applicant: { entityType: "INDIVIDUAL" } },
          selectedPrograms: [
            { programId: pmfme.programId },
            { programId: aif.programId },
          ],
        }),
        registryWith(pmfme, aif),
        [pmfmeAifConvergenceRule],
      ),
    );

    expect(result.compatibilityEvaluations[0]?.status).toBe("COMPATIBLE");
    expect(result.compatibilityEvaluations[0]?.result.convergenceRuleId).toBe(
      pmfmeAifConvergenceRule.convergenceRuleId,
    );
    expect(result.summary.benefits.capitalSubsidy).toBe("350000");
    expect(result.summary.benefits.interestSubvention).toBe("30000");
    expect(result.summary.benefits.totalInitiallyAvailableAssistance).toBe("0");
  });

  it("leaves NLM plus MUDRA unknown and preserves MUDRA as credit only", () => {
    const nlm = nlmProgramDefinitions.find(
      (definition) =>
        definition.programId === programId("GOI.NLM.RURAL_POULTRY"),
    )!;
    const result = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          evaluationAsOfDate: "2026-08-24",
          projectCost: {
            totalProjectCost: monetaryAmount("10000000"),
            costItems: [
              {
                costItemId: "POULTRY-INFRA",
                category: "PLANT_AND_MACHINERY",
                tags: [classificationTag("CAPITAL")],
                amount: monetaryAmount("10000000"),
                sourceReferences: [fixtureSource],
              },
            ],
          },
          financing: {
            promoterContribution: sourcedAmount("2000000"),
            bankFinance: sourcedAmount("8000000"),
            requestedCredit: sourcedAmount("800000"),
            otherFinance: [],
          },
          facts: {
            applicant: { entityType: "INDIVIDUAL" },
            activity: { classification: "POULTRY" },
          },
          selectedPrograms: [
            { programId: nlm.programId },
            { programId: MUDRA_PROGRAM_ID },
          ],
        }),
        registryWith(nlm, mudraProgramDefinition),
        [],
      ),
    );

    expect(result.compatibilityEvaluations[0]?.status).toBe("UNKNOWN");
    expect(result.resolutionStatus).toBe("MANUAL_REVIEW_REQUIRED");
    expect(
      result.individualProgramEvaluations.find(
        (program) => program.snapshot?.programId === MUDRA_PROGRAM_ID,
      )?.evaluation?.benefits,
    ).toEqual([]);
    expect(result.summary.actualBankFinance).toBe("8000000");
    expect(result.summary.benefits.capitalSubsidy).toBe("2500000");
    expect(
      result.nonFinancialBenefits
        .filter((benefit) => benefit.program.programId === MUDRA_PROGRAM_ID)
        .map((benefit) => benefit.benefitCode),
    ).toContain("COLLATERAL_NOT_REQUIRED_UNDER_PROGRAM");
  });

  it("does not assume CMEGP can stack with a central program", () => {
    const central = fixtureProgram({
      id: "GOI.CENTRAL_TEST",
      noBenefits: true,
    });
    const result = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          evaluationAsOfDate: "2026-08-24",
          facts: {
            location: { state: "MAHARASHTRA" },
            applicant: { entityType: "INDIVIDUAL" },
          },
          selectedPrograms: [
            { programId: CMEGP_PROGRAM_ID },
            { programId: central.programId },
          ],
        }),
        registryWith(cmegpProgramDefinition, central),
        [],
      ),
    );

    expect(result.compatibilityEvaluations[0]?.status).toBe("UNKNOWN");
    expect(result.manualReviewItems.map((item) => item.code)).toContain(
      "COMPATIBILITY_EVIDENCE_NOT_FOUND",
    );
  });

  it("does not globally allow or prohibit PMEGP stacking without evidence", () => {
    const otherProgram = fixtureProgram({
      id: "GOI.OTHER_TEST",
      noBenefits: true,
    });
    const result = unwrap(
      composeMultiProgramFunding(
        fixtureInput({
          evaluationAsOfDate: "2026-08-24",
          selectedPrograms: [
            { programId: pmegpNewEnterpriseDefinition.programId },
            { programId: otherProgram.programId },
          ],
        }),
        registryWith(pmegpNewEnterpriseDefinition, otherProgram),
        [],
        createPmegpRuleHandlers(),
      ),
    );

    expect(result.compatibilityEvaluations[0]?.status).toBe("UNKNOWN");
    expect(result.manualReviewItems.map((item) => item.code)).toContain(
      "COMPATIBILITY_EVIDENCE_NOT_FOUND",
    );
  });
});
