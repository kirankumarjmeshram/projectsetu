import type { BalanceSheetSchedule } from "../balance-sheet/balance-sheet";
import type { LoanRepaymentSchedule } from "../loan/loan";
import type { ProfitAndLossSchedule } from "../profit-and-loss/profit-and-loss";
import type { ProjectCostSummary } from "../project-cost/calculations";
import type { RevenueAndOperatingExpenseProjection } from "../projection/projection";
import type {
  CalculationError,
  CalculationResult,
} from "../shared/calculation";
import { calculationFailure, calculationSuccess } from "../shared/calculation";
import { monetaryAmount, toDecimal, toMonetaryAmount } from "../shared/decimal";
import type { Identifier, ProjectionYear } from "../shared/types";
import {
  calculateBankabilityMetricsSchedule,
  validateBankabilityMetricsYearInputs,
} from "./calculations";
import type {
  BankabilityMetricsAuthoritativeSchedules,
  BankabilityMetricsSchedule,
  BankabilityMetricsYearInput,
  MetricsBalanceSheetSchedule,
  MetricsBreakEvenSchedule,
  MetricsDebtServiceSchedule,
  MetricsProfitAndLossSchedule,
  MetricsProjectCost,
  OperatingCostClassification,
  ProjectionCostClassification,
} from "./metrics";

const zeroAmount = monetaryAmount("0");

function validateYearCollection(
  rows: readonly { readonly year: ProjectionYear }[],
  path: string,
  label: string,
): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  const seen = new Set<number>();
  for (const [index, row] of rows.entries()) {
    const yearPath = path + "." + index + ".year";
    if (!Number.isInteger(row.year) || row.year <= 0) {
      errors.push({
        code: "INVALID_" + label + "_YEAR",
        message: "Source year must be a positive integer.",
        path: yearPath,
      });
    }
    if (seen.has(row.year)) {
      errors.push({
        code: "DUPLICATE_" + label + "_YEAR",
        message: "Each source year must be unique.",
        path: yearPath,
      });
    } else {
      seen.add(row.year);
    }
  }
  return errors;
}

function validateSequentialYears(
  rows: readonly { readonly year: ProjectionYear }[],
  path: string,
): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  for (const [index, row] of rows.entries()) {
    if (row.year !== index + 1) {
      errors.push({
        code: "INVALID_METRICS_SOURCE_YEAR_SEQUENCE",
        message: "Metrics source years must be sequential and start at year 1.",
        path: path + "." + index + ".year",
      });
    }
  }
  return errors;
}

function validateNonNegative(
  value: string,
  path: string,
  code: string,
  label: string,
): CalculationError | undefined {
  if (typeof value !== "string") {
    return {
      code: "MISSING_METRIC_SOURCE_VALUE",
      message: label + " is required.",
      path,
    };
  }
  if (toDecimal(monetaryAmount(value)).isNegative()) {
    return { code, message: label + " must not be negative.", path };
  }
}

export function adaptProfitAndLossToMetrics(
  schedule: ProfitAndLossSchedule,
): CalculationResult<MetricsProfitAndLossSchedule> {
  const errors = [
    ...validateYearCollection(
      schedule.years,
      "profitAndLoss.years",
      "METRICS_PROFIT_AND_LOSS_SOURCE",
    ),
    ...validateSequentialYears(schedule.years, "profitAndLoss.years"),
  ];
  if (schedule.years.length === 0) {
    errors.push({
      code: "EMPTY_METRICS_PROFIT_AND_LOSS_SOURCE",
      message: "P&L source must contain at least one projection year.",
      path: "profitAndLoss.years",
    });
  }
  if (errors.length > 0) return calculationFailure(...errors);

  return calculationSuccess({
    projectId: schedule.projectId,
    years: schedule.years.map((year) => ({
      year: year.year,
      revenue: year.revenue,
      ebitda: year.ebitda,
      ebit: year.ebit,
      profitBeforeTax: year.profitBeforeTax,
      profitAfterTax: year.profitAfterTax,
      depreciation: year.depreciation,
      interestExpense: year.interestExpense,
    })),
  });
}

