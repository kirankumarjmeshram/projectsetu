import {
  adaptDepreciationScheduleToBalanceSheetFixedAssets,
  adaptFinancingInflowsToPromoterCapital,
  adaptLoanScheduleToBalanceSheetOutstanding,
  calculateBalanceSheetFromAuthoritativeSchedules,
} from "@/domain/balance-sheet/adapters";
import {
  adaptDepreciationAdditionsAsCashCapitalExpenditure,
  adaptLoanAnnualPaymentsToCashFlow,
  adaptWorkingCapitalRequirementsToChanges,
  calculateCashFlowFromAuthoritativeSchedules,
} from "@/domain/cash-flow/adapters";
import { calculateDepreciationSchedule } from "@/domain/depreciation/calculations";
import type { DepreciableAsset } from "@/domain/depreciation/depreciation";
import {
  calculateMeansOfFinance,
  reconcileMeansOfFinance,
} from "@/domain/financing/calculations";
import type {
  MeansOfFinance,
  FinanceSourceType,
} from "@/domain/financing/financing";
import {
  adaptMeansOfFinanceSummary,
  adaptProjectCostSummary,
} from "@/domain/funding-composer/adapters";
import { composeMultiProgramFunding } from "@/domain/funding-composer/calculations";
import type { FundingComposerInput } from "@/domain/funding-composer/contracts";
import { composeProjectInvestmentCashFlowSeries } from "@/domain/investment-returns/adapters";
import { calculateInvestmentReturns } from "@/domain/investment-returns/calculations";
import type { ProjectInvestmentCashFlowPeriodInput } from "@/domain/investment-returns/investment-returns";
import { generateLoanRepaymentSchedule } from "@/domain/loan/calculations";
import type { LoanTerms, LoanType } from "@/domain/loan/loan";
import {
  adaptBalanceSheetToMetrics,
  adaptLoanScheduleToMetricsDebtService,
  adaptProfitAndLossToMetrics,
  adaptProjectCostToMetrics,
  adaptProjectionToBreakEvenInputs,
  calculateBankabilityMetricsFromAuthoritativeSchedules,
} from "@/domain/metrics/adapters";
import type { ProjectionCostClassification } from "@/domain/metrics/metrics";
import { calculateProfitAndLossFromAuthoritativeSchedules } from "@/domain/profit-and-loss/calculations";
import type { ProfitAndLossTaxConfiguration } from "@/domain/profit-and-loss/profit-and-loss";
import { calculateProjectCost } from "@/domain/project-cost/calculations";
import type {
  ProjectCost,
  ProjectCostCategory,
} from "@/domain/project-cost/project-cost";
import { calculateRevenueAndOperatingExpenseProjection } from "@/domain/projection/calculations";
import type {
  OperatingExpenseProjectionAssumption,
  ProjectionOperatingExpenseCategory,
  RevenueAndOperatingExpenseProjectionInput,
  RevenueProjectionAssumption,
} from "@/domain/projection/projection";
import { createLiveProgramRegistry } from "@/domain/schemes/programs";
import { createPmegpRuleHandlers } from "@/domain/schemes/programs/pmegp";
import { pmfmeAifConvergenceRule } from "@/domain/schemes/programs/pmfme";
import type { Assumption } from "@/domain/shared/assumptions";
import {
  decimalValue,
  monetaryAmount,
  percentage,
  toDecimal,
  toMonetaryAmount,
} from "@/domain/shared/decimal";
import type { SourceReference } from "@/domain/shared/provenance";
import type {
  DecimalValue,
  ISODate,
  MonetaryAmount,
  Percentage,
} from "@/domain/shared/types";
import { calculateWorkingCapital } from "@/domain/working-capital/calculations";
import type {
  CurrentAssetCategory,
  CurrentLiabilityCategory,
  WorkingCapitalAssessmentInput,
  WorkingCapitalLine,
} from "@/domain/working-capital/working-capital";

import type {
  BalanceSheetSchedule,
  BankabilityMetricsSchedule,
  CashFlowSchedule,
  InvestmentReturnsAnalysis,
  MultiProgramFundingResult,
  OrchestrationIssue,
  ProfitAndLossSchedule,
  ProjectCalculationResult,
  ProjectWizardInput,
  WorkingCapitalSummary,
} from "./orchestrator-types";

const defaultSource: SourceReference = {
  id: "src-assumptions-entry",
  type: "USER_INPUT",
  notes: "Project Assumptions Entry",
};

function assumption<T>(
  value: T,
  source: SourceReference = defaultSource,
  notes?: string,
): Assumption<T> {
  return { value, source, notes };
}

function toMonetary(val: string | undefined): MonetaryAmount {
  if (!val || val.trim() === "") return monetaryAmount("0.00");
  try {
    return monetaryAmount(val.trim());
  } catch {
    return monetaryAmount("0.00");
  }
}

function toPercent(val: string | undefined): Percentage {
  if (!val || val.trim() === "") return percentage("0.00");
  try {
    return percentage(val.trim());
  } catch {
    return percentage("0.00");
  }
}

