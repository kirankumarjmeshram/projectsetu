import { describe, expect, it } from "vitest";

import { programId } from "@/domain/schemes/program";

import { orchestrateProjectCalculation } from "./calculation-orchestrator";
import { createDefaultProjectWizardInput } from "./orchestrator-defaults";

describe("Calculation Orchestrator", () => {
  it("successfully calculates full financial statements for a standard project", () => {
    const input = createDefaultProjectWizardInput();
    const result = orchestrateProjectCalculation(input, "2026-04-01");

    expect(result.success).toBe(true);
    expect(result.projectCost).toBeDefined();
    expect(result.projectCost?.totalProjectCost).toBe("2500000");
    expect(result.meansOfFinance?.totalMeansOfFinance).toBe("2500000");
    expect(result.financingReconciliation?.balanced).toBe(true);

    // Revenue and Operating Expenses Projection
    expect(result.projection).toBeDefined();
    expect(result.projection?.years.length).toBe(5);
    expect(result.projection?.years[0].totalRevenue).toBe("2400000");

    // Loan Schedule
    expect(result.loanSchedule).toBeDefined();
    expect(result.loanSchedule?.summary.originalPrincipal).toBe("2250000");
    expect(result.loanSchedule?.annualSummaries.length).toBe(5);

    // Profit & Loss Schedule
    expect(result.profitAndLoss).toBeDefined();
    expect(result.profitAndLoss?.years.length).toBe(5);
    expect(result.profitAndLoss?.years[0].revenue).toBe("2400000");
    expect(result.profitAndLoss?.years[0].ebitda).toBeDefined();
    expect(result.profitAndLoss?.years[0].profitAfterTax).toBeDefined();

    // Cash Flow Schedule
    expect(result.cashFlow).toBeDefined();
    expect(result.cashFlow?.years.length).toBe(5);
    expect(result.cashFlow?.years[0].operatingCashFlow).toBeDefined();
    expect(result.cashFlow?.years[0].closingCash).toBeDefined();

    // Balance Sheet Schedule
    expect(result.balanceSheet).toBeDefined();
    expect(result.balanceSheet?.years.length).toBe(5);
    expect(result.balanceSheet?.years[0].totalAssets).toBeDefined();
    expect(result.balanceSheet?.years[0].totalEquity).toBeDefined();

    // Bankability Metrics
    expect(result.bankabilityMetrics).toBeDefined();
    expect(result.bankabilityMetrics?.years.length).toBe(5);
    expect(result.bankabilityMetrics?.averageDscr).toBeDefined();

    // Investment Returns Analysis
    expect(result.investmentReturns).toBeDefined();
    expect(result.investmentReturns?.netPresentValue).toBeDefined();
    expect(result.investmentReturns?.internalRateOfReturn).toBeDefined();
  });

  it("handles single scheme evaluation (PMEGP)", () => {
    const input = createDefaultProjectWizardInput({
      selectedPrograms: [
        {
          programId: programId("GOI.PMEGP.NEW_ENTERPRISE"),
        },
      ],
      schemeFacts: {
        "pmegp.applicant_type": "INDIVIDUAL",
        "pmegp.social_category": "GENERAL",
        "pmegp.gender": "MALE",
        "pmegp.special_category_flags": [],
        "pmegp.location_classification": "RURAL",
        "pmegp.is_ner_resident": false,
        "pmegp.is_aspirational_district": false,
        "pmegp.enterprise_status": "NEW",
        "pmegp.prior_pmegp_subsidy": false,
        "pmegp.prior_govt_subsidy": false,
        "pmegp.edp_training_completed": true,
        "pmegp.activity_type": "MANUFACTURING",
        "pmegp.is_negative_list": false,
        "pmegp.education_level": "GRADUATE",
        "pmegp.unit_location_matches_project": true,
      },
    });

    const result = orchestrateProjectCalculation(input, "2026-04-01");
    expect(result.fundingComposer).toBeDefined();
    expect(result.fundingComposer?.individualProgramEvaluations.length).toBe(1);
    expect(result.fundingComposer?.individualProgramEvaluations[0].status).toBe(
      "EVALUATED",
    );
  });

  it("handles multi-scheme evaluation (NLM + MUDRA)", () => {
    const input = createDefaultProjectWizardInput({
      selectedPrograms: [
        {
          programId: programId("GOI.NLM.RURAL_POULTRY"),
        },
        {
          programId: programId("GOI.PMMY"),
        },
      ],
      schemeFacts: {
        "applicant.entityType": "INDIVIDUAL",
        "financing.requestedCredit": "2250000.00",
        "activity.classification": "POULTRY",
      },
    });

    const result = orchestrateProjectCalculation(input, "2026-04-01");
    expect(result.fundingComposer).toBeDefined();
    expect(result.fundingComposer?.individualProgramEvaluations.length).toBe(2);
    expect(
      result.fundingComposer?.compatibilityEvaluations.length,
    ).toBeGreaterThan(0);
  });

  it("flags unbalanced means of finance as a warning issue", () => {
    const input = createDefaultProjectWizardInput({
      financingSources: [
        {
          id: "fin-1",
          type: "PROMOTER_CONTRIBUTION",
          name: "Promoter Contribution",
          amount: "200000.00",
        },
      ],
    });

    const result = orchestrateProjectCalculation(input, "2026-04-01");
    expect(result.financingReconciliation?.balanced).toBe(false);
    expect(
      result.issues.some((i) => i.code === "MEANS_OF_FINANCE_UNBALANCED"),
    ).toBe(true);
  });

  it("handles empty cost items gracefully without crashing", () => {
    const input = createDefaultProjectWizardInput({
      costItems: [],
      financingSources: [],
    });

    const result = orchestrateProjectCalculation(input, "2026-04-01");
    expect(result).toBeDefined();
    expect(result.projectCost?.totalProjectCost).toBe("0");
  });

  it("evaluates CMEGP scheme correctly with Maharashtra location", () => {
    const input = createDefaultProjectWizardInput({
      project: {
        id: "proj-cmegp-1",
        name: "CMEGP Unit",
        mode: "SUBSIDY",
        industryActivity: "Manufacturing",
        stage: "PLANNING",
        status: "DRAFT",
        areaClassification: "RURAL",
        address: {
          lines: ["Plot 44"],
          district: "Nagpur",
          state: "MAHARASHTRA",
          pinCode: "440001",
        },
        projectionPeriodYears: 5,
      },
      selectedPrograms: [
        {
          programId: programId("MH.CMEGP.NEW_ENTERPRISE"),
        },
      ],
      schemeFacts: {
        "location.state": "MAHARASHTRA",
        "applicant.entityType": "INDIVIDUAL",
        "cmegp.applicant_gender": "FEMALE",
        "cmegp.social_category": "SC",
        "cmegp.location_classification": "RURAL",
        "cmegp.is_differently_abled": false,
      },
    });

    const result = orchestrateProjectCalculation(input, "2026-04-01");
    expect(result.fundingComposer).toBeDefined();
    expect(result.fundingComposer?.individualProgramEvaluations.length).toBe(1);
    expect(result.fundingComposer?.individualProgramEvaluations[0].status).toBe(
      "EVALUATED",
    );
  });

  it("evaluates PMFME Individual scheme correctly", () => {
    const input = createDefaultProjectWizardInput({
      selectedPrograms: [
        {
          programId: programId("GOI.PMFME.INDIVIDUAL_UNIT"),
        },
      ],
      schemeFacts: {
        "applicant.entityType": "INDIVIDUAL",
      },
    });

    const result = orchestrateProjectCalculation(input, "2026-04-01");
    expect(result.fundingComposer).toBeDefined();
    expect(result.fundingComposer?.individualProgramEvaluations.length).toBe(1);
    expect(result.fundingComposer?.individualProgramEvaluations[0].status).toBe(
      "EVALUATED",
    );
  });
});