export function adaptLoanScheduleToMetricsDebtService(
  projectId: Identifier,
  schedule: LoanRepaymentSchedule,
): CalculationResult<MetricsDebtServiceSchedule> {
  const rows = schedule.annualSummaries.map((year) => ({
    year: year.projectionYear,
    principalRepayment: year.principalRepaid,
  }));
  const errors = [
    ...validateYearCollection(
      rows,
      "loan.annualSummaries",
      "METRICS_LOAN_SOURCE",
    ),
  ];
  for (const [index, row] of rows.entries()) {
    const error = validateNonNegative(
      row.principalRepayment,
      "loan.annualSummaries." + index + ".principalRepaid",
      "NEGATIVE_DSCR_PRINCIPAL_REPAYMENT",
      "Principal repayment",
    );
    if (error) errors.push(error);
  }
  if (errors.length > 0) return calculationFailure(...errors);

  return calculationSuccess({ projectId, years: rows });
}

export function adaptBalanceSheetToMetrics(
  schedule: BalanceSheetSchedule,
): CalculationResult<MetricsBalanceSheetSchedule> {
  const errors = [
    ...validateYearCollection(
      schedule.years,
      "balanceSheet.years",
      "METRICS_BALANCE_SHEET_SOURCE",
    ),
  ];

  for (const [index, year] of schedule.years.entries()) {
    const expectedCurrentLiabilities = toMonetaryAmount(
      toDecimal(year.currentDebt)
        .plus(toDecimal(year.payables))
        .plus(toDecimal(year.otherCurrentLiabilities)),
    );
    if (expectedCurrentLiabilities !== year.totalCurrentLiabilities) {
      errors.push({
        code: "INCONSISTENT_BALANCE_SHEET_CURRENT_LIABILITIES",
        message:
          "Authoritative total current liabilities must reconcile to classified current balances.",
        path: "balanceSheet.years." + index + ".totalCurrentLiabilities",
      });
    }
  }
  if (errors.length > 0) return calculationFailure(...errors);

  return calculationSuccess({
    projectId: schedule.projectId,
    years: schedule.years.map((year) => ({
      year: year.year,
      totalCurrentAssets: year.totalCurrentAssets,
      totalCurrentLiabilities: year.totalCurrentLiabilities,
      totalAssets: year.totalAssets,
      totalEquity: year.totalEquity,
      longTermDebt: year.longTermLoanOutstanding,
      currentDebt: year.currentDebt,
    })),
  });
}

export function adaptProjectCostToMetrics(
  summary: ProjectCostSummary,
): CalculationResult<MetricsProjectCost> {
  const error = validateNonNegative(
    summary.totalProjectCost,
    "projectCost.totalProjectCost",
    "NEGATIVE_TOTAL_PROJECT_COST",
    "Total project cost",
  );
  return error
    ? calculationFailure(error)
    : calculationSuccess({
        projectId: summary.projectId,
        totalProjectCost: summary.totalProjectCost,
      });
}

function classificationForExpense(
  classifications: ProjectionCostClassification,
  expenseId: Identifier,
): OperatingCostClassification | undefined {
  return classifications.expenses.find((item) => item.expenseId === expenseId)
    ?.classification.value;
}

