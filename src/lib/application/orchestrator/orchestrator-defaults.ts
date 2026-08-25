import { generateId } from "@/lib/persistence/id";

import type {
  ApplicantPromoterInput,
  FinanceSourceInput,
  LoanAssumptionsInput,
  OperatingExpenseInput,
  ProjectCostItemInput,
  ProjectDetailsInput,
  ProjectWizardInput,
  RevenueProductInput,
  TaxAndReturnsInput,
  WorkingCapitalInput,
} from "./orchestrator-types";

export function createDefaultProjectDetails(
  overrides?: Partial<ProjectDetailsInput>,
): ProjectDetailsInput {
  const id = overrides?.id ?? generateId();
  return {
    id,
    name: "New Enterprise Project",
    mode: "SUBSIDY",
    industryActivity: "Manufacturing / Processing",
    stage: "PLANNING",
    status: "DRAFT",
    areaClassification: "RURAL",
    address: {
      lines: ["Industrial Area Plot"],
      villageTownCity: "",
      district: "Pune",
      state: "Maharashtra",
      pinCode: "411001",
    },
    projectionPeriodYears: 5,
    ...overrides,
  };
}

export function createDefaultApplicant(
  overrides?: Partial<ApplicantPromoterInput>,
): ApplicantPromoterInput {
  return {
    applicantType: "INDIVIDUAL",
    name: "Promoter Name",
    gender: "MALE",
    age: 32,
    socialCategory: "GENERAL",
    educationQualification: "Graduate",
    enterpriseStatus: "NEW",
    priorSubsidyClaimed: false,
    edpTrainingCompleted: true,
    experienceYears: 5,
    ...overrides,
  };
}

export function createDefaultCostItems(): readonly ProjectCostItemInput[] {
  return [
    {
      id: generateId(),
      description: "Land & Site Development",
      category: "LAND_DEVELOPMENT",
      amount: "200000.00",
      notes: "Boundary wall and leveling",
    },
    {
      id: generateId(),
      description: "Factory Building / Shed (1500 sq ft)",
      category: "BUILDING",
      amount: "800000.00",
      notes: "Civil construction cost",
    },
    {
      id: generateId(),
      description: "Processing Machinery & Main Equipment",
      category: "PLANT_AND_MACHINERY",
      amount: "1200000.00",
      notes: "Automated processing line with GST",
    },
    {
      id: generateId(),
      description: "Electrification & Installation",
      category: "ELECTRICAL_INSTALLATION",
      amount: "150000.00",
      notes: "Transformer, wiring, and switchgear",
    },
    {
      id: generateId(),
      description: "Preliminary & Pre-operative Expenses",
      category: "PREOPERATIVE_EXPENSES",
      amount: "50000.00",
      notes: "Consultancy, DPR and legal",
    },
    {
      id: generateId(),
      description: "Margin for Working Capital",
      category: "MARGIN_FOR_WORKING_CAPITAL",
      amount: "100000.00",
      notes: "Initial working capital margin",
    },
  ];
}

export function createDefaultFinancingSources(): readonly FinanceSourceInput[] {
  return [
    {
      id: generateId(),
      type: "PROMOTER_CONTRIBUTION",
      name: "Own Equity Contribution (10%)",
      amount: "250000.00",
      notes: "Promoter savings",
    },
    {
      id: generateId(),
      type: "TERM_LOAN",
      name: "Bank Term Loan (90%)",
      amount: "2250000.00",
      notes: "Commercial bank sanction",
    },
  ];
}

export function createDefaultRevenueProducts(): readonly RevenueProductInput[] {
  return [
    {
      id: generateId(),
      name: "Primary Manufactured Product",
      unit: "Units",
      quantityYear1: "10000",
      unitPriceYear1: "400.00",
      capacityUtilisationYear1: "60",
      annualQuantityGrowth: "10",
      annualPriceEscalation: "3",
      notes: "Standard production capacity",
    },
  ];
}

