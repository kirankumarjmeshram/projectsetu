import type {
  CalculationError,
  CalculationResult,
} from "../shared/calculation";
import { calculationFailure, calculationSuccess } from "../shared/calculation";
import { toDecimal, toMonetaryAmount } from "../shared/decimal";
import type { MonetaryAmount } from "../shared/types";
import type {
  BalanceSheetProjectionInput,
  BalanceSheetRetainedEarningsInput,
  BalanceSheetRetainedEarningsSchedule,
  BalanceSheetSchedule,
  BalanceSheetYear,
  BalanceSheetYearInput,
} from "./balance-sheet";

function requiredAmountError(
  value: MonetaryAmount,
  path: string,
  label: string,
): CalculationError | undefined {
  if (typeof value !== "string") {
    return {
      code: "MISSING_BALANCE_SHEET_VALUE",
      message: label + " is required.",
      path,
    };
  }
}

function nonNegativeAmountError(
  value: MonetaryAmount,
  path: string,
  code: string,
  label: string,
): CalculationError | undefined {
  const missing = requiredAmountError(value, path, label);

  if (missing) {
    return missing;
  }

  if (toDecimal(value).isNegative()) {
    return {
      code,
      message: label + " must not be negative.",
      path,
    };
  }
}

function pushError(
  errors: CalculationError[],
  error: CalculationError | undefined,
): void {
  if (error) {
    errors.push(error);
  }
}

function validateYearSeries(
  years: readonly { readonly year: number }[],
  path: string,
  emptyCode: string,
  invalidCode: string,
  duplicateCode: string,
  sequenceCode: string,
): readonly CalculationError[] {
  const errors: CalculationError[] = [];
  const seenYears = new Set<number>();

  if (years.length === 0) {
    errors.push({
      code: emptyCode,
      message: "Schedule must contain at least one projection year.",
      path,
    });
  }

  for (const [index, row] of years.entries()) {
    const yearPath = path + "." + index + ".year";

    if (!Number.isInteger(row.year) || row.year <= 0) {
      errors.push({
        code: invalidCode,
        message: "Projection year must be a positive integer.",
        path: yearPath,
      });
    }

    if (seenYears.has(row.year)) {
      errors.push({
        code: duplicateCode,
        message: "Projection years must be unique.",
        path: yearPath,
      });
    } else {
      seenYears.add(row.year);
    }

    if (row.year !== index + 1) {
      errors.push({
        code: sequenceCode,
        message: "Projection years must be sequential and start at year 1.",
        path: yearPath,
      });
    }
  }

  return errors;
}