function toDec(val: string | undefined): DecimalValue {
  if (!val || val.trim() === "") return decimalValue("0");
  try {
    return decimalValue(val.trim());
  } catch {
    return decimalValue("0");
  }
}

export function orchestrateProjectCalculation(
  input: ProjectWizardInput,
  evaluationDate?: ISODate,
): ProjectCalculationResult {
  const issues: OrchestrationIssue[] = [];
  const projectId = input.project.id;
  const projectionPeriodYears = input.project.projectionPeriodYears;
  const asOfDate: ISODate =
    evaluationDate ?? (new Date().toISOString().split("T")[0] as ISODate);

  // ─── 1. Project Cost ────────────────────────────────────────────────────────
  const projectCostDomain: ProjectCost = {
    projectId,
    items: input.costItems.map((item) => {
      const category = (
        item.category === "CONTINGENCIES"
          ? "CONTINGENCY"
          : item.category === "TECHNICAL_KNOW_HOW"
            ? "OTHER"
            : item.category
      ) as ProjectCostCategory;

      return {
        id: item.id,
        description: item.description,
        category,
        amount: { value: toMonetary(item.amount), source: defaultSource },
        tax: item.tax
          ? { value: toMonetary(item.tax), source: defaultSource }
          : undefined,
        freight: item.freight
          ? { value: toMonetary(item.freight), source: defaultSource }
          : undefined,
        installation: item.installation
          ? { value: toMonetary(item.installation), source: defaultSource }
          : undefined,
        notes: item.notes,
      };
    }),
    statedTotal: toMonetary(
      input.costItems
        .reduce(
          (sum, item) => sum.plus(toDecimal(toMonetary(item.amount))),
          toDecimal(monetaryAmount("0.00")),
        )
        .toString(),
    ),
  };

  const projectCostResult = calculateProjectCost(projectCostDomain);
  if (!projectCostResult.ok) {
    for (const err of projectCostResult.errors) {
      issues.push({
        code: err.code,
        message: err.message,
        severity: "ERROR",
        section: "Project Cost",
        path: err.path,
      });
    }
  }
  const projectCostSummary = projectCostResult.ok
    ? projectCostResult.value
    : undefined;

  // ─── 2. Means of Finance ───────────────────────────────────────────────────
  const financeTypeMap: Record<string, FinanceSourceType> = {
    PROMOTER_CONTRIBUTION: "PROMOTER_CONTRIBUTION",
    EQUITY: "EQUITY",
    TERM_LOAN: "TERM_LOAN",
    WORKING_CAPITAL_LOAN: "WORKING_CAPITAL_FINANCE",
    CAPITAL_SUBSIDY: "GOVERNMENT_SUBSIDY_OR_GRANT",
    UNSECURED_LOAN: "UNSECURED_LOAN",
    OTHER_CONTRIBUTION: "OTHER_CONTRIBUTION",
  };

  const meansOfFinanceDomain: MeansOfFinance = {
    projectId,
    sources: input.financingSources.map((source) => ({
      id: source.id,
      type: financeTypeMap[source.type] || "OTHER_CONTRIBUTION",
      name: source.name,
      amount: toMonetary(source.amount),
      source: defaultSource,
      notes: source.notes,
    })),
    statedTotal: toMonetary(
      input.financingSources
        .reduce(
          (sum, source) => sum.plus(toDecimal(toMonetary(source.amount))),
          toDecimal(monetaryAmount("0.00")),
        )
        .toString(),
    ),
  };

  const meansOfFinanceSummary = calculateMeansOfFinance(meansOfFinanceDomain);
  const reconciliation = projectCostSummary
    ? reconcileMeansOfFinance(
        projectCostSummary.totalProjectCost,
        meansOfFinanceSummary.totalMeansOfFinance,
      )
    : undefined;

  if (reconciliation && !reconciliation.balanced) {
    issues.push({
      code: "MEANS_OF_FINANCE_UNBALANCED",
      message: `Means of finance has a ${reconciliation.status.toLowerCase()} of ${reconciliation.absoluteDifference} against total project cost.`,
      severity: "WARNING",
      section: "Financing",
    });
  }

  // ─── 3. Revenue & Operating Expenses Projection ────────────────────────────
  const revenueAssumptions: RevenueProjectionAssumption[] =
    input.revenueProducts.map((p) => ({
      id: p.id,
      productOrServiceName: p.name,
      unit: p.unit,
      quantity: assumption(toDec(p.quantityYear1 || "0"), defaultSource),
      unitPrice: assumption(toMonetary(p.unitPriceYear1), defaultSource),
      capacityUtilisation: assumption(
        toPercent(p.capacityUtilisationYear1),
        defaultSource,
      ),
      quantityGrowth: assumption(
        toPercent(p.annualQuantityGrowth),
        defaultSource,
      ),
      sellingPriceEscalation: assumption(
        toPercent(p.annualPriceEscalation),
        defaultSource,
      ),
      notes: p.notes,
    }));

  const opexCategoryMap: Record<string, ProjectionOperatingExpenseCategory> = {
    RAW_MATERIALS: "RAW_MATERIALS",
    CONSUMABLES: "RAW_MATERIALS",
    POWER_AND_ELECTRICITY: "POWER_AND_ELECTRICITY",
    FUEL: "FUEL",
    WAGES: "WAGES",
    SALARIES: "SALARIES",
    RENT: "RENT",
    REPAIRS_AND_MAINTENANCE: "REPAIRS_AND_MAINTENANCE",
    INSURANCE: "MISCELLANEOUS_OVERHEADS",
    ADMINISTRATIVE_EXPENSES: "ADMINISTRATIVE_EXPENSES",
    SELLING_EXPENSES: "MARKETING_AND_ADVERTISEMENT",
    PACKING_EXPENSES: "MISCELLANEOUS_OVERHEADS",
    OTHER: "CUSTOM",
  };

  const operatingExpenseAssumptions: OperatingExpenseProjectionAssumption[] =
    input.operatingExpenses.map((exp) => {
      const category = opexCategoryMap[exp.category] || "CUSTOM";
      if (exp.calculationMethod === "FIXED_ANNUAL_AMOUNT") {
        return {
          id: exp.id,
          name: exp.name,
          category,
          calculationMethod: "FIXED_ANNUAL_AMOUNT",
          annualAmount: assumption(
            toMonetary(exp.annualAmountYear1),
            defaultSource,
          ),
          annualEscalation: assumption(
            toPercent(exp.annualEscalation),
            defaultSource,
          ),
          notes: exp.notes,
        };
      }
      return {
        id: exp.id,
        name: exp.name,
        category,
        calculationMethod: "PERCENTAGE_OF_REVENUE",
        percentageOfRevenue: assumption(
          toPercent(exp.percentageOfRevenueYear1),
          defaultSource,
        ),
        annualEscalation: assumption(
          toPercent(exp.annualEscalation),
          defaultSource,
        ),
        notes: exp.notes,
      };
    });

  const projectionInput: RevenueAndOperatingExpenseProjectionInput = {
    projectId,
    projectionPeriodYears,
    revenueAssumptions,
    operatingExpenseAssumptions,
  };

  const projectionResult =
    calculateRevenueAndOperatingExpenseProjection(projectionInput);
  if (!projectionResult.ok) {
    for (const err of projectionResult.errors) {
      issues.push({
        code: err.code,
        message: err.message,
        severity: "ERROR",
        section: "Operations",
        path: err.path,
      });
    }
  }
  const projection = projectionResult.ok ? projectionResult.value : undefined;

  // ─── 4. Working Capital Assessment ─────────────────────────────────────────
  const workingCapitalSummaries: WorkingCapitalSummary[] = [];
  if (projection) {
    for (let yr = 1; yr <= projectionPeriodYears; yr++) {
      const yearProjection = projection.years.find((y) => y.year === yr);
      const totalRevenue = yearProjection
        ? yearProjection.totalRevenue
        : monetaryAmount("0.00");
      const rawMaterialsCost = yearProjection
        ? yearProjection.rawMaterialAndVariableCosts
        : monetaryAmount("0.00");
      const totalOpex = yearProjection
        ? yearProjection.totalOperatingExpenses
        : monetaryAmount("0.00");

      const wcLines: WorkingCapitalLine[] = [
        {
          id: `wc-rm-${yr}`,
          name: "Raw Material Inventory",
          side: "CURRENT_ASSET",
          category: "RAW_MATERIAL_INVENTORY" as CurrentAssetCategory,
          annualBaseAmount: assumption(rawMaterialsCost, defaultSource),
          holdingPeriodDays: assumption(
            toDec(input.workingCapital.rawMaterialDays || "30"),
            defaultSource,
          ),
        },
        {
          id: `wc-fg-${yr}`,
          name: "Finished Goods Inventory",
          side: "CURRENT_ASSET",
          category: "FINISHED_GOODS" as CurrentAssetCategory,
          annualBaseAmount: assumption(totalOpex, defaultSource),
          holdingPeriodDays: assumption(
            toDec(input.workingCapital.finishedGoodsDays || "15"),
            defaultSource,
          ),
        },
        {
          id: `wc-rec-${yr}`,
          name: "Receivables / Debtors",
          side: "CURRENT_ASSET",
          category: "RECEIVABLES" as CurrentAssetCategory,
          annualBaseAmount: assumption(totalRevenue, defaultSource),
          holdingPeriodDays: assumption(
            toDec(input.workingCapital.receivableDays || "30"),
            defaultSource,
          ),
        },
        {
          id: `wc-pay-${yr}`,
          name: "Creditors / Supplier Credit",
          side: "CURRENT_LIABILITY",
          category: "SUPPLIER_CREDIT" as CurrentLiabilityCategory,
          annualBaseAmount: assumption(rawMaterialsCost, defaultSource),
          holdingPeriodDays: assumption(
            toDec(input.workingCapital.creditorDays || "15"),
            defaultSource,
          ),
        },
      ];

      const wcInput: WorkingCapitalAssessmentInput = {
        projectId,
        projectionYear: yr,
        lines: wcLines,
        borrowerMargin: assumption(
          toPercent(input.workingCapital.borrowerMarginPercentage),
          defaultSource,
        ),
      };

      const wcResult = calculateWorkingCapital(
        wcInput,
        toDec(input.workingCapital.dayBase || "365"),
      );
      if (wcResult.ok) {
        workingCapitalSummaries.push(wcResult.value);
      } else {
        for (const err of wcResult.errors) {
          issues.push({
            code: err.code,
            message: `Year ${yr} Working Capital: ${err.message}`,
            severity: "ERROR",
            section: "Working Capital",
            path: err.path,
          });
        }
      }
    }
  }

  // ─── 5. Depreciation Schedule ──────────────────────────────────────────────
  const depreciableAssets: DepreciableAsset[] = [];
  if (input.depreciableAssets && input.depreciableAssets.length > 0) {
    for (const asset of input.depreciableAssets) {
      if (asset.method === "STRAIGHT_LINE") {
        depreciableAssets.push({
          id: asset.id,
          name: asset.name,
          category: asset.category,
          method: "STRAIGHT_LINE",
          originalCost: assumption(
            toMonetary(asset.originalCost),
            defaultSource,
          ),
          residualValue: assumption(
            toMonetary(asset.residualValue),
            defaultSource,
          ),
          usefulLifeYears: assumption(
            asset.usefulLifeYears ?? 10,
            defaultSource,
          ),
          depreciationStartYear: asset.startYear ?? 1,
        });
      } else {
        depreciableAssets.push({
          id: asset.id,
          name: asset.name,
          category: asset.category,
          method: "WRITTEN_DOWN_VALUE",
          originalCost: assumption(
            toMonetary(asset.originalCost),
            defaultSource,
          ),
          residualValue: assumption(
            toMonetary(asset.residualValue),
            defaultSource,
          ),
          depreciationRate: assumption(
            toPercent(asset.depreciationRate),
            defaultSource,
          ),
          depreciationStartYear: asset.startYear ?? 1,
        });
      }
    }
  } else if (input.costItems.length > 0) {
    for (const item of input.costItems) {
      if (item.category === "BUILDING" || item.category === "CIVIL_WORKS") {
        depreciableAssets.push({
          id: `dep-${item.id}`,
          name: item.description,
          category: "BUILDING",
          method: "STRAIGHT_LINE",
          originalCost: assumption(toMonetary(item.amount), defaultSource),
          residualValue: assumption(monetaryAmount("0.00"), defaultSource),
          usefulLifeYears: assumption(30, defaultSource),
          depreciationStartYear: 1,
        });
      } else if (
        item.category === "PLANT_AND_MACHINERY" ||
        item.category === "EQUIPMENT" ||
        item.category === "ELECTRICAL_INSTALLATION"
      ) {
        depreciableAssets.push({
          id: `dep-${item.id}`,
          name: item.description,
          category: "PLANT_AND_MACHINERY",
          method: "STRAIGHT_LINE",
          originalCost: assumption(toMonetary(item.amount), defaultSource),
          residualValue: assumption(monetaryAmount("0.00"), defaultSource),
          usefulLifeYears: assumption(10, defaultSource),
          depreciationStartYear: 1,
        });
      } else if (
        item.category === "FURNITURE" ||
        item.category === "COMPUTERS_AND_IT" ||
        item.category === "VEHICLE"
      ) {
        depreciableAssets.push({
          id: `dep-${item.id}`,
          name: item.description,
          category:
            item.category === "VEHICLE" ? "VEHICLE" : "FURNITURE_AND_FIXTURES",
          method: "STRAIGHT_LINE",
          originalCost: assumption(toMonetary(item.amount), defaultSource),
          residualValue: assumption(monetaryAmount("0.00"), defaultSource),
          usefulLifeYears: assumption(5, defaultSource),
          depreciationStartYear: 1,
        });
      }
    }
  }

  const depreciationResult = calculateDepreciationSchedule({
    projectId,
    projectionPeriodYears,
    assets: depreciableAssets,
  });
  if (!depreciationResult.ok) {
    for (const err of depreciationResult.errors) {
      issues.push({
        code: err.code,
        message: err.message,
        severity: "ERROR",
        section: "Depreciation",
        path: err.path,
      });
    }
  }
  const depreciation = depreciationResult.ok
    ? depreciationResult.value
    : undefined;

  // ─── 6. Loan Repayment Schedule ────────────────────────────────────────────
  const frequencyToPeriodsPerYear = {
    MONTHLY: 12,
    QUARTERLY: 4,
    HALF_YEARLY: 2,
    YEARLY: 1,
  };
  const totalRepaymentPeriods =
    input.loan.repaymentTenureYears *
    (frequencyToPeriodsPerYear[input.loan.repaymentFrequency] || 12);

  const loanTerms: LoanTerms = {
    id: input.loan.id,
    type: (input.loan.loanType === "WORKING_CAPITAL_DEMAND_LOAN"
      ? "WORKING_CAPITAL"
      : input.loan.loanType === "COMPOSITE_LOAN"
        ? "OTHER"
        : "TERM_LOAN") as LoanType,
    principal: assumption(
      toMonetary(input.loan.principalAmount),
      defaultSource,
    ),
    annualInterestRate: assumption(
      toPercent(input.loan.annualInterestRate),
      defaultSource,
    ),
    repaymentPeriods: totalRepaymentPeriods,
    repaymentFrequency: input.loan.repaymentFrequency,
    repaymentMethod: input.loan.repaymentMethod || "EQUAL_PRINCIPAL",
    moratorium:
      input.loan.moratoriumPeriods && input.loan.moratoriumPeriods > 0
        ? {
            periods: input.loan.moratoriumPeriods,
            type: input.loan.moratoriumType ?? "PRINCIPAL_ONLY",
            interestTreatment:
              (input.loan.moratoriumType ?? "PRINCIPAL_ONLY") ===
              "PRINCIPAL_ONLY"
                ? "PAY_CURRENT"
                : input.loan.moratoriumInterestTreatment === "ACCRUE"
                  ? "ACCRUE"
                  : "CAPITALIZE",
          }
        : undefined,
  };

  const loanResult = generateLoanRepaymentSchedule(loanTerms);
  if (!loanResult.ok) {
    for (const err of loanResult.errors) {
      issues.push({
        code: err.code,
        message: err.message,
        severity: "ERROR",
        section: "Loan",
        path: err.path,
      });
    }
  }
  const loanSchedule = loanResult.ok ? loanResult.value : undefined;

  // ─── 7. Profit & Loss Schedule ─────────────────────────────────────────────
  let profitAndLoss: ProfitAndLossSchedule | undefined;
  if (projection && depreciation && loanSchedule) {
    const pnlInterestSchedules = {
      projectId,
      years: loanSchedule.annualSummaries.map((yr) => ({
        year: yr.projectionYear,
        interestExpense: yr.interestCharged,
      })),
    };

    const taxConfig: ProfitAndLossTaxConfiguration =
      input.taxAndReturns.taxMode === "NO_TAX"
        ? { mode: "NO_TAX" }
        : {
            mode: "PERCENTAGE_OF_POSITIVE_PBT",
            taxRate: assumption(
              toPercent(input.taxAndReturns.taxRate),
              defaultSource,
            ),
          };

    const pnlResult = calculateProfitAndLossFromAuthoritativeSchedules(
      projection,
      depreciation,
      pnlInterestSchedules,
      taxConfig,
      {
        missingDepreciation: "USE_EXPLICIT_ZERO",
        missingInterestExpense: "USE_EXPLICIT_ZERO",
      },
    );

    if (pnlResult.ok) {
      profitAndLoss = pnlResult.value;
    } else {
      for (const err of pnlResult.errors) {
        issues.push({
          code: err.code,
          message: err.message,
          severity: "ERROR",
          section: "Profit & Loss",
          path: err.path,
        });
      }
    }
  }

  // ─── 8. Cash Flow Schedule ─────────────────────────────────────────────────
  let cashFlow: CashFlowSchedule | undefined;
  if (
    profitAndLoss &&
    workingCapitalSummaries.length > 0 &&
    depreciation &&
    loanSchedule
  ) {
    const wcChangeResult = adaptWorkingCapitalRequirementsToChanges(
      projectId,
      assumption(monetaryAmount("0.00"), defaultSource),
      workingCapitalSummaries,
    );
    const capexResult =
      adaptDepreciationAdditionsAsCashCapitalExpenditure(depreciation);
    const loanPaymentResult = adaptLoanAnnualPaymentsToCashFlow(
      projectId,
      loanSchedule,
    );

    const initialPromoter = input.financingSources
      .filter(
        (s) =>
          s.type === "PROMOTER_CONTRIBUTION" ||
          s.type === "EQUITY" ||
          s.type === "OTHER_CONTRIBUTION",
      )
      .reduce(
        (sum, s) => sum.plus(toDecimal(toMonetary(s.amount))),
        toDecimal(monetaryAmount("0.00")),
      );
    const initialLoan = input.financingSources
      .filter((s) => s.type === "TERM_LOAN")
      .reduce(
        (sum, s) => sum.plus(toDecimal(toMonetary(s.amount))),
        toDecimal(monetaryAmount("0.00")),
      );

    const financingInflowsSchedule = {
      projectId,
      years: Array.from({ length: projectionPeriodYears }, (_, i) => ({
        year: i + 1,
        promoterContribution:
          i === 0 ? toMonetaryAmount(initialPromoter) : monetaryAmount("0.00"),
        loanDisbursement:
          i === 0 ? toMonetaryAmount(initialLoan) : monetaryAmount("0.00"),
      })),
    };

    if (wcChangeResult.ok && capexResult.ok && loanPaymentResult.ok) {
      const cfResult = calculateCashFlowFromAuthoritativeSchedules(
        {
          profitAndLoss,
          workingCapitalChanges: wcChangeResult.value,
          capitalExpenditure: capexResult.value,
          financingInflows: financingInflowsSchedule,
          loanCashPayments: loanPaymentResult.value,
        },
        assumption(
          toMonetary(input.taxAndReturns.initialOpeningCash),
          defaultSource,
        ),
        {
          missingWorkingCapitalChange: "USE_EXPLICIT_ZERO",
          missingCapitalExpenditure: "USE_EXPLICIT_ZERO",
          missingFinancingInflows: "USE_EXPLICIT_ZERO",
          missingLoanCashPayments: "USE_EXPLICIT_ZERO",
        },
      );

      if (cfResult.ok) {
        cashFlow = cfResult.value;
        for (const yr of cashFlow.years) {
          if (toDecimal(yr.closingCash).isNegative()) {
            issues.push({
              code: "NEGATIVE_CLOSING_CASH",
              message: `Year ${yr.year} closing cash is negative (${yr.closingCash}). Review working capital margin or financing assumptions.`,
              severity: "WARNING",
              section: "Cash Flow",
            });
          }
        }
      } else {
        for (const err of cfResult.errors) {
          issues.push({
            code: err.code,
            message: err.message,
            severity: "ERROR",
            section: "Cash Flow",
            path: err.path,
          });
        }
      }
    }
  }

  // ─── 9. Balance Sheet Schedule ─────────────────────────────────────────────
  let balanceSheet: BalanceSheetSchedule | undefined;
  if (
    profitAndLoss &&
    depreciation &&
    cashFlow &&
    loanSchedule &&
    workingCapitalSummaries.length > 0
  ) {
    const fixedAssetRes =
      adaptDepreciationScheduleToBalanceSheetFixedAssets(depreciation);
    const loanOutstandingRes = adaptLoanScheduleToBalanceSheetOutstanding(
      projectId,
      loanSchedule,
    );

    const initialPromoter = input.financingSources
      .filter(
        (s) =>
          s.type === "PROMOTER_CONTRIBUTION" ||
          s.type === "EQUITY" ||
          s.type === "OTHER_CONTRIBUTION",
      )
      .reduce(
        (sum, s) => sum.plus(toDecimal(toMonetary(s.amount))),
        toDecimal(monetaryAmount("0.00")),
      );

    const promoterScheduleRes = adaptFinancingInflowsToPromoterCapital(
      assumption(toMonetaryAmount(initialPromoter), defaultSource),
      {
        projectId,
        years: Array.from({ length: projectionPeriodYears }, (_, i) => ({
          year: i + 1,
          promoterContribution: monetaryAmount("0.00"),
          loanDisbursement: monetaryAmount("0.00"),
        })),
      },
    );

    const debtClassificationSchedule = {
      projectId,
      years: loanSchedule.annualSummaries.map((yr, idx) => {
        const nextYear = loanSchedule.annualSummaries[idx + 1];
        const nextYearPrincipal = nextYear
          ? nextYear.principalRepaid
          : monetaryAmount("0.00");
        const totalOutstanding = yr.closingPrincipal;
        const currentDebt = toDecimal(totalOutstanding).greaterThan(
          toDecimal(nextYearPrincipal),
        )
          ? nextYearPrincipal
          : totalOutstanding;
        const longTerm = toMonetaryAmount(
          toDecimal(totalOutstanding).minus(toDecimal(currentDebt)),
        );

        return {
          year: yr.projectionYear,
          longTermLoanOutstanding: assumption(longTerm, defaultSource),
          currentDebt: assumption(currentDebt, defaultSource),
        };
      }),
    };

    const accountingBalancesSchedule = {
      projectId,
      years: Array.from({ length: projectionPeriodYears }, (_, i) => {
        const yr = i + 1;
        const wcSum = workingCapitalSummaries.find(
          (s) => s.projectionYear === yr,
        );
        let inv = monetaryAmount("0.00");
        let rec = monetaryAmount("0.00");
        let otherCA = monetaryAmount("0.00");
        let pay = monetaryAmount("0.00");
        let otherCL = monetaryAmount("0.00");

        if (wcSum) {
          for (const line of wcSum.lines) {
            if (
              line.input.category === "RAW_MATERIAL_INVENTORY" ||
              line.input.category === "FINISHED_GOODS"
            ) {
              inv = toMonetaryAmount(
                toDecimal(inv).plus(toDecimal(line.amount)),
              );
            } else if (line.input.category === "RECEIVABLES") {
              rec = toMonetaryAmount(
                toDecimal(rec).plus(toDecimal(line.amount)),
              );
            } else if (line.input.side === "CURRENT_ASSET") {
              otherCA = toMonetaryAmount(
                toDecimal(otherCA).plus(toDecimal(line.amount)),
              );
            } else if (line.input.category === "SUPPLIER_CREDIT") {
              pay = toMonetaryAmount(
                toDecimal(pay).plus(toDecimal(line.amount)),
              );
            } else if (line.input.side === "CURRENT_LIABILITY") {
              otherCL = toMonetaryAmount(
                toDecimal(otherCL).plus(toDecimal(line.amount)),
              );
            }
          }
        }

        return {
          year: yr,
          inventory: assumption(inv, defaultSource),
          receivables: assumption(rec, defaultSource),
          otherCurrentAssets: assumption(otherCA, defaultSource),
          payables: assumption(pay, defaultSource),
          otherCurrentLiabilities: assumption(otherCL, defaultSource),
          retainedEarningsAdjustments: assumption(
            monetaryAmount("0.00"),
            defaultSource,
          ),
          otherEquity: assumption(monetaryAmount("0.00"), defaultSource),
        };
      }),
    };

    const cashSchedule = {
      projectId,
      years: cashFlow.years.map(
        (y: { year: number; closingCash: MonetaryAmount }) => ({
          year: y.year,
          cashAndBank: toDecimal(y.closingCash).isNegative()
            ? monetaryAmount("0.00")
            : y.closingCash,
        }),
      ),
    };

    if (fixedAssetRes.ok && loanOutstandingRes.ok && promoterScheduleRes.ok) {
      const bsResult = calculateBalanceSheetFromAuthoritativeSchedules(
        {
          profitAndLoss,
          fixedAssets: fixedAssetRes.value,
          cash: cashSchedule,
          loanOutstanding: loanOutstandingRes.value,
          debtClassification: debtClassificationSchedule,
          promoterCapital: promoterScheduleRes.value,
          accountingBalances: accountingBalancesSchedule,
        },
        assumption(monetaryAmount("0.00"), defaultSource),
        {
          missingFixedAssets: "USE_EXPLICIT_ZERO",
          missingCash: "USE_EXPLICIT_ZERO",
          missingLoanOutstanding: "USE_EXPLICIT_ZERO",
          missingDebtClassification: "USE_EXPLICIT_ZERO",
          missingPromoterCapital: "USE_EXPLICIT_ZERO",
          missingAccountingBalances: "USE_EXPLICIT_ZERO",
        },
      );

      if (bsResult.ok) {
        balanceSheet = bsResult.value;
        for (const yr of balanceSheet.years) {
          if (!yr.isBalanced) {
            issues.push({
              code: "BALANCE_SHEET_UNBALANCED",
              message: `Year ${yr.year} Balance Sheet difference is ${yr.balanceDifference}.`,
              severity: "INFO",
              section: "Balance Sheet",
            });
          }
        }
      } else {
        for (const err of bsResult.errors) {
          issues.push({
            code: err.code,
            message: err.message,
            severity: "ERROR",
            section: "Balance Sheet",
            path: err.path,
          });
        }
      }
    }
  }

  // ─── 10. Bankability Metrics ───────────────────────────────────────────────
  let bankabilityMetrics: BankabilityMetricsSchedule | undefined;
  if (
    profitAndLoss &&
    loanSchedule &&
    balanceSheet &&
    projectCostSummary &&
    projection
  ) {
    const pnlMetricsRes = adaptProfitAndLossToMetrics(profitAndLoss);
    const loanMetricsRes = adaptLoanScheduleToMetricsDebtService(
      projectId,
      loanSchedule,
    );
    const bsMetricsRes = adaptBalanceSheetToMetrics(balanceSheet);
    const pcMetricsRes = adaptProjectCostToMetrics(projectCostSummary);

    const costClassifications: ProjectionCostClassification = {
      projectId,
      expenses: input.operatingExpenses.map((exp) => ({
        expenseId: exp.id,
        classification: assumption(
          exp.costBehavior === "FIXED"
            ? ("FIXED" as const)
            : ("VARIABLE" as const),
          defaultSource,
        ),
      })),
    };

    const breakEvenRes = adaptProjectionToBreakEvenInputs(
      projection,
      costClassifications,
    );

    if (
      pnlMetricsRes.ok &&
      loanMetricsRes.ok &&
      bsMetricsRes.ok &&
      pcMetricsRes.ok &&
      breakEvenRes.ok
    ) {
      const metricsRes = calculateBankabilityMetricsFromAuthoritativeSchedules({
        profitAndLoss: pnlMetricsRes.value,
        debtService: loanMetricsRes.value,
        balanceSheet: bsMetricsRes.value,
        projectCost: pcMetricsRes.value,
        breakEven: breakEvenRes.value,
      });

      if (metricsRes.ok) {
        bankabilityMetrics = metricsRes.value;
      } else {
        for (const err of metricsRes.errors) {
          issues.push({
            code: err.code,
            message: err.message,
            severity: "ERROR",
            section: "Metrics",
            path: err.path,
          });
        }
      }
    }
  }

  // ─── 11. Investment Returns (NPV / IRR / Payback) ───────────────────────────
  let investmentReturns: InvestmentReturnsAnalysis | undefined;
  if (projectCostSummary && projection && workingCapitalSummaries.length > 0) {
    const returnPeriods: ProjectInvestmentCashFlowPeriodInput[] = [];

    returnPeriods.push({
      periodIndex: 0,
      components: {
        initialInvestment: assumption(
          projectCostSummary.totalProjectCost,
          defaultSource,
        ),
        operatingProjectCashFlow: assumption(
          monetaryAmount("0.00"),
          defaultSource,
        ),
        workingCapitalInvestment: assumption(
          monetaryAmount("0.00"),
          defaultSource,
        ),
        capitalExpenditure: assumption(monetaryAmount("0.00"), defaultSource),
        otherExplicitInvestmentCashFlow: assumption(
          monetaryAmount("0.00"),
          defaultSource,
        ),
      },
    });

    for (let yr = 1; yr <= projectionPeriodYears; yr++) {
      const pnlYr = profitAndLoss?.years.find(
        (y: { year: number }) => y.year === yr,
      );
      const ebitda = pnlYr ? pnlYr.ebitda : monetaryAmount("0.00");
      const capex = monetaryAmount("0.00");
      const wcSum = workingCapitalSummaries.find(
        (s) => s.projectionYear === yr,
      );
      const prevWcSum = workingCapitalSummaries.find(
        (s) => s.projectionYear === yr - 1,
      );
      const wcGap = wcSum
        ? toDecimal(wcSum.workingCapitalGap)
        : toDecimal(monetaryAmount("0.00"));
      const prevWcGap = prevWcSum
        ? toDecimal(prevWcSum.workingCapitalGap)
        : toDecimal(monetaryAmount("0.00"));
      const incrementalWc = toMonetaryAmount(wcGap.minus(prevWcGap));

      returnPeriods.push({
        periodIndex: yr,
        components: {
          initialInvestment: assumption(monetaryAmount("0.00"), defaultSource),
          operatingProjectCashFlow: assumption(ebitda, defaultSource),
          workingCapitalInvestment: assumption(
            toDecimal(incrementalWc).isNegative()
              ? monetaryAmount("0.00")
              : incrementalWc,
            defaultSource,
          ),
          capitalExpenditure: assumption(capex, defaultSource),
          otherExplicitInvestmentCashFlow: assumption(
            monetaryAmount("0.00"),
            defaultSource,
          ),
          workingCapitalRecovery:
            yr === projectionPeriodYears && wcSum
              ? assumption(wcSum.workingCapitalGap, defaultSource)
              : undefined,
        },
      });
    }

    const seriesRes = composeProjectInvestmentCashFlowSeries({
      projectId,
      periods: returnPeriods,
    });

    if (seriesRes.ok) {
      const returnsRes = calculateInvestmentReturns({
        series: seriesRes.value,
        discountRate: assumption(
          toPercent(input.taxAndReturns.discountRate || "12.00"),
          defaultSource,
        ),
      });

      if (returnsRes.ok) {
        investmentReturns = returnsRes.value;
      }
    }
  }

  // ─── 12. Scheme / Funding Composer ─────────────────────────────────────────
  let fundingComposer: MultiProgramFundingResult | undefined;
  if (
    input.selectedPrograms &&
    input.selectedPrograms.length > 0 &&
    projectCostSummary
  ) {
    const costInput = adaptProjectCostSummary(projectCostSummary);
    const financeRes = adaptMeansOfFinanceSummary(meansOfFinanceSummary);

    if (financeRes.ok) {
      const composerInput: FundingComposerInput = {
        projectId,
        evaluationAsOfDate: asOfDate,
        projectCost: costInput,
        financing: financeRes.value,
        selectedPrograms: input.selectedPrograms,
        facts: input.schemeFacts ?? {},
      };

      const liveRegistry = createLiveProgramRegistry();
      const liveHandlers = createPmegpRuleHandlers();
      const convergenceRules = [pmfmeAifConvergenceRule];

      const composerRes = composeMultiProgramFunding(
        composerInput,
        liveRegistry,
        convergenceRules,
        liveHandlers,
      );
      if (composerRes.ok) {
        fundingComposer = composerRes.value;
        for (const conflict of fundingComposer.conflicts) {
          issues.push({
            code: conflict.code,
            message: `Funding Conflict: ${conflict.messageCode || conflict.code}`,
            severity: "ERROR",
            section: "Schemes & Funding",
          });
        }
        for (const warning of fundingComposer.warnings) {
          issues.push({
            code: warning.code,
            message: `Funding Warning: ${warning.code}`,
            severity: "WARNING",
            section: "Schemes & Funding",
          });
        }
        for (const review of fundingComposer.manualReviewItems) {
          issues.push({
            code: review.code,
            message: `Manual Review Required: ${review.code}`,
            severity: "MANUAL_REVIEW",
            section: "Schemes & Funding",
          });
        }
      } else {
        for (const err of composerRes.errors) {
          issues.push({
            code: err.code,
            message: err.message,
            severity: "ERROR",
            section: "Schemes & Funding",
            path: err.path,
          });
        }
      }
    }
  }

  const hasFatalErrors = issues.some((issue) => issue.severity === "ERROR");

  return {
    projectId,
    success: !hasFatalErrors,
    projectCost: projectCostSummary,
    meansOfFinance: meansOfFinanceSummary,
    financingReconciliation: reconciliation,
    projection,
    workingCapitalSummaries,
    depreciation,
    loanSchedule,
    profitAndLoss,
    cashFlow,
    balanceSheet,
    bankabilityMetrics,
    investmentReturns,
    fundingComposer,
    issues,
    calculatedAt: asOfDate,
  };
}
