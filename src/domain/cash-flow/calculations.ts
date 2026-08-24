import type {
  CalculationError,
  CalculationResult,
} from "../shared/calculation";
import { calculationFailure, calculationSuccess } from "../shared/calculation";
import { monetaryAmount, toDecimal, toMonetaryAmount } from "../shared/decimal";
import type { MonetaryAmount } from "../shared/types";
import type {
  CashFlowCumulativeTotals,
  CashFlowProjectionInput,
  CashFlowSchedule,
  CashFlowYear,
  CashFlowYearInput,
} from "./cash-flow";

const zeroAmount = monetaryAmount("0");

function pushError(
  errors: CalculationError[],
  error: CalculationError | undefined,
): void {
  if (error) {
    errors.push(error);
  }
}

function validateNonNegativeAmount(
  value: MonetaryAmount,
  path: string,
  code: string,
  label: string,
): CalculationError | undefined {
  if (toDecimal(value).isNegative()) {
    return {
      code,
      message: label + " must not be negative.",
      path,
    };
  }
}

export function validateCashFlowYearInputs(
  years: readonly CashFlowYearInput[],
): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  const seenYears = new Set<number>();

  if (years.length === 0) {
    errors.push({
      code: "EMPTY_CASH_FLOW_SCHEDULE",
      message: "Cash-flow schedule must contain at least one projection year.",
      path: "years",
    });
  }

  for (const [index, year] of years.entries()) {
    const path = "years." + index;

    if (!Number.isInteger(year.year) || year.year <= 0) {
      errors.push({
        code: "INVALID_CASH_FLOW_YEAR",
        message: "Cash-flow year must be a positive integer.",
        path: path + ".year",
      });
    }

    if (seenYears.has(year.year)) {
      errors.push({
        code: "DUPLICATE_CASH_FLOW_YEAR",
        message: "Each cash-flow year must be unique.",
        path: path + ".year",
      });
    } else {
      seenYears.add(year.year);
    }

    if (year.year !== index + 1) {
      errors.push({
        code: "INVALID_CASH_FLOW_YEAR_SEQUENCE",
        message: "Cash-flow years must be sequential and start at year 1.",
        path: path + ".year",
      });
    }

    pushError(
      errors,
      validateNonNegativeAmount(
        year.depreciation,
        path + ".depreciation",
        "NEGATIVE_CASH_FLOW_DEPRECIATION",
        "Cash-flow depreciation",
      ),
    );
    pushError(
      errors,
      validateNonNegativeAmount(
        year.capitalExpenditure,
        path + ".capitalExpenditure",
        "NEGATIVE_CAPITAL_EXPENDITURE",
        "Capital expenditure",
      ),
    );
    pushError(
      errors,
      validateNonNegativeAmount(
        year.promoterContribution,
        path + ".promoterContribution",
        "NEGATIVE_PROMOTER_CONTRIBUTION",
        "Promoter contribution",
      ),
    );
    pushError(
      errors,
      validateNonNegativeAmount(
        year.loanDisbursement,
        path + ".loanDisbursement",
        "NEGATIVE_LOAN_DISBURSEMENT",
        "Loan disbursement",
      ),
    );
    pushError(
      errors,
      validateNonNegativeAmount(
        year.principalRepayment,
        path + ".principalRepayment",
        "NEGATIVE_PRINCIPAL_REPAYMENT",
        "Principal repayment",
      ),
    );
    pushError(
      errors,
      validateNonNegativeAmount(
        year.cashInterestPaid,
        path + ".cashInterestPaid",
        "NEGATIVE_CASH_INTEREST_PAID",
        "Cash interest paid",
      ),
    );
  }

  return errors;
}

function calculateOperatingCashFlowUnchecked(
  profitAfterTax: MonetaryAmount,
  depreciation: MonetaryAmount,
  changeInNetWorkingCapital: MonetaryAmount,
): MonetaryAmount {
  return toMonetaryAmount(
    toDecimal(profitAfterTax)
      .plus(toDecimal(depreciation))
      .minus(toDecimal(changeInNetWorkingCapital)),
  );
}