export function validateBalanceSheetYearInputs(
  years: readonly BalanceSheetYearInput[],
): readonly CalculationError[] {
  const errors: CalculationError[] = [
    ...validateYearSeries(
      years,
      "years",
      "EMPTY_BALANCE_SHEET_SCHEDULE",
      "INVALID_BALANCE_SHEET_YEAR",
      "DUPLICATE_BALANCE_SHEET_YEAR",
      "INVALID_BALANCE_SHEET_YEAR_SEQUENCE",
    ),
  ];

  for (const [index, year] of years.entries()) {
    const path = "years." + index;
    const nonNegativeFields = [
      [
        "grossFixedAssets",
        year.grossFixedAssets,
        "NEGATIVE_GROSS_FIXED_ASSETS",
        "Gross fixed assets",
      ],
      [
        "accumulatedDepreciation",
        year.accumulatedDepreciation,
        "NEGATIVE_ACCUMULATED_DEPRECIATION",
        "Accumulated depreciation",
      ],
      ["inventory", year.inventory, "NEGATIVE_INVENTORY", "Inventory"],
      ["receivables", year.receivables, "NEGATIVE_RECEIVABLES", "Receivables"],
      [
        "otherCurrentAssets",
        year.otherCurrentAssets,
        "NEGATIVE_OTHER_CURRENT_ASSETS",
        "Other current assets",
      ],
      [
        "cashAndBank",
        year.cashAndBank,
        "NEGATIVE_BALANCE_SHEET_CASH",
        "Cash and bank",
      ],
      [
        "longTermLoanOutstanding",
        year.longTermLoanOutstanding,
        "NEGATIVE_LONG_TERM_LOAN",
        "Long-term loan outstanding",
      ],
      [
        "currentDebt",
        year.currentDebt,
        "NEGATIVE_CURRENT_DEBT",
        "Current debt",
      ],
      ["payables", year.payables, "NEGATIVE_PAYABLES", "Payables"],
      [
        "otherCurrentLiabilities",
        year.otherCurrentLiabilities,
        "NEGATIVE_OTHER_CURRENT_LIABILITIES",
        "Other current liabilities",
      ],
      [
        "promoterCapital",
        year.promoterCapital,
        "NEGATIVE_PROMOTER_CAPITAL_BALANCE",
        "Promoter capital",
      ],
    ] as const;

    for (const [field, value, code, label] of nonNegativeFields) {
      pushError(
        errors,
        nonNegativeAmountError(value, path + "." + field, code, label),
      );
    }

    pushError(
      errors,
      requiredAmountError(
        year.profitAfterTax,
        path + ".profitAfterTax",
        "Profit after tax",
      ),
    );
    pushError(
      errors,
      requiredAmountError(
        year.retainedEarningsAdjustments,
        path + ".retainedEarningsAdjustments",
        "Retained-earnings adjustments",
      ),
    );
    pushError(
      errors,
      requiredAmountError(
        year.otherEquity,
        path + ".otherEquity",
        "Other equity",
      ),
    );

    if (
      typeof year.grossFixedAssets === "string" &&
      typeof year.accumulatedDepreciation === "string" &&
      toDecimal(year.accumulatedDepreciation).greaterThan(
        toDecimal(year.grossFixedAssets),
      )
    ) {
      errors.push({
        code: "ACCUMULATED_DEPRECIATION_EXCEEDS_GROSS_ASSETS",
        message: "Accumulated depreciation must not exceed gross fixed assets.",
        path: path + ".accumulatedDepreciation",
      });
    }
  }

  return errors;
}

export function calculateNetFixedAssets(
  grossFixedAssets: MonetaryAmount,
  accumulatedDepreciation: MonetaryAmount,
): CalculationResult<MonetaryAmount> {
  const errors: CalculationError[] = [];
  pushError(
    errors,
    nonNegativeAmountError(
      grossFixedAssets,
      "grossFixedAssets",
      "NEGATIVE_GROSS_FIXED_ASSETS",
      "Gross fixed assets",
    ),
  );
  pushError(
    errors,
    nonNegativeAmountError(
      accumulatedDepreciation,
      "accumulatedDepreciation",
      "NEGATIVE_ACCUMULATED_DEPRECIATION",
      "Accumulated depreciation",
    ),
  );

  if (
    errors.length === 0 &&
    toDecimal(accumulatedDepreciation).greaterThan(toDecimal(grossFixedAssets))
  ) {
    errors.push({
      code: "ACCUMULATED_DEPRECIATION_EXCEEDS_GROSS_ASSETS",
      message: "Accumulated depreciation must not exceed gross fixed assets.",
      path: "accumulatedDepreciation",
    });
  }

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  return calculationSuccess(
    toMonetaryAmount(
      toDecimal(grossFixedAssets).minus(toDecimal(accumulatedDepreciation)),
    ),
  );
}

export function calculateTotalCurrentAssets(
  inventory: MonetaryAmount,
  receivables: MonetaryAmount,
  otherCurrentAssets: MonetaryAmount,
  cashAndBank: MonetaryAmount,
): MonetaryAmount {
  return toMonetaryAmount(
    toDecimal(inventory)
      .plus(toDecimal(receivables))
      .plus(toDecimal(otherCurrentAssets))
      .plus(toDecimal(cashAndBank)),
  );
}

