import type {
  CashFlowFinancingInflowSchedule,
  CashFlowSchedule,
} from "../cash-flow/cash-flow";
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
import {
  calculateBalanceSheetSchedule,
  calculateRetainedEarningsSchedule,
  validateBalanceSheetYearInputs,
} from "./calculations";
import type {
  BalanceSheetAccountingBalanceSchedule,
  BalanceSheetCashSchedule,
  BalanceSheetCompositionPolicy,
  BalanceSheetDebtClassificationSchedule,
  BalanceSheetFixedAssetSchedule,
  BalanceSheetLoanOutstandingSchedule,
  BalanceSheetProjectionInput,
  BalanceSheetPromoterCapitalSchedule,
  BalanceSheetRetainedEarningsSchedule,
  BalanceSheetSchedule,
  BalanceSheetYearInput,
} from "./balance-sheet";

const zeroAmount = monetaryAmount("0");
const strictCompositionPolicy: BalanceSheetCompositionPolicy = {
  missingFixedAssets: "ERROR",
  missingCash: "ERROR",
  missingLoanOutstanding: "ERROR",
  missingDebtClassification: "ERROR",
  missingPromoterCapital: "ERROR",
  missingAccountingBalances: "ERROR",
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

function validateRequiredSource(
  assumption: Assumption<MonetaryAmount>,
  path: string,
  label: string,
): CalculationError | undefined {
  if (!assumption?.source) {
    return {
      code: "MISSING_BALANCE_SHEET_SOURCE",
      message: label + " requires a source-backed assumption.",
      path,
    };
  }
}

function validateNonNegative(
  value: MonetaryAmount,
  path: string,
  code: string,
  label: string,
): CalculationError | undefined {
  if (toDecimal(value).isNegative()) {
    return { code, message: label + " must not be negative.", path };
  }
}

export function adaptDepreciationScheduleToBalanceSheetFixedAssets(
  schedule: DepreciationSchedule,
): CalculationResult<BalanceSheetFixedAssetSchedule> {
  const errors: CalculationError[] = [
    ...validateYearCollection(
      schedule.yearlySummaries,
      "schedule.yearlySummaries",
      "BALANCE_SHEET_DEPRECIATION_SOURCE",
    ),
    ...validateSequentialYears(
      schedule.yearlySummaries,
      "schedule.yearlySummaries",
      "INVALID_BALANCE_SHEET_DEPRECIATION_SOURCE_YEAR_SEQUENCE",
    ),
  ];

  for (const [index, year] of schedule.yearlySummaries.entries()) {
    const path = "schedule.yearlySummaries." + index;
    const grossError = validateNonNegative(
      year.closingGrossFixedAssets,
      path + ".closingGrossFixedAssets",
      "NEGATIVE_DEPRECIATION_SOURCE_GROSS_ASSETS",
      "Closing gross fixed assets",
    );
    const accumulatedError = validateNonNegative(
      year.accumulatedDepreciation,
      path + ".accumulatedDepreciation",
      "NEGATIVE_DEPRECIATION_SOURCE_ACCUMULATED_DEPRECIATION",
      "Accumulated depreciation",
    );

    if (grossError) errors.push(grossError);
    if (accumulatedError) errors.push(accumulatedError);

    if (
      toDecimal(year.accumulatedDepreciation).greaterThan(
        toDecimal(year.closingGrossFixedAssets),
      )
    ) {
      errors.push({
        code: "DEPRECIATION_SOURCE_ACCUMULATED_EXCEEDS_GROSS_ASSETS",
        message:
          "Accumulated depreciation must not exceed closing gross fixed assets.",
        path: path + ".accumulatedDepreciation",
      });
    }

    const calculatedNet = toMonetaryAmount(
      toDecimal(year.closingGrossFixedAssets).minus(
        toDecimal(year.accumulatedDepreciation),
      ),
    );
    if (calculatedNet !== year.closingNetCarryingValue) {
      errors.push({
        code: "INCONSISTENT_DEPRECIATION_SOURCE_BALANCES",
        message:
          "Closing gross assets less accumulated depreciation must equal closing net carrying value.",
        path: path + ".closingNetCarryingValue",
      });
    }
  }

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  return calculationSuccess({
    projectId: schedule.projectId,
    years: schedule.yearlySummaries.map((year) => ({
      year: year.year,
      grossFixedAssets: year.closingGrossFixedAssets,
      accumulatedDepreciation: year.accumulatedDepreciation,
      authoritativeNetFixedAssets: year.closingNetCarryingValue,
    })),
  });
}

export function adaptCashFlowScheduleToBalanceSheetCash(
  schedule: CashFlowSchedule,
): CalculationResult<BalanceSheetCashSchedule> {
  const errors: CalculationError[] = [
    ...validateYearCollection(
      schedule.years,
      "schedule.years",
      "BALANCE_SHEET_CASH_SOURCE",
    ),
    ...validateSequentialYears(
      schedule.years,
      "schedule.years",
      "INVALID_BALANCE_SHEET_CASH_SOURCE_YEAR_SEQUENCE",
    ),
  ];

  for (const [index, year] of schedule.years.entries()) {
    if (toDecimal(year.closingCash).isNegative()) {
      errors.push({
        code: "NEGATIVE_CASH_REQUIRES_EXPLICIT_FINANCING_CLASSIFICATION",
        message:
          "Negative closing cash cannot be mapped to a positive balance-sheet asset; explicit financing classification is required.",
        path: "schedule.years." + index + ".closingCash",
      });
    }
  }

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  return calculationSuccess({
    projectId: schedule.projectId,
    years: schedule.years.map((year) => ({
      year: year.year,
      cashAndBank: year.closingCash,
    })),
  });
}

export function adaptLoanScheduleToBalanceSheetOutstanding(
  projectId: Identifier,
  schedule: LoanRepaymentSchedule,
): CalculationResult<BalanceSheetLoanOutstandingSchedule> {
  const sourceYears = schedule.annualSummaries.map((year) => ({
    year: year.projectionYear,
  }));
  const errors: CalculationError[] = [
    ...validateYearCollection(
      sourceYears,
      "schedule.annualSummaries",
      "BALANCE_SHEET_LOAN_SOURCE",
    ),
    ...validateSequentialYears(
      sourceYears,
      "schedule.annualSummaries",
      "INVALID_BALANCE_SHEET_LOAN_SOURCE_YEAR_SEQUENCE",
    ),
  ];

  for (const [index, year] of schedule.annualSummaries.entries()) {
    const error = validateNonNegative(
      year.closingPrincipal,
      "schedule.annualSummaries." + index + ".closingPrincipal",
      "NEGATIVE_LOAN_SOURCE_CLOSING_PRINCIPAL",
      "Closing loan principal",
    );
    if (error) errors.push(error);
  }

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  return calculationSuccess({
    projectId,
    years: schedule.annualSummaries.map((year) => ({
      year: year.projectionYear,
      totalLoanOutstanding: year.closingPrincipal,
    })),
  });
}

export function adaptFinancingInflowsToPromoterCapital(
  openingPromoterCapital: Assumption<MonetaryAmount>,
  schedule: CashFlowFinancingInflowSchedule,
): CalculationResult<BalanceSheetPromoterCapitalSchedule> {
  const errors: CalculationError[] = [
    ...validateYearCollection(
      schedule.years,
      "schedule.years",
      "BALANCE_SHEET_PROMOTER_SOURCE",
    ),
    ...validateSequentialYears(
      schedule.years,
      "schedule.years",
      "INVALID_BALANCE_SHEET_PROMOTER_SOURCE_YEAR_SEQUENCE",
    ),
  ];
  const sourceError = validateRequiredSource(
    openingPromoterCapital,
    "openingPromoterCapital",
    "Opening promoter capital",
  );
  if (sourceError) errors.push(sourceError);

  if (openingPromoterCapital?.value) {
    const openingError = validateNonNegative(
      openingPromoterCapital.value,
      "openingPromoterCapital.value",
      "NEGATIVE_OPENING_PROMOTER_CAPITAL",
      "Opening promoter capital",
    );
    if (openingError) errors.push(openingError);
  }

  for (const [index, year] of schedule.years.entries()) {
    const error = validateNonNegative(
      year.promoterContribution,
      "schedule.years." + index + ".promoterContribution",
      "NEGATIVE_PROMOTER_CONTRIBUTION_FOR_CAPITAL",
      "Promoter contribution",
    );
    if (error) errors.push(error);
  }

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  let openingCapital = openingPromoterCapital.value;
  const years = schedule.years.map((year) => {
    const closingPromoterCapital = toMonetaryAmount(
      toDecimal(openingCapital).plus(toDecimal(year.promoterContribution)),
    );
    const result = {
      year: year.year,
      openingPromoterCapital: openingCapital,
      promoterContribution: year.promoterContribution,
      closingPromoterCapital,
    };
    openingCapital = closingPromoterCapital;
    return result;
  });

  return calculationSuccess({
    projectId: schedule.projectId,
    openingPromoterCapital,
    years,
  });
}

export function adaptProfitAndLossToRetainedEarnings(
  profitAndLoss: ProfitAndLossSchedule,
  openingRetainedEarnings: Assumption<MonetaryAmount>,
  accountingBalances: BalanceSheetAccountingBalanceSchedule,
  missingAdjustment: BalanceSheetCompositionPolicy["missingAccountingBalances"] = "ERROR",
): CalculationResult<BalanceSheetRetainedEarningsSchedule> {
  const errors: CalculationError[] = [];

  if (profitAndLoss.projectId !== accountingBalances.projectId) {
    errors.push({
      code: "RETAINED_EARNINGS_PROJECT_ID_MISMATCH",
      message:
        "P&L and retained-earnings adjustments must belong to one project.",
      path: "projectId",
    });
  }

  errors.push(
    ...validateYearCollection(
      profitAndLoss.years,
      "profitAndLoss.years",
      "RETAINED_EARNINGS_PROFIT_AND_LOSS_SOURCE",
    ),
    ...validateSequentialYears(
      profitAndLoss.years,
      "profitAndLoss.years",
      "INVALID_RETAINED_EARNINGS_SOURCE_YEAR_SEQUENCE",
    ),
    ...validateYearCollection(
      accountingBalances.years,
      "accountingBalances.years",
      "RETAINED_EARNINGS_ADJUSTMENT_SOURCE",
    ),
  );

  const validYears = new Set(profitAndLoss.years.map((year) => year.year));
  for (const [index, year] of accountingBalances.years.entries()) {
    if (!validYears.has(year.year)) {
      errors.push({
        code: "RETAINED_EARNINGS_ADJUSTMENT_YEAR_NOT_IN_PROJECTION",
        message: "Retained-earnings adjustment contains an extra year.",
        path: "accountingBalances.years." + index + ".year",
      });
    }
  }

  const years = profitAndLoss.years.map((profitYear, index) => {
    const accountingYear = accountingBalances.years.find(
      (year) => year.year === profitYear.year,
    );
    if (!accountingYear && missingAdjustment !== "USE_EXPLICIT_ZERO") {
      errors.push({
        code: "MISSING_RETAINED_EARNINGS_ADJUSTMENT",
        message: "Each retained-earnings year requires an explicit adjustment.",
        path: "profitAndLoss.years." + index + ".year",
      });
    }

    if (accountingYear) {
      const sourceError = validateRequiredSource(
        accountingYear.retainedEarningsAdjustments,
        "accountingBalances.years." + index + ".retainedEarningsAdjustments",
        "Retained-earnings adjustment",
      );
      if (sourceError) errors.push(sourceError);
    }

    return {
      year: profitYear.year,
      profitAfterTax: profitYear.profitAfterTax,
      retainedEarningsAdjustments:
        accountingYear?.retainedEarningsAdjustments?.value ?? zeroAmount,
    };
  });

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  return calculateRetainedEarningsSchedule({
    projectId: profitAndLoss.projectId,
    openingRetainedEarnings,
    years,
  });
}

export interface BalanceSheetAuthoritativeSchedules {
  readonly profitAndLoss: ProfitAndLossSchedule;
  readonly fixedAssets: BalanceSheetFixedAssetSchedule;
  readonly cash: BalanceSheetCashSchedule;
  readonly loanOutstanding: BalanceSheetLoanOutstandingSchedule;
  readonly debtClassification: BalanceSheetDebtClassificationSchedule;
  readonly promoterCapital: BalanceSheetPromoterCapitalSchedule;
  readonly accountingBalances: BalanceSheetAccountingBalanceSchedule;
}

function validatePromoterCapitalSchedule(
  schedule: BalanceSheetPromoterCapitalSchedule,
): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  const sourceError = validateRequiredSource(
    schedule.openingPromoterCapital,
    "promoterCapital.openingPromoterCapital",
    "Opening promoter capital",
  );
  if (sourceError) errors.push(sourceError);

  let expectedOpening = schedule.openingPromoterCapital?.value;
  for (const [index, year] of schedule.years.entries()) {
    const path = "promoterCapital.years." + index;
    for (const [field, value, code, label] of [
      [
        "openingPromoterCapital",
        year.openingPromoterCapital,
        "NEGATIVE_PROMOTER_CAPITAL_OPENING",
        "Opening promoter capital",
      ],
      [
        "promoterContribution",
        year.promoterContribution,
        "NEGATIVE_PROMOTER_CAPITAL_CONTRIBUTION",
        "Promoter contribution",
      ],
      [
        "closingPromoterCapital",
        year.closingPromoterCapital,
        "NEGATIVE_PROMOTER_CAPITAL_CLOSING",
        "Closing promoter capital",
      ],
    ] as const) {
      const error = validateNonNegative(value, path + "." + field, code, label);
      if (error) errors.push(error);
    }

    if (expectedOpening && year.openingPromoterCapital !== expectedOpening) {
      errors.push({
        code: "PROMOTER_CAPITAL_OPENING_CONTINUITY_FAILURE",
        message:
          "Each promoter-capital opening must equal the prior closing balance.",
        path: path + ".openingPromoterCapital",
      });
    }

    const expectedClosing = toMonetaryAmount(
      toDecimal(year.openingPromoterCapital).plus(
        toDecimal(year.promoterContribution),
      ),
    );
    if (year.closingPromoterCapital !== expectedClosing) {
      errors.push({
        code: "PROMOTER_CAPITAL_ROLL_FORWARD_FAILURE",
        message:
          "Closing promoter capital must equal opening capital plus contribution.",
        path: path + ".closingPromoterCapital",
      });
    }
    expectedOpening = year.closingPromoterCapital;
  }

  return errors;
}