export function calculateOperatingCashFlow(
  profitAfterTax: MonetaryAmount,
  depreciation: MonetaryAmount,
  changeInNetWorkingCapital: MonetaryAmount,
): CalculationResult<MonetaryAmount> {
  const depreciationError = validateNonNegativeAmount(
    depreciation,
    "depreciation",
    "NEGATIVE_CASH_FLOW_DEPRECIATION",
    "Cash-flow depreciation",
  );

  if (depreciationError) {
    return calculationFailure(depreciationError);
  }

  return calculationSuccess(
    calculateOperatingCashFlowUnchecked(
      profitAfterTax,
      depreciation,
      changeInNetWorkingCapital,
    ),
  );
}

function calculateInvestingCashFlowUnchecked(
  capitalExpenditure: MonetaryAmount,
): MonetaryAmount {
  return toMonetaryAmount(toDecimal(capitalExpenditure).negated());
}

export function calculateInvestingCashFlow(
  capitalExpenditure: MonetaryAmount,
): CalculationResult<MonetaryAmount> {
  const capitalExpenditureError = validateNonNegativeAmount(
    capitalExpenditure,
    "capitalExpenditure",
    "NEGATIVE_CAPITAL_EXPENDITURE",
    "Capital expenditure",
  );

  if (capitalExpenditureError) {
    return calculationFailure(capitalExpenditureError);
  }

  return calculationSuccess(
    calculateInvestingCashFlowUnchecked(capitalExpenditure),
  );
}

function calculateFinancingCashFlowUnchecked(
  promoterContribution: MonetaryAmount,
  loanDisbursement: MonetaryAmount,
  principalRepayment: MonetaryAmount,
  cashInterestPaid: MonetaryAmount,
): MonetaryAmount {
  return toMonetaryAmount(
    toDecimal(promoterContribution)
      .plus(toDecimal(loanDisbursement))
      .minus(toDecimal(principalRepayment))
      .minus(toDecimal(cashInterestPaid)),
  );
}

export function calculateFinancingCashFlow(
  promoterContribution: MonetaryAmount,
  loanDisbursement: MonetaryAmount,
  principalRepayment: MonetaryAmount,
  cashInterestPaid: MonetaryAmount,
): CalculationResult<MonetaryAmount> {
  const errors: CalculationError[] = [];

  pushError(
    errors,
    validateNonNegativeAmount(
      promoterContribution,
      "promoterContribution",
      "NEGATIVE_PROMOTER_CONTRIBUTION",
      "Promoter contribution",
    ),
  );
  pushError(
    errors,
    validateNonNegativeAmount(
      loanDisbursement,
      "loanDisbursement",
      "NEGATIVE_LOAN_DISBURSEMENT",
      "Loan disbursement",
    ),
  );
  pushError(
    errors,
    validateNonNegativeAmount(
      principalRepayment,
      "principalRepayment",
      "NEGATIVE_PRINCIPAL_REPAYMENT",
      "Principal repayment",
    ),
  );
  pushError(
    errors,
    validateNonNegativeAmount(
      cashInterestPaid,
      "cashInterestPaid",
      "NEGATIVE_CASH_INTEREST_PAID",
      "Cash interest paid",
    ),
  );

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  return calculationSuccess(
    calculateFinancingCashFlowUnchecked(
      promoterContribution,
      loanDisbursement,
      principalRepayment,
      cashInterestPaid,
    ),
  );
}

interface CumulativeCashFlowState {
  operating: ReturnType<typeof toDecimal>;
  investing: ReturnType<typeof toDecimal>;
  financing: ReturnType<typeof toDecimal>;
  netMovement: ReturnType<typeof toDecimal>;
}