export function calculateTotalLiabilities(
  longTermLoanOutstanding: MonetaryAmount,
  currentDebt: MonetaryAmount,
  payables: MonetaryAmount,
  otherCurrentLiabilities: MonetaryAmount,
): MonetaryAmount {
  return toMonetaryAmount(
    toDecimal(longTermLoanOutstanding)
      .plus(toDecimal(currentDebt))
      .plus(toDecimal(payables))
      .plus(toDecimal(otherCurrentLiabilities)),
  );
}

export function calculateTotalCurrentLiabilities(
  currentDebt: MonetaryAmount,
  payables: MonetaryAmount,
  otherCurrentLiabilities: MonetaryAmount,
): MonetaryAmount {
  return toMonetaryAmount(
    toDecimal(currentDebt)
      .plus(toDecimal(payables))
      .plus(toDecimal(otherCurrentLiabilities)),
  );
}

export function calculateClosingRetainedEarnings(
  openingRetainedEarnings: MonetaryAmount,
  profitAfterTax: MonetaryAmount,
  retainedEarningsAdjustments: MonetaryAmount,
): MonetaryAmount {
  return toMonetaryAmount(
    toDecimal(openingRetainedEarnings)
      .plus(toDecimal(profitAfterTax))
      .plus(toDecimal(retainedEarningsAdjustments)),
  );
}

export function calculateTotalEquity(
  promoterCapital: MonetaryAmount,
  closingRetainedEarnings: MonetaryAmount,
  otherEquity: MonetaryAmount,
): MonetaryAmount {
  return toMonetaryAmount(
    toDecimal(promoterCapital)
      .plus(toDecimal(closingRetainedEarnings))
      .plus(toDecimal(otherEquity)),
  );
}

export function calculateBalanceDifference(
  totalAssets: MonetaryAmount,
  totalLiabilities: MonetaryAmount,
  totalEquity: MonetaryAmount,
): MonetaryAmount {
  return toMonetaryAmount(
    toDecimal(totalAssets)
      .minus(toDecimal(totalLiabilities))
      .minus(toDecimal(totalEquity)),
  );
}

export function calculateRetainedEarningsSchedule(
  input: BalanceSheetRetainedEarningsInput,
): CalculationResult<BalanceSheetRetainedEarningsSchedule> {
  const errors: CalculationError[] = [
    ...validateYearSeries(
      input.years,
      "years",
      "EMPTY_RETAINED_EARNINGS_SCHEDULE",
      "INVALID_RETAINED_EARNINGS_YEAR",
      "DUPLICATE_RETAINED_EARNINGS_YEAR",
      "INVALID_RETAINED_EARNINGS_YEAR_SEQUENCE",
    ),
  ];

  if (!input.openingRetainedEarnings?.source) {
    errors.push({
      code: "MISSING_OPENING_RETAINED_EARNINGS",
      message: "A source-backed opening retained-earnings balance is required.",
      path: "openingRetainedEarnings",
    });
  }

  for (const [index, year] of input.years.entries()) {
    pushError(
      errors,
      requiredAmountError(
        year.profitAfterTax,
        "years." + index + ".profitAfterTax",
        "Profit after tax",
      ),
    );
    pushError(
      errors,
      requiredAmountError(
        year.retainedEarningsAdjustments,
        "years." + index + ".retainedEarningsAdjustments",
        "Retained-earnings adjustments",
      ),
    );
  }

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  let openingRetainedEarnings = input.openingRetainedEarnings.value;
  const years = input.years.map((year) => {
    const closingRetainedEarnings = calculateClosingRetainedEarnings(
      openingRetainedEarnings,
      year.profitAfterTax,
      year.retainedEarningsAdjustments,
    );
    const result = {
      year: year.year,
      openingRetainedEarnings,
      profitAfterTax: year.profitAfterTax,
      retainedEarningsAdjustments: year.retainedEarningsAdjustments,
      closingRetainedEarnings,
    };
    openingRetainedEarnings = closingRetainedEarnings;
    return result;
  });

  return calculationSuccess({
    projectId: input.projectId,
    openingRetainedEarnings: input.openingRetainedEarnings,
    years,
  });
}