function validateFixedAssetSchedule(
  schedule: BalanceSheetFixedAssetSchedule,
): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  for (const [index, year] of schedule.years.entries()) {
    const path = "fixedAssets.years." + index;
    const calculatedNet = toMonetaryAmount(
      toDecimal(year.grossFixedAssets).minus(
        toDecimal(year.accumulatedDepreciation),
      ),
    );
    if (calculatedNet !== year.authoritativeNetFixedAssets) {
      errors.push({
        code: "INCONSISTENT_BALANCE_SHEET_FIXED_ASSET_SOURCE",
        message:
          "Gross fixed assets less accumulated depreciation must equal authoritative net fixed assets.",
        path: path + ".authoritativeNetFixedAssets",
      });
    }
  }
  return errors;
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
        message: label + " contains a year outside the P&L timeline.",
        path: path + "." + index + ".year",
      });
    }
  }
  return errors;
}

function sourceProjectIds(
  schedules: BalanceSheetAuthoritativeSchedules,
): readonly Identifier[] {
  return [
    schedules.profitAndLoss.projectId,
    schedules.fixedAssets.projectId,
    schedules.cash.projectId,
    schedules.loanOutstanding.projectId,
    schedules.debtClassification.projectId,
    schedules.promoterCapital.projectId,
    schedules.accountingBalances.projectId,
  ];
}

