import type {
  CalculationError,
  CalculationResult,
} from "../shared/calculation";
import { calculationFailure, calculationSuccess } from "../shared/calculation";
import { monetaryAmount, toDecimal, toMonetaryAmount } from "../shared/decimal";
import { validateInvestmentCashFlowSeries } from "./calculations";
import type {
  ProjectInvestmentCashFlowCompositionInput,
  ProjectInvestmentCashFlowSeries,
} from "./investment-returns";

const forbiddenProjectReturnFields = [
  "loanDisbursement",
  "promoterContribution",
  "principalRepayment",
  "cashInterestPaid",
  "profitAfterTax",
  "ebitda",
  "ebit",
  "closingCash",
  "netCashMovement",
] as const;

function requiredSourceBackedAmountError(
  assumption:
    { readonly value?: unknown; readonly source?: unknown } | undefined,
  path: string,
  label: string,
  nonNegative: boolean,
): CalculationError | undefined {
  if (!assumption?.source) {
    return {
      code: "MISSING_PROJECT_RETURN_COMPONENT_SOURCE",
      message: label + " must be explicitly source-backed.",
      path,
    };
  }
  try {
    const value = monetaryAmount(assumption.value);
    if (nonNegative && toDecimal(value).isNegative()) {
      return {
        code: "NEGATIVE_PROJECT_RETURN_COMPONENT",
        message: label + " must not be negative.",
        path: path + ".value",
      };
    }
  } catch {
    return {
      code: "INVALID_PROJECT_RETURN_COMPONENT",
      message: label + " must be a finite canonical monetary amount.",
      path: path + ".value",
    };
  }
}

function optionalSourceBackedAmountError(
  assumption:
    { readonly value?: unknown; readonly source?: unknown } | undefined,
  path: string,
  label: string,
): CalculationError | undefined {
  if (assumption === undefined) return undefined;
  return requiredSourceBackedAmountError(assumption, path, label, true);
}

export function composeProjectInvestmentCashFlowSeries(
  input: ProjectInvestmentCashFlowCompositionInput,
): CalculationResult<ProjectInvestmentCashFlowSeries> {
  const errors: CalculationError[] = [];
  const seenPeriods = new Set<number>();

  if (input.periods.length === 0) {
    errors.push({
      code: "EMPTY_PROJECT_RETURN_COMPONENT_SCHEDULE",
      message: "Project-return composition requires period 0.",
      path: "periods",
    });
  }

  for (const [index, period] of input.periods.entries()) {
    const path = "periods." + index;
    if (!Number.isInteger(period.periodIndex) || period.periodIndex < 0) {
      errors.push({
        code: "INVALID_PROJECT_RETURN_COMPONENT_PERIOD",
        message: "Period index must be a non-negative integer.",
        path: path + ".periodIndex",
      });
    }
    if (seenPeriods.has(period.periodIndex)) {
      errors.push({
        code: "DUPLICATE_PROJECT_RETURN_COMPONENT_PERIOD",
        message: "Each project-return period must be unique.",
        path: path + ".periodIndex",
      });
    } else {
      seenPeriods.add(period.periodIndex);
    }
    if (period.periodIndex !== index) {
      errors.push({
        code: "INVALID_PROJECT_RETURN_COMPONENT_PERIOD_SEQUENCE",
        message: "Project-return periods must be ordered from 0 through N.",
        path: path + ".periodIndex",
      });
    }

    for (const field of forbiddenProjectReturnFields) {
      if (Object.prototype.hasOwnProperty.call(period, field)) {
        errors.push({
          code: "FORBIDDEN_PROJECT_RETURN_SOURCE_FIELD",
          message:
            "Project-return cash flow must not include financing, accounting-profit, or closing-cash fields.",
          path: path + "." + field,
        });
      }
    }

    const componentFields = [
      ["initialInvestment", "Initial investment", true],
      ["operatingProjectCashFlow", "Operating project cash flow", false],
      ["workingCapitalInvestment", "Working-capital investment", true],
      ["capitalExpenditure", "Capital expenditure", true],
      [
        "otherExplicitInvestmentCashFlow",
        "Other explicit investment cash flow",
        false,
      ],
    ] as const;
    for (const [field, label, nonNegative] of componentFields) {
      const error = requiredSourceBackedAmountError(
        period.components?.[field],
        path + ".components." + field,
        label,
        nonNegative,
      );
      if (error) errors.push(error);
    }
    for (const [field, label] of [
      ["terminalValue", "Terminal value"],
      ["workingCapitalRecovery", "Working-capital recovery"],
    ] as const) {
      const error = optionalSourceBackedAmountError(
        period.components?.[field],
        path + ".components." + field,
        label,
      );
      if (error) errors.push(error);
    }

    if (period.periodIndex > 0) {
      try {
        const laterInitialInvestment = monetaryAmount(
          period.components?.initialInvestment?.value,
        );
        if (!toDecimal(laterInitialInvestment).isZero()) {
          errors.push({
            code: "INITIAL_INVESTMENT_OUTSIDE_PERIOD_ZERO",
            message:
              "Initial investment belongs only in period 0; later investment must be explicit capital expenditure or working capital.",
            path: path + ".components.initialInvestment.value",
          });
        }
      } catch {
        // The component validator above reports the malformed value.
      }
    }
  }

  if (input.periods.length > 0 && input.periods[0]?.periodIndex !== 0) {
    errors.push({
      code: "MISSING_PROJECT_RETURN_PERIOD_ZERO",
      message: "Project-return composition requires explicit period 0.",
      path: "periods.0.periodIndex",
    });
  }
  if (errors.length > 0) return calculationFailure(...errors);

  const periods = input.periods.map((period) => {
    const components = period.components;
    const cashFlow = toDecimal(components.operatingProjectCashFlow.value)
      .plus(
        components.terminalValue
          ? toDecimal(components.terminalValue.value)
          : toDecimal(monetaryAmount("0")),
      )
      .plus(
        components.workingCapitalRecovery
          ? toDecimal(components.workingCapitalRecovery.value)
          : toDecimal(monetaryAmount("0")),
      )
      .plus(toDecimal(components.otherExplicitInvestmentCashFlow.value))
      .minus(toDecimal(components.initialInvestment.value))
      .minus(toDecimal(components.workingCapitalInvestment.value))
      .minus(toDecimal(components.capitalExpenditure.value));
    return {
      periodIndex: period.periodIndex,
      cashFlow: toMonetaryAmount(cashFlow),
      components,
    };
  });

  const series: ProjectInvestmentCashFlowSeries = {
    projectId: input.projectId,
    perspective: "PROJECT_RETURN",
    periods,
  };
  const validationErrors = validateInvestmentCashFlowSeries(series);
  return validationErrors.length > 0
    ? calculationFailure(...validationErrors)
    : calculationSuccess(series);
}