function calculateBalanceSheetYearUnchecked(
  input: BalanceSheetYearInput,
  openingRetainedEarnings: MonetaryAmount,
): BalanceSheetYear {
  const netFixedAssets = toMonetaryAmount(
    toDecimal(input.grossFixedAssets).minus(
      toDecimal(input.accumulatedDepreciation),
    ),
  );
  const totalCurrentAssets = calculateTotalCurrentAssets(
    input.inventory,
    input.receivables,
    input.otherCurrentAssets,
    input.cashAndBank,
  );
  const totalAssets = toMonetaryAmount(
    toDecimal(netFixedAssets).plus(toDecimal(totalCurrentAssets)),
  );
  const totalCurrentLiabilities = calculateTotalCurrentLiabilities(
    input.currentDebt,
    input.payables,
    input.otherCurrentLiabilities,
  );
  const totalLiabilities = calculateTotalLiabilities(
    input.longTermLoanOutstanding,
    input.currentDebt,
    input.payables,
    input.otherCurrentLiabilities,
  );
  const closingRetainedEarnings = calculateClosingRetainedEarnings(
    openingRetainedEarnings,
    input.profitAfterTax,
    input.retainedEarningsAdjustments,
  );
  const totalEquity = calculateTotalEquity(
    input.promoterCapital,
    closingRetainedEarnings,
    input.otherEquity,
  );
  const balanceDifference = calculateBalanceDifference(
    totalAssets,
    totalLiabilities,
    totalEquity,
  );

  return {
    year: input.year,
    grossFixedAssets: input.grossFixedAssets,
    accumulatedDepreciation: input.accumulatedDepreciation,
    netFixedAssets,
    inventory: input.inventory,
    receivables: input.receivables,
    otherCurrentAssets: input.otherCurrentAssets,
    cashAndBank: input.cashAndBank,
    totalCurrentAssets,
    totalAssets,
    longTermLoanOutstanding: input.longTermLoanOutstanding,
    currentDebt: input.currentDebt,
    payables: input.payables,
    otherCurrentLiabilities: input.otherCurrentLiabilities,
    totalCurrentLiabilities,
    totalLiabilities,
    promoterCapital: input.promoterCapital,
    openingRetainedEarnings,
    profitAfterTax: input.profitAfterTax,
    retainedEarningsAdjustments: input.retainedEarningsAdjustments,
    closingRetainedEarnings,
    otherEquity: input.otherEquity,
    totalEquity,
    balanceDifference,
    isBalanced: toDecimal(balanceDifference).isZero(),
  };
}

export function calculateBalanceSheetSchedule(
  input: BalanceSheetProjectionInput,
): CalculationResult<BalanceSheetSchedule> {
  const errors = [...validateBalanceSheetYearInputs(input.years)];

  if (!input.openingRetainedEarnings?.source) {
    errors.push({
      code: "MISSING_OPENING_RETAINED_EARNINGS",
      message: "A source-backed opening retained-earnings balance is required.",
      path: "openingRetainedEarnings",
    });
  }

  if (errors.length > 0) {
    return calculationFailure(...errors);
  }

  let openingRetainedEarnings = input.openingRetainedEarnings.value;
  const years = input.years.map((yearInput) => {
    const year = calculateBalanceSheetYearUnchecked(
      yearInput,
      openingRetainedEarnings,
    );
    openingRetainedEarnings = year.closingRetainedEarnings;
    return year;
  });

  return calculationSuccess({
    projectId: input.projectId,
    openingRetainedEarnings: input.openingRetainedEarnings,
    years,
  });
}
