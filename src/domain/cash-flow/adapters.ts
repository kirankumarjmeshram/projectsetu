import type { DepreciationSchedule } from "../depreciation/depreciation";
import type { LoanRepaymentSchedule } from "../loan/loan";
import type { ProfitAndLossSchedule } from "../profit-and-loss/profit-and-loss";
import type { Assumption } from "../shared/assumptions";
import type {
  CalculationError,
  CalculationResult,
} from "../shared/calculation";
import { calculationFailure, calculationSuccess } from "../shared/calculation";
import { monetaryAmount, toDecimal, toMonetaryAmount } from "../shared/decimal";
import type {
  Identifier,
  MonetaryAmount,
  ProjectionYear,
} from "../shared/types";
import type { WorkingCapitalSummary } from "../working-capital/calculations";
import {
  calculateCashFlowSchedule,
  validateCashFlowYearInputs,
} from "./calculations";
import type {
  CashFlowCapitalExpenditureSchedule,
  CashFlowCompositionPolicy,
  CashFlowDerivedWorkingCapitalChangeSchedule,
  CashFlowFinancingInflowSchedule,
  CashFlowLoanPaymentSchedule,
  CashFlowProjectionInput,
  CashFlowSchedule,
  CashFlowWorkingCapitalChangeSchedule,
  CashFlowYearInput,
} from "./cash-flow";

const zeroAmount = monetaryAmount("0");
const strictCompositionPolicy: CashFlowCompositionPolicy = {
  missingWorkingCapitalChange: "ERROR",
  missingCapitalExpenditure: "ERROR",
  missingFinancingInflows: "ERROR",
  missingLoanCashPayments: "ERROR",
};

function validateYearCollection(
  rows: readonly { readonly year: ProjectionYear }[],
  path: string,
  label: string,
): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  const seenYears = new Set<number>();

  for (const [index, row] of rows.entries()) {
    if (!Number.isInteger(row.year) || row.year <= 0) {
      errors.push({
        code: "INVALID_" + label + "_YEAR",
        message: "Source year must be a positive integer.",
        path: path + "." + index + ".year",
      });
    }

    if (seenYears.has(row.year)) {
      errors.push({
        code: "DUPLICATE_" + label + "_YEAR",
        message: "Each source year must be unique.",
        path: path + "." + index + ".year",
      });
    } else {
      seenYears.add(row.year);
    }
  }

  return errors;
}

function validateSequentialYears(
  rows: readonly { readonly year: ProjectionYear }[],
  path: string,
  code: string,
): readonly CalculationError[] {
  const errors: CalculationError[] = [];

  for (const [index, row] of rows.entries()) {
    if (row.year !== index + 1) {
      errors.push({
        code,
        message: "Source years must be sequential and start at year 1.",
        path: path + "." + index + ".year",
      });
    }
  }

  return errors;
}

export function adaptWorkingCapitalRequirementsToChanges(
  projectId: Identifier,
  openingNetWorkingCapital: Assumption<MonetaryAmount>,
  summaries: readonly WorkingCapitalSummary[],
): CalculationResult<CashFlowDerivedWorkingCapitalChangeSchedule> {
  const errors: CalculationError[] = [
    ...validateYearCollection(
      summaries.map((summary) => ({ year: summary.projectionYear })),
      "summaries",
      "WORKING_CAPITAL_SOURCE",
    ),
    ...validateSequentialYears(
      summaries.map((summary) => ({ year: summary.projectionYear })),
      "summaries",
      "INVALID_WORKING_CAPITAL_SOURCE_YEAR_SEQUENCE",
    ),
  ];

  if (summaries.length === 0) {
    errors.push({
      code: "EMPTY_WORKING_CAPITAL_SOURCE",
      message: "Working-capital adapter requires at least one yearly summary.",
      path: "summaries",
    });
  }

  if (!openingNetWorkingCapital || !openingNetWorkingCapital.source) {
    errors.push({
      code: "MISSING_OPENING_NET_WORKING_CAPITAL",
      message:
        "Working-capital change derivation requires a source-backed opening NWC.",
      path: "openingNetWorkingCapital",
    });
  }

  for (const [index, summary] of summaries.entries()) {
    if (summary.projectId !== projectId) {
      errors.push({
        code: "WORKING_CAPITAL_PROJECT_ID_MISMATCH",
        message: "Working-capital summaries must belong to the target project.",
        path: "summaries." + index + ".projectId",
      });
    }
  }

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  const years = [];
  let priorRequirement = openingNetWorkingCapital.value;

  for (const summary of summaries) {
    const changeInNetWorkingCapital = toMonetaryAmount(
      toDecimal(summary.workingCapitalGap).minus(toDecimal(priorRequirement)),
    );
    years.push({
      year: summary.projectionYear,
      changeInNetWorkingCapital,
    });
    priorRequirement = summary.workingCapitalGap;
  }

  return calculationSuccess({ projectId, openingNetWorkingCapital, years });
}

/**
 * Treats only annual depreciation-schedule additions as cash capex. Original
 * startup assets and non-cash acquisitions must be normalized separately.
 */