function calculateCashFlowYearUnchecked(
  input: CashFlowYearInput,
  openingCash: MonetaryAmount,
  cumulativeState: CumulativeCashFlowState,
): CashFlowYear {
  const operatingCashFlow = calculateOperatingCashFlowUnchecked(
    input.profitAfterTax,
    input.depreciation,
    input.changeInNetWorkingCapital,
  );
  const investingCashFlow = calculateInvestingCashFlowUnchecked(
    input.capitalExpenditure,
  );
  const financingCashFlow = calculateFinancingCashFlowUnchecked(
    input.promoterContribution,
    input.loanDisbursement,
    input.principalRepayment,
    input.cashInterestPaid,
  );
  const netCashMovement = toMonetaryAmount(
    toDecimal(operatingCashFlow)
      .plus(toDecimal(investingCashFlow))
      .plus(toDecimal(financingCashFlow)),
  );
  const closingCash = toMonetaryAmount(
    toDecimal(openingCash).plus(toDecimal(netCashMovement)),
  );

  cumulativeState.operating = cumulativeState.operating.plus(
    toDecimal(operatingCashFlow),
  );
  cumulativeState.investing = cumulativeState.investing.plus(
    toDecimal(investingCashFlow),
  );
  cumulativeState.financing = cumulativeState.financing.plus(
    toDecimal(financingCashFlow),
  );
  cumulativeState.netMovement = cumulativeState.netMovement.plus(
    toDecimal(netCashMovement),
  );

  return {
    year: input.year,
    openingCash,
    profitAfterTax: input.profitAfterTax,
    depreciationAddBack: input.depreciation,
    changeInNetWorkingCapital: input.changeInNetWorkingCapital,
    operatingCashFlow,
    capitalExpenditure: input.capitalExpenditure,
    investingCashFlow,
    promoterContribution: input.promoterContribution,
    loanDisbursement: input.loanDisbursement,
    principalRepayment: input.principalRepayment,
    cashInterestPaid: input.cashInterestPaid,
    financingCashFlow,
    netCashMovement,
    closingCash,
    cumulativeOperatingCashFlow: toMonetaryAmount(cumulativeState.operating),
    cumulativeInvestingCashFlow: toMonetaryAmount(cumulativeState.investing),
    cumulativeFinancingCashFlow: toMonetaryAmount(cumulativeState.financing),
    cumulativeNetCashMovement: toMonetaryAmount(cumulativeState.netMovement),
  };
}

function cumulativeTotals(finalYear: CashFlowYear): CashFlowCumulativeTotals {
  return {
    cumulativeOperatingCashFlow: finalYear.cumulativeOperatingCashFlow,
    cumulativeInvestingCashFlow: finalYear.cumulativeInvestingCashFlow,
    cumulativeFinancingCashFlow: finalYear.cumulativeFinancingCashFlow,
    cumulativeNetCashMovement: finalYear.cumulativeNetCashMovement,
    endingCash: finalYear.closingCash,
  };
}

export function calculateCashFlowSchedule(
  input: CashFlowProjectionInput,
): CalculationResult<CashFlowSchedule> {
  const errors = [...validateCashFlowYearInputs(input.years)];

  if (!input.initialOpeningCash) {
    errors.push({
      code: "MISSING_INITIAL_OPENING_CASH",
      message:
        "Cash-flow schedule requires an explicit opening cash assumption.",
      path: "initialOpeningCash",
    });
  }

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  const years: CashFlowYear[] = [];
  const cumulativeState: CumulativeCashFlowState = {
    operating: toDecimal(zeroAmount),
    investing: toDecimal(zeroAmount),
    financing: toDecimal(zeroAmount),
    netMovement: toDecimal(zeroAmount),
  };
  let openingCash = input.initialOpeningCash.value;

  for (const yearInput of input.years) {
    const year = calculateCashFlowYearUnchecked(
      yearInput,
      openingCash,
      cumulativeState,
    );
    years.push(year);
    openingCash = year.closingCash;
  }

  const finalYear = years.at(-1)!;

  return calculationSuccess({
    projectId: input.projectId,
    initialOpeningCash: input.initialOpeningCash,
    years,
    cumulativeTotals: cumulativeTotals(finalYear),
  });
}
