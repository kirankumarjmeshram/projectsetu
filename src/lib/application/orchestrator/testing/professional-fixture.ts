import { createDefaultProjectWizardInput } from "../orchestrator-defaults";
import { programId } from "@/domain/schemes/program";

/** Synthetic applicant-supplied assumptions, not market research or a sanction. */
export function professionalFixture(scheme = false) {
  const base = createDefaultProjectWizardInput();
  return createDefaultProjectWizardInput({
    project: {
      ...base.project,
      id: "fixture-millet",
      name: "TEST FIXTURE Nashik Millet Foods",
      mode: scheme ? "SUBSIDY" : "BANKABLE",
      industryActivity: "Millet food processing",
      address: {
        lines: ["Test industrial unit"],
        district: "Nashik",
        state: "Maharashtra",
      },
      projectDescription:
        "Synthetic test project; all quantities, prices and market statements are applicant assumptions.",
    },
    applicant: {
      applicantType: "INDIVIDUAL",
      name: "Test Applicant Anita",
      gender: "FEMALE",
      age: 35,
      socialCategory: "GENERAL",
      educationQualification: "Graduate",
      enterpriseStatus: "NEW",
      experienceYears: 5,
      priorSubsidyClaimed: false,
      edpTrainingCompleted: true,
    },
    costItems: [
      {
        id: "machine",
        description: "Processing machinery",
        category: "PLANT_AND_MACHINERY",
        amount: "600000",
      },
      {
        id: "equipment",
        description: "Packing equipment",
        category: "PLANT_AND_MACHINERY",
        amount: "200000",
      },
      {
        id: "wc-margin",
        description: "Working capital reserve",
        category: "MARGIN_FOR_WORKING_CAPITAL",
        amount: "200000",
      },
    ],
    financingSources: [
      {
        id: "equity",
        name: "Applicant equity assumption",
        type: "PROMOTER_CONTRIBUTION",
        amount: "400000",
      },
      {
        id: "term",
        name: "Proposed loan subject to appraisal",
        type: "TERM_LOAN",
        amount: "600000",
      },
    ],
    revenueProducts: [
      {
        id: "snacks",
        name: "Millet snack packs",
        unit: "packs",
        quantityYear1: "40000",
        unitPriceYear1: "50",
        capacityUtilisationYear1: "60",
        annualQuantityGrowth: "5",
        annualPriceEscalation: "3",
      },
      {
        id: "flour",
        name: "Millet flour",
        unit: "kg",
        quantityYear1: "10000",
        unitPriceYear1: "60",
        capacityUtilisationYear1: "50",
        annualQuantityGrowth: "5",
        annualPriceEscalation: "3",
      },
    ],
    operatingExpenses: [
      {
        id: "materials",
        name: "Materials and packaging",
        category: "RAW_MATERIALS",
        calculationMethod: "PERCENTAGE_OF_REVENUE",
        costBehavior: "VARIABLE",
        percentageOfRevenueYear1: "40",
        annualEscalation: "0",
      },
      {
        id: "wages",
        name: "Wages",
        category: "WAGES",
        calculationMethod: "FIXED_ANNUAL_AMOUNT",
        costBehavior: "FIXED",
        annualAmountYear1: "240000",
        annualEscalation: "5",
      },
      {
        id: "rent",
        name: "Rent and utilities",
        category: "RENT",
        calculationMethod: "FIXED_ANNUAL_AMOUNT",
        costBehavior: "FIXED",
        annualAmountYear1: "120000",
        annualEscalation: "5",
      },
    ],
    workingCapital: {
      dayBase: "360",
      rawMaterialDays: "30",
      finishedGoodsDays: "15",
      receivableDays: "30",
      creditorDays: "15",
      borrowerMarginPercentage: "25",
    },
    loan: {
      id: "loan",
      principalAmount: "600000",
      annualInterestRate: "10",
      repaymentFrequency: "YEARLY",
      repaymentMethod: "EQUAL_PRINCIPAL",
      repaymentTenureYears: 5,
      moratoriumPeriods: 0,
    },
    depreciableAssets: [
      {
        id: "dep",
        name: "Processing and packing machinery",
        category: "PLANT_AND_MACHINERY",
        method: "STRAIGHT_LINE",
        originalCost: "800000",
        residualValue: "0",
        usefulLifeYears: 10,
      },
    ],
    taxAndReturns: {
      taxMode: "PERCENTAGE_OF_POSITIVE_PBT",
      taxRate: "25",
      discountRate: "12",
      initialOpeningCash: "0",
    },
    selectedPrograms: scheme ? [{ programId: programId("GOI.PMMY") }] : [],
    schemeFacts: scheme
      ? {
          financing: { requestedCredit: "600000", purpose: "BOTH" },
          activity: { classification: "MANUFACTURING" },
        }
      : {},
    dprDetails: {
      businessObjective:
        "Test assumption: process and pack millet for local retail sale.",
      productServiceDescription:
        "Test assumption: snack packs and flour sold in packs and kilograms.",
      targetMarket:
        "Applicant test assumption: independent Nashik retailers. No independently verified demand or purchase commitments.",
      operatingProcess:
        "Test assumption: clean, mill, mix, process, inspect and pack.",
      infrastructureUtilities:
        "Test assumption: leased premises with electricity and water; availability requires documentary verification.",
      manpowerPlan:
        "Test assumption: two production workers within the annual wage budget.",
      implementationPlan:
        "Test assumption: installation in month one, trials in month two, commercial sales in month three.",
      risks: "Input price changes, slower sales and delayed commissioning.",
      riskMitigation:
        "Applicant proposal: alternate suppliers and staged procurement; effectiveness is unverified.",
    },
  });
}