export function adaptDepreciationAdditionsAsCashCapitalExpenditure(
  schedule: DepreciationSchedule,
): CalculationResult<CashFlowCapitalExpenditureSchedule> {
  const errors = [
    ...validateYearCollection(
      schedule.yearlySummaries,
      "schedule.yearlySummaries",
      "DEPRECIATION_ADDITION_SOURCE",
    ),
    ...validateSequentialYears(
      schedule.yearlySummaries,
      "schedule.yearlySummaries",
      "INVALID_DEPRECIATION_ADDITION_SOURCE_YEAR_SEQUENCE",
    ),
  ];

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  return calculationSuccess({
    projectId: schedule.projectId,
    years: schedule.yearlySummaries.map((year) => ({
      year: year.year,
      capitalExpenditure: year.additions,
    })),
  });
}

/** Maps only authoritative cash payments; charged/accrued/capitalized interest is ignored. */
export function adaptLoanAnnualPaymentsToCashFlow(
  projectId: Identifier,
  schedule: LoanRepaymentSchedule,
): CalculationResult<CashFlowLoanPaymentSchedule> {
  const sourceRows = schedule.annualSummaries.map((summary) => ({
    year: summary.projectionYear,
  }));
  const errors = [
    ...validateYearCollection(
      sourceRows,
      "schedule.annualSummaries",
      "LOAN_PAYMENT_SOURCE",
    ),
    ...validateSequentialYears(
      sourceRows,
      "schedule.annualSummaries",
      "INVALID_LOAN_PAYMENT_SOURCE_YEAR_SEQUENCE",
    ),
  ];

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  return calculationSuccess({
    projectId,
    years: schedule.annualSummaries.map((summary) => ({
      year: summary.projectionYear,
      principalRepayment: summary.principalRepaid,
      cashInterestPaid: summary.interestPaid,
    })),
  });
}

export interface CashFlowAuthoritativeSchedules {
  readonly profitAndLoss: ProfitAndLossSchedule;
  readonly workingCapitalChanges: CashFlowWorkingCapitalChangeSchedule;
  readonly capitalExpenditure: CashFlowCapitalExpenditureSchedule;
  readonly financingInflows: CashFlowFinancingInflowSchedule;
  readonly loanCashPayments: CashFlowLoanPaymentSchedule;
}

function sourceProjectIds(
  schedules: CashFlowAuthoritativeSchedules,
): readonly Identifier[] {
  return [
    schedules.profitAndLoss.projectId,
    schedules.workingCapitalChanges.projectId,
    schedules.capitalExpenditure.projectId,
    schedules.financingInflows.projectId,
    schedules.loanCashPayments.projectId,
  ];
}

function validateExtraYears(
  rows: readonly { readonly year: ProjectionYear }[],
  validYears: ReadonlySet<number>,
  path: string,
  code: string,
  label: string,
): readonly CalculationError[] {
  const errors: CalculationError[] = [];

  for (const [index, row] of rows.entries()) {
    if (!validYears.has(row.year)) {
      errors.push({
        code,
        message: label + " contains a year absent from the P&L timeline.",
        path: path + "." + index + ".year",
      });
    }
  }

  return errors;
}