export function createDefaultOperatingExpenses(): readonly OperatingExpenseInput[] {
  return [
    {
      id: generateId(),
      name: "Raw Materials & Consumables",
      category: "RAW_MATERIALS",
      calculationMethod: "PERCENTAGE_OF_REVENUE",
      costBehavior: "VARIABLE",
      percentageOfRevenueYear1: "50",
      annualEscalation: "0",
      notes: "Direct material cost",
    },
    {
      id: generateId(),
      name: "Factory Wages & Direct Labor",
      category: "WAGES",
      calculationMethod: "FIXED_ANNUAL_AMOUNT",
      costBehavior: "VARIABLE",
      annualAmountYear1: "240000.00",
      annualEscalation: "5",
      notes: "4 workers @ 5000/month",
    },
    {
      id: generateId(),
      name: "Power, Fuel & Utilities",
      category: "POWER_AND_ELECTRICITY",
      calculationMethod: "FIXED_ANNUAL_AMOUNT",
      costBehavior: "VARIABLE",
      annualAmountYear1: "120000.00",
      annualEscalation: "5",
      notes: "Electricity connected load",
    },
    {
      id: generateId(),
      name: "Administrative Salaries & Staff",
      category: "SALARIES",
      calculationMethod: "FIXED_ANNUAL_AMOUNT",
      costBehavior: "FIXED",
      annualAmountYear1: "180000.00",
      annualEscalation: "5",
      notes: "Supervisor and accountant",
    },
    {
      id: generateId(),
      name: "Repairs, Maintenance & Consumables",
      category: "REPAIRS_AND_MAINTENANCE",
      calculationMethod: "FIXED_ANNUAL_AMOUNT",
      costBehavior: "FIXED",
      annualAmountYear1: "50000.00",
      annualEscalation: "5",
      notes: "Plant upkeep",
    },
    {
      id: generateId(),
      name: "Marketing, Selling & Administrative Overheads",
      category: "ADMINISTRATIVE_EXPENSES",
      calculationMethod: "PERCENTAGE_OF_REVENUE",
      costBehavior: "FIXED",
      percentageOfRevenueYear1: "3",
      annualEscalation: "0",
      notes: "Postage, travel, marketing",
    },
  ];
}

export function createDefaultWorkingCapital(): WorkingCapitalInput {
  return {
    dayBase: "365",
    rawMaterialDays: "30",
    finishedGoodsDays: "15",
    receivableDays: "30",
    creditorDays: "15",
    borrowerMarginPercentage: "25",
    notes: "Standard MSME working capital cycle",
  };
}

export function createDefaultLoan(): LoanAssumptionsInput {
  return {
    id: generateId(),
    loanType: "TERM_LOAN",
    principalAmount: "2250000.00",
    annualInterestRate: "9.50",
    repaymentFrequency: "MONTHLY",
    repaymentMethod: "EQUAL_PRINCIPAL",
    repaymentTenureYears: 5,
    moratoriumPeriods: 6,
    moratoriumType: "PRINCIPAL_ONLY",
    moratoriumInterestTreatment: "PAY_CURRENT",
    notes: "6 months moratorium on principal repayment",
  };
}

export function createDefaultTaxAndReturns(): TaxAndReturnsInput {
  return {
    taxMode: "PERCENTAGE_OF_POSITIVE_PBT",
    taxRate: "25.00",
    discountRate: "12.00",
    initialOpeningCash: "50000.00",
  };
}

export function createDefaultProjectWizardInput(
  overrides?: Partial<
    Omit<ProjectWizardInput, "loan" | "taxAndReturns" | "workingCapital"> & {
      loan?: Partial<LoanAssumptionsInput>;
      taxAndReturns?: Partial<TaxAndReturnsInput>;
      workingCapital?: Partial<WorkingCapitalInput>;
    }
  >,
): ProjectWizardInput {
  const project = overrides?.project ?? createDefaultProjectDetails();
  const defaultLoan = createDefaultLoan();
  const defaultTax = createDefaultTaxAndReturns();
  const defaultWc = createDefaultWorkingCapital();

  return {
    project,
    applicant: overrides?.applicant ?? createDefaultApplicant(),
    costItems: overrides?.costItems ?? createDefaultCostItems(),
    financingSources:
      overrides?.financingSources ?? createDefaultFinancingSources(),
    revenueProducts:
      overrides?.revenueProducts ?? createDefaultRevenueProducts(),
    operatingExpenses:
      overrides?.operatingExpenses ?? createDefaultOperatingExpenses(),
    workingCapital: overrides?.workingCapital
      ? { ...defaultWc, ...overrides.workingCapital }
      : defaultWc,
    loan: overrides?.loan
      ? { ...defaultLoan, ...overrides.loan }
      : defaultLoan,
    taxAndReturns: overrides?.taxAndReturns
      ? { ...defaultTax, ...overrides.taxAndReturns }
      : defaultTax,
    selectedPrograms: overrides?.selectedPrograms ?? [],
    schemeFacts: overrides?.schemeFacts ?? {},
  };
}