export function adaptProjectionToBreakEvenInputs(
  projection: RevenueAndOperatingExpenseProjection,
  classifications: ProjectionCostClassification,
): CalculationResult<MetricsBreakEvenSchedule> {
  const errors: CalculationError[] = [];
  if (projection.projectId !== classifications.projectId) {
    errors.push({
      code: "METRICS_PROJECT_ID_MISMATCH",
      message: "Projection and cost classification must belong to one project.",
      path: "projectId",
    });
  }
  errors.push(
    ...validateYearCollection(
      projection.years,
      "projection.years",
      "METRICS_PROJECTION_SOURCE",
    ),
    ...validateSequentialYears(projection.years, "projection.years"),
  );

  const seenClassificationIds = new Set<Identifier>();
  for (const [index, item] of classifications.expenses.entries()) {
    const path = "classifications.expenses." + index;
    if (seenClassificationIds.has(item.expenseId)) {
      errors.push({
        code: "DUPLICATE_EXPENSE_COST_CLASSIFICATION",
        message: "Each expense id must have exactly one cost classification.",
        path: path + ".expenseId",
      });
    } else {
      seenClassificationIds.add(item.expenseId);
    }
    if (!item.classification?.source) {
      errors.push({
        code: "MISSING_EXPENSE_COST_CLASSIFICATION_SOURCE",
        message: "Every fixed/variable classification must be source-backed.",
        path: path + ".classification",
      });
    }
    if (
      item.classification?.value !== "FIXED" &&
      item.classification?.value !== "VARIABLE"
    ) {
      errors.push({
        code: "INVALID_EXPENSE_COST_CLASSIFICATION",
        message: "Expense classification must be FIXED or VARIABLE.",
        path: path + ".classification.value",
      });
    }
  }

  const projectionExpenseIds = new Set<Identifier>();
  for (const [yearIndex, year] of projection.years.entries()) {
    const seenYearIds = new Set<Identifier>();
    for (const [lineIndex, line] of year.lines.entries()) {
      const expenseId = line.input.id;
      projectionExpenseIds.add(expenseId);
      if (seenYearIds.has(expenseId)) {
        errors.push({
          code: "DUPLICATE_PROJECTION_EXPENSE_ID",
          message: "Expense ids must be unique within each projection year.",
          path:
            "projection.years." +
            yearIndex +
            ".lines." +
            lineIndex +
            ".input.id",
        });
      } else {
        seenYearIds.add(expenseId);
      }
      if (!seenClassificationIds.has(expenseId)) {
        errors.push({
          code: "MISSING_EXPENSE_COST_CLASSIFICATION",
          message:
            "Every projection expense requires an explicit fixed/variable classification.",
          path:
            "projection.years." +
            yearIndex +
            ".lines." +
            lineIndex +
            ".input.id",
        });
      }
    }
  }
  for (const [index, item] of classifications.expenses.entries()) {
    if (!projectionExpenseIds.has(item.expenseId)) {
      errors.push({
        code: "EXTRA_EXPENSE_COST_CLASSIFICATION",
        message: "Cost classification references no projection expense.",
        path: "classifications.expenses." + index + ".expenseId",
      });
    }
  }

  if (errors.length > 0) return calculationFailure(...errors);

  const years = projection.years.map((year) => {
    let fixedCosts = toDecimal(zeroAmount);
    let variableCosts = toDecimal(zeroAmount);
    for (const line of year.lines) {
      if (
        classificationForExpense(classifications, line.input.id) === "FIXED"
      ) {
        fixedCosts = fixedCosts.plus(toDecimal(line.amount));
      } else {
        variableCosts = variableCosts.plus(toDecimal(line.amount));
      }
    }
    return {
      year: year.year,
      revenue: year.totalRevenue,
      variableCosts: toMonetaryAmount(variableCosts),
      fixedCosts: toMonetaryAmount(fixedCosts),
    };
  });

  return calculationSuccess({ projectId: projection.projectId, years });
}

function sourceProjectIds(
  schedules: BankabilityMetricsAuthoritativeSchedules,
): readonly Identifier[] {
  return [
    schedules.profitAndLoss.projectId,
    schedules.debtService.projectId,
    schedules.balanceSheet.projectId,
    schedules.projectCost.projectId,
    schedules.breakEven.projectId,
  ];
}

function validateExtraYears(
  rows: readonly { readonly year: ProjectionYear }[],
  validYears: ReadonlySet<number>,
  path: string,
  code: string,
): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  for (const [index, row] of rows.entries()) {
    if (!validYears.has(row.year)) {
      errors.push({
        code,
        message: "Source contains a year outside the P&L timeline.",
        path: path + "." + index + ".year",
      });
    }
  }
  return errors;
}