export function composeCashFlowYearInputs(
  schedules: CashFlowAuthoritativeSchedules,
  policy: CashFlowCompositionPolicy = strictCompositionPolicy,
): CalculationResult<readonly CashFlowYearInput[]> {
  const errors: CalculationError[] = [];
  const projectIds = sourceProjectIds(schedules);

  if (projectIds.some((projectId) => projectId !== projectIds[0])) {
    errors.push({
      code: "CASH_FLOW_PROJECT_ID_MISMATCH",
      message: "All cash-flow source schedules must belong to one project.",
      path: "projectId",
    });
  }

  const sources = [
    {
      rows: schedules.profitAndLoss.years,
      path: "profitAndLoss.years",
      label: "PROFIT_AND_LOSS_SOURCE",
    },
    {
      rows: schedules.workingCapitalChanges.years,
      path: "workingCapitalChanges.years",
      label: "WORKING_CAPITAL_CHANGE_SOURCE",
    },
    {
      rows: schedules.capitalExpenditure.years,
      path: "capitalExpenditure.years",
      label: "CAPITAL_EXPENDITURE_SOURCE",
    },
    {
      rows: schedules.financingInflows.years,
      path: "financingInflows.years",
      label: "FINANCING_INFLOW_SOURCE",
    },
    {
      rows: schedules.loanCashPayments.years,
      path: "loanCashPayments.years",
      label: "LOAN_CASH_PAYMENT_SOURCE",
    },
  ] as const;

  for (const source of sources) {
    errors.push(
      ...validateYearCollection(source.rows, source.path, source.label),
    );
  }

  if (schedules.profitAndLoss.years.length === 0) {
    errors.push({
      code: "EMPTY_CASH_FLOW_PROFIT_AND_LOSS_SOURCE",
      message: "P&L source must contain at least one projection year.",
      path: "profitAndLoss.years",
    });
  }

  errors.push(
    ...validateSequentialYears(
      schedules.profitAndLoss.years,
      "profitAndLoss.years",
      "INVALID_CASH_FLOW_SOURCE_YEAR_SEQUENCE",
    ),
  );

  const validYears = new Set(
    schedules.profitAndLoss.years.map((year) => year.year),
  );
  errors.push(
    ...validateExtraYears(
      schedules.workingCapitalChanges.years,
      validYears,
      "workingCapitalChanges.years",
      "WORKING_CAPITAL_YEAR_NOT_IN_CASH_FLOW",
      "Working-capital changes",
    ),
    ...validateExtraYears(
      schedules.capitalExpenditure.years,
      validYears,
      "capitalExpenditure.years",
      "CAPITAL_EXPENDITURE_YEAR_NOT_IN_CASH_FLOW",
      "Capital expenditure",
    ),
    ...validateExtraYears(
      schedules.financingInflows.years,
      validYears,
      "financingInflows.years",
      "FINANCING_INFLOW_YEAR_NOT_IN_CASH_FLOW",
      "Financing inflows",
    ),
    ...validateExtraYears(
      schedules.loanCashPayments.years,
      validYears,
      "loanCashPayments.years",
      "LOAN_PAYMENT_YEAR_NOT_IN_CASH_FLOW",
      "Loan cash payments",
    ),
  );

  const composedYears: CashFlowYearInput[] = [];

  for (const [
    index,
    profitAndLossYear,
  ] of schedules.profitAndLoss.years.entries()) {
    const workingCapital = schedules.workingCapitalChanges.years.find(
      (year) => year.year === profitAndLossYear.year,
    );
    const capitalExpenditure = schedules.capitalExpenditure.years.find(
      (year) => year.year === profitAndLossYear.year,
    );
    const financingInflows = schedules.financingInflows.years.find(
      (year) => year.year === profitAndLossYear.year,
    );
    const loanCashPayments = schedules.loanCashPayments.years.find(
      (year) => year.year === profitAndLossYear.year,
    );
    const path = "profitAndLoss.years." + index + ".year";

    if (
      !workingCapital &&
      policy.missingWorkingCapitalChange !== "USE_EXPLICIT_ZERO"
    ) {
      errors.push({
        code: "MISSING_WORKING_CAPITAL_CHANGE_FOR_CASH_FLOW_YEAR",
        message: "Each cash-flow year requires a working-capital change.",
        path,
      });
    }

    if (
      !capitalExpenditure &&
      policy.missingCapitalExpenditure !== "USE_EXPLICIT_ZERO"
    ) {
      errors.push({
        code: "MISSING_CAPITAL_EXPENDITURE_FOR_CASH_FLOW_YEAR",
        message: "Each cash-flow year requires normalized capital expenditure.",
        path,
      });
    }

    if (
      !financingInflows &&
      policy.missingFinancingInflows !== "USE_EXPLICIT_ZERO"
    ) {
      errors.push({
        code: "MISSING_FINANCING_INFLOWS_FOR_CASH_FLOW_YEAR",
        message: "Each cash-flow year requires normalized financing inflows.",
        path,
      });
    }

    if (
      !loanCashPayments &&
      policy.missingLoanCashPayments !== "USE_EXPLICIT_ZERO"
    ) {
      errors.push({
        code: "MISSING_LOAN_CASH_PAYMENTS_FOR_CASH_FLOW_YEAR",
        message: "Each cash-flow year requires normalized loan cash payments.",
        path,
      });
    }

    composedYears.push({
      year: profitAndLossYear.year,
      profitAfterTax: profitAndLossYear.profitAfterTax,
      depreciation: profitAndLossYear.depreciation,
      changeInNetWorkingCapital:
        workingCapital?.changeInNetWorkingCapital ?? zeroAmount,
      capitalExpenditure: capitalExpenditure?.capitalExpenditure ?? zeroAmount,
      promoterContribution:
        financingInflows?.promoterContribution ?? zeroAmount,
      loanDisbursement: financingInflows?.loanDisbursement ?? zeroAmount,
      principalRepayment: loanCashPayments?.principalRepayment ?? zeroAmount,
      cashInterestPaid: loanCashPayments?.cashInterestPaid ?? zeroAmount,
    });
  }

  errors.push(...validateCashFlowYearInputs(composedYears));

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  return calculationSuccess(composedYears);
}

export function calculateCashFlowFromAuthoritativeSchedules(
  schedules: CashFlowAuthoritativeSchedules,
  initialOpeningCash: CashFlowProjectionInput["initialOpeningCash"],
  policy: CashFlowCompositionPolicy = strictCompositionPolicy,
): CalculationResult<CashFlowSchedule> {
  const composed = composeCashFlowYearInputs(schedules, policy);

  if (!composed.ok) {
    return calculationFailure(...composed.errors);
  }

  return calculateCashFlowSchedule({
    projectId: schedules.profitAndLoss.projectId,
    initialOpeningCash,
    years: composed.value,
  });
}