export function composeBalanceSheetYearInputs(
  schedules: BalanceSheetAuthoritativeSchedules,
  policy: BalanceSheetCompositionPolicy = strictCompositionPolicy,
): CalculationResult<readonly BalanceSheetYearInput[]> {
  const errors: CalculationError[] = [];
  const projectIds = sourceProjectIds(schedules);

  if (projectIds.some((projectId) => projectId !== projectIds[0])) {
    errors.push({
      code: "BALANCE_SHEET_PROJECT_ID_MISMATCH",
      message: "All balance-sheet source schedules must belong to one project.",
      path: "projectId",
    });
  }

  const sources = [
    {
      rows: schedules.profitAndLoss.years,
      path: "profitAndLoss.years",
      label: "BALANCE_SHEET_PROFIT_AND_LOSS_SOURCE",
    },
    {
      rows: schedules.fixedAssets.years,
      path: "fixedAssets.years",
      label: "BALANCE_SHEET_FIXED_ASSET_SOURCE",
    },
    {
      rows: schedules.cash.years,
      path: "cash.years",
      label: "BALANCE_SHEET_CASH_SOURCE",
    },
    {
      rows: schedules.loanOutstanding.years,
      path: "loanOutstanding.years",
      label: "BALANCE_SHEET_LOAN_SOURCE",
    },
    {
      rows: schedules.debtClassification.years,
      path: "debtClassification.years",
      label: "BALANCE_SHEET_DEBT_CLASSIFICATION_SOURCE",
    },
    {
      rows: schedules.promoterCapital.years,
      path: "promoterCapital.years",
      label: "BALANCE_SHEET_PROMOTER_CAPITAL_SOURCE",
    },
    {
      rows: schedules.accountingBalances.years,
      path: "accountingBalances.years",
      label: "BALANCE_SHEET_ACCOUNTING_BALANCE_SOURCE",
    },
  ] as const;

  for (const source of sources) {
    errors.push(
      ...validateYearCollection(source.rows, source.path, source.label),
    );
  }
  errors.push(...validateFixedAssetSchedule(schedules.fixedAssets));
  errors.push(...validatePromoterCapitalSchedule(schedules.promoterCapital));

  if (schedules.profitAndLoss.years.length === 0) {
    errors.push({
      code: "EMPTY_BALANCE_SHEET_PROFIT_AND_LOSS_SOURCE",
      message: "P&L source must contain at least one projection year.",
      path: "profitAndLoss.years",
    });
  }
  errors.push(
    ...validateSequentialYears(
      schedules.profitAndLoss.years,
      "profitAndLoss.years",
      "INVALID_BALANCE_SHEET_SOURCE_YEAR_SEQUENCE",
    ),
  );

  const validYears = new Set(
    schedules.profitAndLoss.years.map((year) => year.year),
  );
  const alignedSources = sources.slice(1);
  for (const source of alignedSources) {
    errors.push(
      ...validateExtraYears(
        source.rows,
        validYears,
        source.path,
        source.label + "_YEAR_NOT_IN_PROJECTION",
        source.label.replaceAll("_", " ").toLowerCase(),
      ),
    );
  }

  const composedYears: BalanceSheetYearInput[] = [];
  for (const [index, profitYear] of schedules.profitAndLoss.years.entries()) {
    const fixedAssets = schedules.fixedAssets.years.find(
      (year) => year.year === profitYear.year,
    );
    const cash = schedules.cash.years.find(
      (year) => year.year === profitYear.year,
    );
    const loan = schedules.loanOutstanding.years.find(
      (year) => year.year === profitYear.year,
    );
    const debt = schedules.debtClassification.years.find(
      (year) => year.year === profitYear.year,
    );
    const promoter = schedules.promoterCapital.years.find(
      (year) => year.year === profitYear.year,
    );
    const accounting = schedules.accountingBalances.years.find(
      (year) => year.year === profitYear.year,
    );
    const path = "profitAndLoss.years." + index + ".year";

    const missingSources = [
      [
        fixedAssets,
        policy.missingFixedAssets,
        "MISSING_FIXED_ASSETS_FOR_BALANCE_SHEET_YEAR",
        "Each year requires authoritative fixed-asset balances.",
      ],
      [
        cash,
        policy.missingCash,
        "MISSING_CASH_FOR_BALANCE_SHEET_YEAR",
        "Each year requires authoritative closing cash.",
      ],
      [
        loan,
        policy.missingLoanOutstanding,
        "MISSING_LOAN_OUTSTANDING_FOR_BALANCE_SHEET_YEAR",
        "Each year requires authoritative total loan outstanding.",
      ],
      [
        debt,
        policy.missingDebtClassification,
        "MISSING_DEBT_CLASSIFICATION_FOR_BALANCE_SHEET_YEAR",
        "Each year requires explicit debt maturity classification.",
      ],
      [
        promoter,
        policy.missingPromoterCapital,
        "MISSING_PROMOTER_CAPITAL_FOR_BALANCE_SHEET_YEAR",
        "Each year requires authoritative closing promoter capital.",
      ],
      [
        accounting,
        policy.missingAccountingBalances,
        "MISSING_ACCOUNTING_BALANCES_FOR_BALANCE_SHEET_YEAR",
        "Each year requires explicit accounting balances.",
      ],
    ] as const;

    for (const [source, treatment, code, message] of missingSources) {
      if (!source && treatment !== "USE_EXPLICIT_ZERO") {
        errors.push({ code, message, path });
      }
    }

    if (debt) {
      const longTermSourceError = validateRequiredSource(
        debt.longTermLoanOutstanding,
        "debtClassification.years." + index + ".longTermLoanOutstanding",
        "Long-term loan classification",
      );
      const currentSourceError = validateRequiredSource(
        debt.currentDebt,
        "debtClassification.years." + index + ".currentDebt",
        "Current-debt classification",
      );
      if (longTermSourceError) errors.push(longTermSourceError);
      if (currentSourceError) errors.push(currentSourceError);
    }

    if (accounting) {
      const assumptionFields = [
        ["inventory", accounting.inventory, "Inventory"],
        ["receivables", accounting.receivables, "Receivables"],
        [
          "otherCurrentAssets",
          accounting.otherCurrentAssets,
          "Other current assets",
        ],
        ["payables", accounting.payables, "Payables"],
        [
          "otherCurrentLiabilities",
          accounting.otherCurrentLiabilities,
          "Other current liabilities",
        ],
        [
          "retainedEarningsAdjustments",
          accounting.retainedEarningsAdjustments,
          "Retained-earnings adjustments",
        ],
        ["otherEquity", accounting.otherEquity, "Other equity"],
      ] as const;
      for (const [field, assumption, label] of assumptionFields) {
        const sourceError = validateRequiredSource(
          assumption,
          "accountingBalances.years." + index + "." + field,
          label,
        );
        if (sourceError) errors.push(sourceError);
      }
    }

    const longTermLoanOutstanding =
      debt?.longTermLoanOutstanding?.value ?? zeroAmount;
    const currentDebt = debt?.currentDebt?.value ?? zeroAmount;
    const totalLoanOutstanding = loan?.totalLoanOutstanding ?? zeroAmount;
    if (
      !toDecimal(longTermLoanOutstanding)
        .plus(toDecimal(currentDebt))
        .equals(toDecimal(totalLoanOutstanding))
    ) {
      errors.push({
        code: "DEBT_CLASSIFICATION_DOES_NOT_RECONCILE",
        message:
          "Long-term loan plus current debt must equal authoritative total closing principal.",
        path: "debtClassification.years." + index,
      });
    }

    composedYears.push({
      year: profitYear.year,
      grossFixedAssets: fixedAssets?.grossFixedAssets ?? zeroAmount,
      accumulatedDepreciation:
        fixedAssets?.accumulatedDepreciation ?? zeroAmount,
      inventory: accounting?.inventory?.value ?? zeroAmount,
      receivables: accounting?.receivables?.value ?? zeroAmount,
      otherCurrentAssets: accounting?.otherCurrentAssets?.value ?? zeroAmount,
      cashAndBank: cash?.cashAndBank ?? zeroAmount,
      longTermLoanOutstanding,
      currentDebt,
      payables: accounting?.payables?.value ?? zeroAmount,
      otherCurrentLiabilities:
        accounting?.otherCurrentLiabilities?.value ?? zeroAmount,
      promoterCapital: promoter?.closingPromoterCapital ?? zeroAmount,
      profitAfterTax: profitYear.profitAfterTax,
      retainedEarningsAdjustments:
        accounting?.retainedEarningsAdjustments?.value ?? zeroAmount,
      otherEquity: accounting?.otherEquity?.value ?? zeroAmount,
    });
  }

  errors.push(...validateBalanceSheetYearInputs(composedYears));

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  return calculationSuccess(composedYears);
}

export function calculateBalanceSheetFromAuthoritativeSchedules(
  schedules: BalanceSheetAuthoritativeSchedules,
  openingRetainedEarnings: BalanceSheetProjectionInput["openingRetainedEarnings"],
  policy: BalanceSheetCompositionPolicy = strictCompositionPolicy,
): CalculationResult<BalanceSheetSchedule> {
  const composed = composeBalanceSheetYearInputs(schedules, policy);

  if (!composed.ok) {
    return calculationFailure(...composed.errors);
  }

  return calculateBalanceSheetSchedule({
    projectId: schedules.profitAndLoss.projectId,
    openingRetainedEarnings,
    years: composed.value,
  });
}