export function composeBankabilityMetricsYearInputs(
  schedules: BankabilityMetricsAuthoritativeSchedules,
): CalculationResult<readonly BankabilityMetricsYearInput[]> {
  const errors: CalculationError[] = [];
  const projectIds = sourceProjectIds(schedules);
  if (projectIds.some((projectId) => projectId !== projectIds[0])) {
    errors.push({
      code: "METRICS_PROJECT_ID_MISMATCH",
      message: "All metrics source schedules must belong to one project.",
      path: "projectId",
    });
  }

  const sources = [
    {
      rows: schedules.profitAndLoss.years,
      path: "profitAndLoss.years",
      label: "METRICS_PROFIT_AND_LOSS_SOURCE",
    },
    {
      rows: schedules.debtService.years,
      path: "debtService.years",
      label: "METRICS_DEBT_SERVICE_SOURCE",
    },
    {
      rows: schedules.balanceSheet.years,
      path: "balanceSheet.years",
      label: "METRICS_BALANCE_SHEET_SOURCE",
    },
    {
      rows: schedules.breakEven.years,
      path: "breakEven.years",
      label: "METRICS_BREAK_EVEN_SOURCE",
    },
  ] as const;
  for (const source of sources) {
    errors.push(
      ...validateYearCollection(source.rows, source.path, source.label),
      ...validateSequentialYears(source.rows, source.path),
    );
  }

  if (schedules.profitAndLoss.years.length === 0) {
    errors.push({
      code: "EMPTY_METRICS_PROFIT_AND_LOSS_SOURCE",
      message: "P&L source must contain at least one projection year.",
      path: "profitAndLoss.years",
    });
  }
  const validYears = new Set(
    schedules.profitAndLoss.years.map((year) => year.year),
  );
  for (const source of sources.slice(1)) {
    errors.push(
      ...validateExtraYears(
        source.rows,
        validYears,
        source.path,
        source.label + "_YEAR_NOT_IN_PROJECTION",
      ),
    );
  }

  const composedYears: BankabilityMetricsYearInput[] = [];
  for (const [index, profitYear] of schedules.profitAndLoss.years.entries()) {
    const debtService = schedules.debtService.years.find(
      (year) => year.year === profitYear.year,
    );
    const balanceSheet = schedules.balanceSheet.years.find(
      (year) => year.year === profitYear.year,
    );
    const breakEven = schedules.breakEven.years.find(
      (year) => year.year === profitYear.year,
    );
    const yearPath = "profitAndLoss.years." + index + ".year";
    if (!debtService) {
      errors.push({
        code: "MISSING_DEBT_SERVICE_FOR_METRICS_YEAR",
        message:
          "Each metrics year requires authoritative principal repayment.",
        path: yearPath,
      });
    }
    if (!balanceSheet) {
      errors.push({
        code: "MISSING_BALANCE_SHEET_FOR_METRICS_YEAR",
        message:
          "Each metrics year requires authoritative balance-sheet values.",
        path: yearPath,
      });
    }
    if (!breakEven) {
      errors.push({
        code: "MISSING_BREAK_EVEN_COSTS_FOR_METRICS_YEAR",
        message:
          "Each metrics year requires explicitly classified fixed and variable costs.",
        path: yearPath,
      });
    }
    if (breakEven && breakEven.revenue !== profitYear.revenue) {
      errors.push({
        code: "BREAK_EVEN_REVENUE_DOES_NOT_MATCH_PROFIT_AND_LOSS",
        message: "Break-even and P&L revenue must use the same yearly basis.",
        path: "breakEven.years." + index + ".revenue",
      });
    }

    composedYears.push({
      year: profitYear.year,
      revenue: profitYear.revenue,
      variableCosts: breakEven?.variableCosts ?? zeroAmount,
      fixedCosts: breakEven?.fixedCosts ?? zeroAmount,
      ebitda: profitYear.ebitda,
      ebit: profitYear.ebit,
      profitBeforeTax: profitYear.profitBeforeTax,
      profitAfterTax: profitYear.profitAfterTax,
      depreciation: profitYear.depreciation,
      interestExpense: profitYear.interestExpense,
      principalRepayment: debtService?.principalRepayment ?? zeroAmount,
      longTermDebt: balanceSheet?.longTermDebt ?? zeroAmount,
      currentDebt: balanceSheet?.currentDebt ?? zeroAmount,
      totalCurrentAssets: balanceSheet?.totalCurrentAssets ?? zeroAmount,
      totalCurrentLiabilities:
        balanceSheet?.totalCurrentLiabilities ?? zeroAmount,
      totalAssets: balanceSheet?.totalAssets ?? zeroAmount,
      totalEquity: balanceSheet?.totalEquity ?? zeroAmount,
      totalProjectCost: schedules.projectCost.totalProjectCost,
    });
  }

  errors.push(...validateBankabilityMetricsYearInputs(composedYears));

  if (errors.length > 0) return calculationFailure(...errors);
  return calculationSuccess(composedYears);
}

export function calculateBankabilityMetricsFromAuthoritativeSchedules(
  schedules: BankabilityMetricsAuthoritativeSchedules,
): CalculationResult<BankabilityMetricsSchedule> {
  const composed = composeBankabilityMetricsYearInputs(schedules);
  if (!composed.ok) return calculationFailure(...composed.errors);

  return calculateBankabilityMetricsSchedule({
    projectId: schedules.profitAndLoss.projectId,
    years: composed.value,
  });
}
