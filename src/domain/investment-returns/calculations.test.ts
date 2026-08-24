import { describe, expect, it } from "vitest";

import type { Assumption } from "../shared/assumptions";
import type { CalculationResult } from "../shared/calculation";
import {
  decimalValue,
  monetaryAmount,
  percentage,
  toDecimal,
} from "../shared/decimal";
import type { DecimalValue, MonetaryAmount, Percentage } from "../shared/types";
import { sampleUserSource } from "../testing/domain-fixtures";
import { composeProjectInvestmentCashFlowSeries } from "./adapters";
import {
  calculateDiscountedPaybackPeriod,
  calculateInternalRateOfReturn,
  calculateInvestmentReturns,
  calculateNetPresentValue,
  calculateProfitabilityIndex,
  calculateSimplePaybackPeriod,
  defaultIrrSearchPolicy,
  validateInvestmentCashFlowSeries,
} from "./calculations";
import type {
  DefinedInvestmentReturnMetric,
  InvestmentCashFlowSeries,
  InvestmentReturnMetric,
  IrrSearchPolicy,
  ProjectInvestmentCashFlowComponents,
  ProjectInvestmentCashFlowCompositionInput,
} from "./investment-returns";

function unwrap<TValue>(result: CalculationResult<TValue>): TValue {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.errors.map((error) => error.code).join(", "));
  }
  return result.value;
}

function expectError<TValue>(
  result: CalculationResult<TValue>,
  code: string,
): void {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected calculation failure.");
  expect(result.errors.map((error) => error.code)).toContain(code);
}

function definedValue<TValue extends DecimalValue>(
  result: InvestmentReturnMetric<TValue>,
): TValue {
  expect(result.status).toBe("DEFINED");
  return (result as DefinedInvestmentReturnMetric<TValue>).value;
}

function expectUndefined(
  result: InvestmentReturnMetric,
  status: InvestmentReturnMetric["status"],
): void {
  expect(result).toEqual({ status });
  expect(result).not.toHaveProperty("value");
}

function m(value: string): MonetaryAmount {
  return monetaryAmount(value);
}

function assumedAmount(value: string): Assumption<MonetaryAmount> {
  return { value: m(value), source: sampleUserSource };
}

function assumedRate(value: string): Assumption<Percentage> {
  return { value: percentage(value), source: sampleUserSource };
}

function series(
  cashFlows: readonly string[],
  perspective: InvestmentCashFlowSeries["perspective"] = "PROJECT_RETURN",
): InvestmentCashFlowSeries {
  return {
    projectId: "project-investment-returns",
    perspective,
    periods: cashFlows.map((cashFlow, periodIndex) => ({
      periodIndex,
      cashFlow: m(cashFlow),
    })),
  };
}

function expectDecimalClose(
  actual: string,
  expected: string,
  tolerance = "0.000000000000000000000001",
): void {
  expect(
    toDecimal(decimalValue(actual))
      .minus(toDecimal(decimalValue(expected)))
      .abs()
      .lessThanOrEqualTo(toDecimal(decimalValue(tolerance))),
  ).toBe(true);
}

function components(
  overrides: Partial<
    Record<keyof ProjectInvestmentCashFlowComponents, string>
  > = {},
): ProjectInvestmentCashFlowComponents {
  return {
    initialInvestment: assumedAmount(overrides.initialInvestment ?? "0"),
    operatingProjectCashFlow: assumedAmount(
      overrides.operatingProjectCashFlow ?? "0",
    ),
    workingCapitalInvestment: assumedAmount(
      overrides.workingCapitalInvestment ?? "0",
    ),
    capitalExpenditure: assumedAmount(overrides.capitalExpenditure ?? "0"),
    terminalValue: assumedAmount(overrides.terminalValue ?? "0"),
    workingCapitalRecovery: assumedAmount(
      overrides.workingCapitalRecovery ?? "0",
    ),
    otherExplicitInvestmentCashFlow: assumedAmount(
      overrides.otherExplicitInvestmentCashFlow ?? "0",
    ),
  };
}

function realisticComposition(): ProjectInvestmentCashFlowCompositionInput {
  return {
    projectId: "project-investment-returns",
    periods: [
      {
        periodIndex: 0,
        components: components({ initialInvestment: "1000" }),
      },
      {
        periodIndex: 1,
        components: components({
          operatingProjectCashFlow: "300",
          workingCapitalInvestment: "50",
        }),
      },
      {
        periodIndex: 2,
        components: components({
          operatingProjectCashFlow: "350",
          capitalExpenditure: "100",
        }),
      },
      {
        periodIndex: 3,
        components: components({ operatingProjectCashFlow: "400" }),
      },
      {
        periodIndex: 4,
        components: components({
          operatingProjectCashFlow: "450",
          terminalValue: "100",
          workingCapitalRecovery: "50",
        }),
      },
    ],
  };
}

describe("investment cash-flow validation", () => {
  it("accepts sequential 0..N periods and signed or zero cash flows", () => {
    expect(
      validateInvestmentCashFlowSeries(series(["-100", "0", "120"])),
    ).toEqual([]);
  });

  it("rejects an empty series", () => {
    expect(
      validateInvestmentCashFlowSeries({
        projectId: "project",
        perspective: "PROJECT_RETURN",
        periods: [],
      }).map((error) => error.code),
    ).toContain("EMPTY_INVESTMENT_CASH_FLOW_SERIES");
  });

  it("rejects negative, duplicate, missing, and unordered periods", () => {
    const negative = series(["-1"]);
    expect(
      validateInvestmentCashFlowSeries({
        ...negative,
        periods: [{ periodIndex: -1, cashFlow: m("-1") }],
      }).map((error) => error.code),
    ).toContain("INVALID_INVESTMENT_CASH_FLOW_PERIOD");

    const duplicate = series(["-1", "2"]);
    expect(
      validateInvestmentCashFlowSeries({
        ...duplicate,
        periods: [
          { periodIndex: 0, cashFlow: m("-1") },
          { periodIndex: 0, cashFlow: m("2") },
        ],
      }).map((error) => error.code),
    ).toContain("DUPLICATE_INVESTMENT_CASH_FLOW_PERIOD");

    expect(
      validateInvestmentCashFlowSeries({
        ...duplicate,
        periods: [
          { periodIndex: 1, cashFlow: m("-1") },
          { periodIndex: 2, cashFlow: m("2") },
        ],
      }).map((error) => error.code),
    ).toContain("MISSING_INVESTMENT_CASH_FLOW_PERIOD_ZERO");

    expect(
      validateInvestmentCashFlowSeries({
        ...duplicate,
        periods: [
          { periodIndex: 0, cashFlow: m("-1") },
          { periodIndex: 2, cashFlow: m("2") },
        ],
      }).map((error) => error.code),
    ).toContain("INVALID_INVESTMENT_CASH_FLOW_PERIOD_SEQUENCE");
  });

  it("rejects malformed cash flow without returning NaN or Infinity", () => {
    const malformed = {
      ...series(["-1"]),
      periods: [{ periodIndex: 0, cashFlow: "NaN" }],
    } as unknown as InvestmentCashFlowSeries;
    expect(
      validateInvestmentCashFlowSeries(malformed).map((error) => error.code),
    ).toContain("INVALID_INVESTMENT_CASH_FLOW");
  });

  it("distinguishes explicit project and equity perspectives", () => {
    expect(validateInvestmentCashFlowSeries(series(["-100", "120"]))).toEqual(
      [],
    );
    expect(
      validateInvestmentCashFlowSeries(series(["-40", "55"], "EQUITY_RETURN")),
    ).toEqual([]);
  });
});

describe("net present value", () => {
  it("equals the undiscounted cash-flow sum at a zero discount rate", () => {
    const result = unwrap(
      calculateNetPresentValue(
        series(["-100", "30", "40", "50"]),
        assumedRate("0"),
      ),
    );
    expect(result.npv).toBe("20");
    expect(result.rows.map((row) => row.discountFactor)).toEqual([
      "1",
      "1",
      "1",
      "1",
    ]);
  });

  it("calculates a one-period zero NPV case", () => {
    const result = unwrap(
      calculateNetPresentValue(series(["-100", "110"]), assumedRate("10")),
    );
    expect(result.npv).toBe("0");
  });

  it("calculates positive and negative NPV", () => {
    expect(
      unwrap(
        calculateNetPresentValue(series(["-100", "120"]), assumedRate("10")),
      ).npv,
    ).toBe("9.0909090909090909090909090909090909091");
    expect(
      toDecimal(
        unwrap(
          calculateNetPresentValue(series(["-100", "100"]), assumedRate("10")),
        ).npv,
      ).isNegative(),
    ).toBe(true);
  });

  it("does not discount period 0", () => {
    const result = unwrap(
      calculateNetPresentValue(series(["-123.456", "0"]), assumedRate("37.5")),
    );
    expect(result.rows[0]).toMatchObject({
      periodIndex: 0,
      cashFlow: "-123.456",
      discountFactor: "1",
      presentValue: "-123.456",
      cumulativePresentValue: "-123.456",
    });
  });

  it("discounts every later cash flow by its exact period index", () => {
    const result = unwrap(
      calculateNetPresentValue(
        series(["-100", "110", "121"]),
        assumedRate("10"),
      ),
    );
    expect(result.rows.map((row) => row.presentValue)).toEqual([
      "-100",
      "100",
      "100",
    ]);
    expect(result.npv).toBe("100");
  });

  it("provides exact row and cumulative reconciliation", () => {
    const result = unwrap(
      calculateNetPresentValue(
        series(["-100", "0", "156.25"]),
        assumedRate("25"),
      ),
    );
    expect(result.rows.map((row) => row.presentValue)).toEqual([
      "-100",
      "0",
      "100",
    ]);
    expect(result.rows.map((row) => row.cumulativePresentValue)).toEqual([
      "-100",
      "-100",
      "0",
    ]);
    expect(result.npv).toBe("0");
  });

  it("preserves long Decimal.js precision without intermediate rounding", () => {
    const result = unwrap(
      calculateNetPresentValue(series(["-1", "1"]), assumedRate("3")),
    );
    expect(result.rows[1]!.discountFactor).toBe(
      "0.9708737864077669902912621359223300970874",
    );
    expect(result.npv).toBe("-0.0291262135922330097087378640776699029126");
  });

  it("accepts a fully explicit terminal recovery in the net series", () => {
    const result = unwrap(
      calculateNetPresentValue(series(["-100", "0", "121"]), assumedRate("10")),
    );
    expect(result.rows[2]!.presentValue).toBe("100");
    expect(result.npv).toBe("0");
  });

  it("rejects negative, missing-source, and malformed discount rates", () => {
    expectError(
      calculateNetPresentValue(series(["-100", "110"]), assumedRate("-1")),
      "NEGATIVE_INVESTMENT_RETURN_DISCOUNT_RATE",
    );
    expectError(
      calculateNetPresentValue(series(["-100", "110"]), {
        value: percentage("10"),
      } as Assumption<Percentage>),
      "MISSING_INVESTMENT_RETURN_DISCOUNT_RATE_SOURCE",
    );
    expectError(
      calculateNetPresentValue(series(["-100", "110"]), {
        value: "Infinity",
        source: sampleUserSource,
      } as unknown as Assumption<Percentage>),
      "INVALID_INVESTMENT_RETURN_DISCOUNT_RATE",
    );
  });
});

describe("internal rate of return", () => {
  it("returns an exact zero-percent IRR when undiscounted cash flows sum to zero", () => {
    const result = unwrap(
      calculateInternalRateOfReturn(series(["-100", "100"])),
    );
    expect(definedValue(result.irr)).toBe("0");
    expect(result.residualNpv).toBe("0");
    expect(result.iterations).toBe(0);
  });

  it("calculates a standard conventional project deterministically", () => {
    const input = series(["-100", "30", "40", "50"]);
    const first = unwrap(calculateInternalRateOfReturn(input));
    const second = unwrap(calculateInternalRateOfReturn(input));
    expect(first).toEqual(second);
    expect(first.signChangeCount).toBe(1);
    expect(first.iterations).toBeGreaterThan(0);
    expectDecimalClose(
      definedValue(first.irr),
      "8.896339469334993531776567968686894276083",
      "0.000000000001",
    );
    expect(
      toDecimal(first.residualNpv!)
        .abs()
        .lessThanOrEqualTo(toDecimal(defaultIrrSearchPolicy.npvTolerance)),
    ).toBe(true);
  });

  it("calculates an exact known 100% IRR", () => {
    const result = unwrap(
      calculateInternalRateOfReturn(series(["-100", "200"])),
    );
    expect(definedValue(result.irr)).toBe("100");
    expect(result.residualNpv).toBe("0");
  });

  it("calculates a low positive IRR", () => {
    const result = unwrap(
      calculateInternalRateOfReturn(series(["-100", "101"])),
    );
    expectDecimalClose(definedValue(result.irr), "1");
  });

  it("expands the bracket for a high IRR", () => {
    const result = unwrap(
      calculateInternalRateOfReturn(series(["-100", "1000"])),
    );
    expectDecimalClose(definedValue(result.irr), "900");
  });

  it("supports a mathematically valid negative IRR", () => {
    const result = unwrap(
      calculateInternalRateOfReturn(series(["-100", "80"])),
    );
    expectDecimalClose(definedValue(result.irr), "-20");
  });

  it("accepts a valid IRR immediately above minus 100 percent at the lower bracket boundary", () => {
    const result = unwrap(
      calculateInternalRateOfReturn(
        series(["-1", "0.000000000000000000000000000001"]),
      ),
    );
    expect(definedValue(result.irr)).toBe("-99.9999999999999999999999999999");
    expect(result.residualNpv).toBe("0");
  });

  it("accepts a root exactly on an expanded upper bracket boundary", () => {
    const result = unwrap(
      calculateInternalRateOfReturn(series(["-100", "400"])),
    );
    expect(definedValue(result.irr)).toBe("300");
    expect(result.residualNpv).toBe("0");
  });

  it("returns undefined when cash flows have no sign change", () => {
    const allPositive = unwrap(
      calculateInternalRateOfReturn(series(["100", "50", "20"])),
    );
    const allNegative = unwrap(
      calculateInternalRateOfReturn(series(["-100", "-50", "0"])),
    );
    const zeroOnly = unwrap(
      calculateInternalRateOfReturn(series(["0", "0", "0"])),
    );
    expectUndefined(allPositive.irr, "UNDEFINED_NO_SIGN_CHANGE");
    expectUndefined(allNegative.irr, "UNDEFINED_NO_SIGN_CHANGE");
    expectUndefined(zeroOnly.irr, "UNDEFINED_NO_SIGN_CHANGE");
    expect(allPositive.iterations).toBe(0);
    expect(allNegative.iterations).toBe(0);
    expect(zeroOnly.iterations).toBe(0);
  });

  it("returns explicit ambiguity for multiple sign changes", () => {
    const result = unwrap(
      calculateInternalRateOfReturn(series(["-100", "230", "-132"])),
    );
    expect(result.signChangeCount).toBe(2);
    expectUndefined(result.irr, "AMBIGUOUS_MULTIPLE_IRR_POSSIBLE");
    expect(result).not.toHaveProperty("residualNpv");
  });

  it("does not count leading, intervening, or trailing zero cash flows as sign changes", () => {
    const result = unwrap(
      calculateInternalRateOfReturn(
        series(["0", "-100", "0", "0", "120", "0"]),
      ),
    );
    expect(result.signChangeCount).toBe(1);
    expect(result.irr.status).toBe("DEFINED");
  });

  it("returns deterministic convergence failure when a root cannot be bracketed under policy", () => {
    const policy: IrrSearchPolicy = {
      ...defaultIrrSearchPolicy,
      maximumBracketExpansions: 0,
    };
    const result = unwrap(
      calculateInternalRateOfReturn(series(["-100", "1000"]), policy),
    );
    expectUndefined(result.irr, "NUMERICAL_CONVERGENCE_FAILURE");
    expect(result.iterations).toBe(0);
  });

  it("returns convergence failure at an explicit iteration limit", () => {
    const policy: IrrSearchPolicy = {
      ...defaultIrrSearchPolicy,
      maximumIterations: 1,
      npvTolerance: m("0"),
      rateTolerance: decimalValue("0.000000000000000000000000000000000000001"),
    };
    const result = unwrap(
      calculateInternalRateOfReturn(series(["-100", "30", "40", "50"]), policy),
    );
    expectUndefined(result.irr, "NUMERICAL_CONVERGENCE_FAILURE");
    expect(result.iterations).toBe(1);
  });

  it("validates numerical search safeguards", () => {
    expectError(
      calculateInternalRateOfReturn(series(["-100", "110"]), {
        ...defaultIrrSearchPolicy,
        maximumIterations: 0,
      }),
      "INVALID_IRR_MAXIMUM_ITERATIONS",
    );
    expectError(
      calculateInternalRateOfReturn(series(["-100", "110"]), {
        ...defaultIrrSearchPolicy,
        maximumBracketExpansions: -1,
      }),
      "INVALID_IRR_BRACKET_EXPANSIONS",
    );
    expectError(
      calculateInternalRateOfReturn(series(["-100", "110"]), {
        ...defaultIrrSearchPolicy,
        rateTolerance: decimalValue("0"),
      }),
      "INVALID_IRR_RATE_TOLERANCE",
    );
  });

  it("keeps Decimal.js NPV within the configured tolerance for every defined boundary class", () => {
    const inputs = [
      series(["-100", "100"]),
      series(["-100", "110"]),
      series(["-100", "80"]),
      series(["-100", "1000"]),
      series(["-1", "0.000000000000000000000000000001"]),
      series(["-100", "200"]),
      series(["-100", "400"]),
      series(["-10000000", "2500000", "3000000", "3500000", "4000000"]),
    ];

    for (const input of inputs) {
      const irr = unwrap(calculateInternalRateOfReturn(input));
      const rateFactor = toDecimal(definedValue(irr.irr)).dividedBy("100");
      const discountBase = toDecimal(decimalValue("1")).plus(rateFactor);
      const npvAtReturnedIrr = input.periods.reduce(
        (npv, period) =>
          npv.plus(
            toDecimal(period.cashFlow).dividedBy(
              discountBase.pow(period.periodIndex),
            ),
          ),
        toDecimal(m("0")),
      );
      expect(
        npvAtReturnedIrr
          .abs()
          .lessThanOrEqualTo(toDecimal(defaultIrrSearchPolicy.npvTolerance)),
      ).toBe(true);
      expect(
        toDecimal(irr.residualNpv!)
          .abs()
          .lessThanOrEqualTo(toDecimal(defaultIrrSearchPolicy.npvTolerance)),
      ).toBe(true);
    }
  });
});

describe("simple payback", () => {
  it("calculates exact integer-period recovery", () => {
    const result = unwrap(
      calculateSimplePaybackPeriod(series(["-100", "50", "50"])),
    );
    expect(definedValue(result.paybackPeriod)).toBe("2");
    expect(result.recoveryPeriodIndex).toBe(2);
  });

  it("calculates fractional recovery using the recovery-period inflow", () => {
    const result = unwrap(
      calculateSimplePaybackPeriod(series(["-100", "30", "40", "50"])),
    );
    expect(definedValue(result.paybackPeriod)).toBe("2.6");
    expect(result.rows.map((row) => row.cumulativeCashFlow)).toEqual([
      "-100",
      "-70",
      "-30",
      "20",
    ]);
  });

  it("supports recovery during the first annual period", () => {
    const result = unwrap(
      calculateSimplePaybackPeriod(series(["-100", "200"])),
    );
    expect(definedValue(result.paybackPeriod)).toBe("0.5");
    expect(result.recoveryPeriodIndex).toBe(1);
  });

  it("returns zero when cumulative cash flow is never negative", () => {
    const result = unwrap(
      calculateSimplePaybackPeriod(series(["0", "0", "10"])),
    );
    expect(definedValue(result.paybackPeriod)).toBe("0");
    expect(result.recoveryPeriodIndex).toBe(0);
  });

  it("returns not recovered when the horizon is insufficient", () => {
    const result = unwrap(
      calculateSimplePaybackPeriod(series(["-100", "20", "20"])),
    );
    expectUndefined(result.paybackPeriod, "NOT_RECOVERED_WITHIN_HORIZON");
    expect(result).not.toHaveProperty("recoveryPeriodIndex");
  });

  it("supports multiple negative investment periods", () => {
    const result = unwrap(
      calculateSimplePaybackPeriod(series(["-100", "-20", "60", "60"])),
    );
    expect(result.rows.map((row) => row.cumulativeCashFlow)).toEqual([
      "-100",
      "-120",
      "-60",
      "0",
    ]);
    expect(definedValue(result.paybackPeriod)).toBe("3");
  });

  it("uses conventional first recovery even if a later non-conventional flow makes cumulative cash negative again", () => {
    const result = unwrap(
      calculateSimplePaybackPeriod(series(["-100", "120", "-50", "40"])),
    );
    expect(definedValue(result.paybackPeriod)).toBe(
      "0.8333333333333333333333333333333333333333",
    );
    expect(result.recoveryPeriodIndex).toBe(1);
    expect(result.rows.map((row) => row.cumulativeCashFlow)).toEqual([
      "-100",
      "20",
      "-30",
      "10",
    ]);
  });

  it("preserves long Decimal.js interpolation precision", () => {
    const result = unwrap(
      calculateSimplePaybackPeriod(series(["-1", "0.1", "3"])),
    );
    expect(definedValue(result.paybackPeriod)).toBe("1.3");
  });

  it("reconciles every cumulative row exactly", () => {
    const input = series(["-100.1", "20.02", "30.03", "60.06"]);
    const result = unwrap(calculateSimplePaybackPeriod(input));
    let cumulative = toDecimal(m("0"));
    for (const [index, row] of result.rows.entries()) {
      cumulative = cumulative.plus(toDecimal(input.periods[index]!.cashFlow));
      expect(row.cumulativeCashFlow).toBe(cumulative.toFixed());
    }
  });
});

describe("discounted payback", () => {
  it("calculates exact discounted recovery", () => {
    const result = unwrap(
      calculateDiscountedPaybackPeriod(
        series(["-100", "0", "121"]),
        assumedRate("10"),
      ),
    );
    expect(result.rows.map((row) => row.presentValue)).toEqual([
      "-100",
      "0",
      "100",
    ]);
    expect(definedValue(result.paybackPeriod)).toBe("2");
  });

  it("calculates fractional discounted recovery", () => {
    const result = unwrap(
      calculateDiscountedPaybackPeriod(
        series(["-100", "60", "60"]),
        assumedRate("10"),
      ),
    );
    expectDecimalClose(
      definedValue(result.paybackPeriod),
      "1.916666666666666666666666666666666666667",
    );
  });

  it("can remain unrecovered even when simple payback recovers", () => {
    const input = series(["-100", "60", "50"]);
    const simple = unwrap(calculateSimplePaybackPeriod(input));
    const discounted = unwrap(
      calculateDiscountedPaybackPeriod(input, assumedRate("20")),
    );
    expect(definedValue(simple.paybackPeriod)).toBe("1.8");
    expectUndefined(discounted.paybackPeriod, "NOT_RECOVERED_WITHIN_HORIZON");
  });

  it("returns not recovered when discounted inflows are insufficient", () => {
    const result = unwrap(
      calculateDiscountedPaybackPeriod(
        series(["-100", "20", "20"]),
        assumedRate("10"),
      ),
    );
    expectUndefined(result.paybackPeriod, "NOT_RECOVERED_WITHIN_HORIZON");
  });

  it("equals simple payback at a zero discount rate", () => {
    const input = series(["-100", "30", "40", "50"]);
    const simple = unwrap(calculateSimplePaybackPeriod(input));
    const discounted = unwrap(
      calculateDiscountedPaybackPeriod(input, assumedRate("0")),
    );
    expect(definedValue(discounted.paybackPeriod)).toBe(
      definedValue(simple.paybackPeriod),
    );
  });

  it("retains long precision in discounted interpolation", () => {
    const result = unwrap(
      calculateDiscountedPaybackPeriod(
        series(["-1", "0.7", "0.7"]),
        assumedRate("3"),
      ),
    );
    expect(definedValue(result.paybackPeriod).length).toBeGreaterThan(25);
    expect(result.rows[1]!.presentValue.length).toBeGreaterThan(25);
  });
});

describe("profitability index", () => {
  it("calculates PI greater than one", () => {
    const result = unwrap(
      calculateProfitabilityIndex(series(["-100", "110"]), assumedRate("0")),
    );
    expect(result.initialInvestment).toBe("100");
    expect(result.presentValueOfFuturePositiveCashFlows).toBe("110");
    expect(definedValue(result.profitabilityIndex)).toBe("1.1");
  });

  it("calculates PI equal to one", () => {
    const result = unwrap(
      calculateProfitabilityIndex(
        series(["-100", "0", "121"]),
        assumedRate("10"),
      ),
    );
    expect(definedValue(result.profitabilityIndex)).toBe("1");
  });

  it("calculates PI below one for a negative-NPV conventional project", () => {
    const result = unwrap(
      calculateProfitabilityIndex(series(["-100", "90"]), assumedRate("0")),
    );
    expect(definedValue(result.profitabilityIndex)).toBe("0.9");
  });

  it("returns undefined for zero initial investment", () => {
    const result = unwrap(
      calculateProfitabilityIndex(series(["0", "100"]), assumedRate("10")),
    );
    expectUndefined(
      result.profitabilityIndex,
      "UNDEFINED_ZERO_INITIAL_INVESTMENT",
    );
  });

  it("rejects a positive period-0 flow as a PI pattern", () => {
    const result = unwrap(
      calculateProfitabilityIndex(series(["100", "20"]), assumedRate("10")),
    );
    expectUndefined(result.profitabilityIndex, "INVALID_CASH_FLOW_PATTERN");
  });

  it("returns explicit invalid-pattern status for later negative investment", () => {
    const result = unwrap(
      calculateProfitabilityIndex(
        series(["-100", "200", "-50"]),
        assumedRate("10"),
      ),
    );
    expectUndefined(result.profitabilityIndex, "INVALID_CASH_FLOW_PATTERN");
  });

  it("reconciles PI numerator to future positive discounted rows", () => {
    const input = series(["-100", "30", "40", "50"]);
    const npv = unwrap(calculateNetPresentValue(input, assumedRate("10")));
    const result = unwrap(
      calculateProfitabilityIndex(input, assumedRate("10")),
    );
    const expected = npv.rows
      .slice(1)
      .filter((row) => toDecimal(row.cashFlow).isPositive())
      .reduce(
        (total, row) => total.plus(toDecimal(row.presentValue)),
        toDecimal(m("0")),
      );
    expect(result.presentValueOfFuturePositiveCashFlows).toBe(
      expected.toFixed(),
    );
    expect(definedValue(result.profitabilityIndex)).toBe(
      expected.dividedBy("100").toFixed(),
    );
  });
});

describe("project investment cash-flow composition", () => {
  it("composes explicit project operating, investment, and recovery components", () => {
    const result = unwrap(
      composeProjectInvestmentCashFlowSeries(realisticComposition()),
    );
    expect(result.perspective).toBe("PROJECT_RETURN");
    expect(result.periods.map((period) => period.cashFlow)).toEqual([
      "-1000",
      "250",
      "250",
      "400",
      "600",
    ]);
    expect(result.periods[4]!.components.terminalValue!.value).toBe("100");
    expect(result.periods[4]!.components.workingCapitalRecovery!.value).toBe(
      "50",
    );
  });

  it("does not double-negate positive investment and capex source amounts", () => {
    const result = unwrap(
      composeProjectInvestmentCashFlowSeries({
        projectId: "investment-sign-integrity",
        periods: [
          {
            periodIndex: 0,
            components: components({ initialInvestment: "1000000" }),
          },
          {
            periodIndex: 1,
            components: components({ capitalExpenditure: "250000" }),
          },
        ],
      }),
    );
    expect(result.periods.map((period) => period.cashFlow)).toEqual([
      "-1000000",
      "-250000",
    ]);
  });

  it("treats omitted terminal value and working-capital recovery as no recovery cash flow", () => {
    const full = components({ operatingProjectCashFlow: "450" });
    const withoutRecoveries: ProjectInvestmentCashFlowComponents = {
      initialInvestment: full.initialInvestment,
      operatingProjectCashFlow: full.operatingProjectCashFlow,
      workingCapitalInvestment: full.workingCapitalInvestment,
      capitalExpenditure: full.capitalExpenditure,
      otherExplicitInvestmentCashFlow: full.otherExplicitInvestmentCashFlow,
    };
    const result = unwrap(
      composeProjectInvestmentCashFlowSeries({
        projectId: "omitted-recoveries",
        periods: [
          { periodIndex: 0, components: components() },
          { periodIndex: 1, components: withoutRecoveries },
        ],
      }),
    );
    expect(result.periods[1]!.cashFlow).toBe("450");
    expect(result.periods[1]!.components).not.toHaveProperty("terminalValue");
    expect(result.periods[1]!.components).not.toHaveProperty(
      "workingCapitalRecovery",
    );
  });

  it("includes terminal value and working-capital recovery separately only when supplied", () => {
    const terminalOnly = components({
      operatingProjectCashFlow: "450",
      terminalValue: "100",
    });
    const workingCapitalOnly = components({
      operatingProjectCashFlow: "450",
      workingCapitalRecovery: "50",
    });
    const terminalResult = unwrap(
      composeProjectInvestmentCashFlowSeries({
        projectId: "terminal-only",
        periods: [
          { periodIndex: 0, components: components() },
          {
            periodIndex: 1,
            components: {
              ...terminalOnly,
              workingCapitalRecovery: undefined,
            },
          },
        ],
      }),
    );
    const workingCapitalResult = unwrap(
      composeProjectInvestmentCashFlowSeries({
        projectId: "working-capital-only",
        periods: [
          { periodIndex: 0, components: components() },
          {
            periodIndex: 1,
            components: { ...workingCapitalOnly, terminalValue: undefined },
          },
        ],
      }),
    );
    expect(terminalResult.periods[1]!.cashFlow).toBe("550");
    expect(workingCapitalResult.periods[1]!.cashFlow).toBe("500");
  });

  it("allows negative normalized operating or other project cash flow", () => {
    const input = realisticComposition();
    const changed = {
      ...input,
      periods: [
        input.periods[0]!,
        {
          periodIndex: 1,
          components: components({
            operatingProjectCashFlow: "-20",
            otherExplicitInvestmentCashFlow: "-5",
          }),
        },
        ...input.periods.slice(2),
      ],
    };
    expect(
      unwrap(composeProjectInvestmentCashFlowSeries(changed)).periods[1]!
        .cashFlow,
    ).toBe("-25");
  });

  it("rejects financing and accounting-profit fields at runtime", () => {
    for (const field of [
      "loanDisbursement",
      "promoterContribution",
      "principalRepayment",
      "cashInterestPaid",
      "profitAfterTax",
      "ebitda",
      "ebit",
      "closingCash",
      "netCashMovement",
    ] as const) {
      const input = realisticComposition();
      const malformed = {
        ...input,
        periods: [
          { ...input.periods[0]!, [field]: m("999999") },
          ...input.periods.slice(1),
        ],
      } as ProjectInvestmentCashFlowCompositionInput;
      expectError(
        composeProjectInvestmentCashFlowSeries(malformed),
        "FORBIDDEN_PROJECT_RETURN_SOURCE_FIELD",
      );
    }
  });

  it("requires every supplied component to be source-backed", () => {
    const input = realisticComposition();
    const malformed = {
      ...input,
      periods: [
        {
          ...input.periods[0]!,
          components: {
            ...input.periods[0]!.components,
            initialInvestment: { value: m("1000") },
          },
        },
        ...input.periods.slice(1),
      ],
    } as ProjectInvestmentCashFlowCompositionInput;
    expectError(
      composeProjectInvestmentCashFlowSeries(malformed),
      "MISSING_PROJECT_RETURN_COMPONENT_SOURCE",
    );

    const malformedOptional = {
      ...input,
      periods: [
        input.periods[0]!,
        {
          ...input.periods[1]!,
          components: {
            ...input.periods[1]!.components,
            terminalValue: { value: m("100") },
          },
        },
        ...input.periods.slice(2),
      ],
    } as ProjectInvestmentCashFlowCompositionInput;
    expectError(
      composeProjectInvestmentCashFlowSeries(malformedOptional),
      "MISSING_PROJECT_RETURN_COMPONENT_SOURCE",
    );
  });

  it("rejects negative non-negative components", () => {
    const input = realisticComposition();
    const malformed = {
      ...input,
      periods: [
        input.periods[0]!,
        {
          ...input.periods[1]!,
          components: components({ workingCapitalInvestment: "-1" }),
        },
        ...input.periods.slice(2),
      ],
    };
    expectError(
      composeProjectInvestmentCashFlowSeries(malformed),
      "NEGATIVE_PROJECT_RETURN_COMPONENT",
    );
  });

  it("requires initial investment to remain in period 0", () => {
    const input = realisticComposition();
    const malformed = {
      ...input,
      periods: [
        input.periods[0]!,
        {
          ...input.periods[1]!,
          components: components({ initialInvestment: "10" }),
        },
        ...input.periods.slice(2),
      ],
    };
    expectError(
      composeProjectInvestmentCashFlowSeries(malformed),
      "INITIAL_INVESTMENT_OUTSIDE_PERIOD_ZERO",
    );
  });

  it("rejects duplicate, missing, and non-sequential component periods", () => {
    const input = realisticComposition();
    expectError(
      composeProjectInvestmentCashFlowSeries({
        ...input,
        periods: [input.periods[0]!, input.periods[0]!],
      }),
      "DUPLICATE_PROJECT_RETURN_COMPONENT_PERIOD",
    );
    expectError(
      composeProjectInvestmentCashFlowSeries({
        ...input,
        periods: input.periods.slice(1),
      }),
      "MISSING_PROJECT_RETURN_PERIOD_ZERO",
    );
    expectError(
      composeProjectInvestmentCashFlowSeries({
        ...input,
        periods: [input.periods[0]!, input.periods[2]!],
      }),
      "INVALID_PROJECT_RETURN_COMPONENT_PERIOD_SEQUENCE",
    );
  });
});

describe("investment-return analysis integration", () => {
  it("calculates all metrics from a realistic normalized project series", () => {
    const projectSeries = unwrap(
      composeProjectInvestmentCashFlowSeries(realisticComposition()),
    );
    const result = unwrap(
      calculateInvestmentReturns({
        series: projectSeries,
        discountRate: assumedRate("10"),
      }),
    );

    expect(result.projectId).toBe("project-investment-returns");
    expect(result.perspective).toBe("PROJECT_RETURN");
    expect(result.netPresentValue.npv).toBe(
      "144.2182911003346765931288846390273888396",
    );
    expect(result.internalRateOfReturn.irr.status).toBe("DEFINED");
    expect(result.simplePayback.paybackPeriod.status).toBe("DEFINED");
    expect(result.discountedPayback.paybackPeriod.status).toBe("DEFINED");
    expect(definedValue(result.profitabilityIndex.profitabilityIndex)).toBe(
      "1.14421829110033467659312888463902738884",
    );
  });

  it("keeps Project NPV and IRR identical across external financing structures", () => {
    const input = realisticComposition();
    const projectSeriesA = unwrap(
      composeProjectInvestmentCashFlowSeries(input),
    );
    const projectSeriesB = unwrap(
      composeProjectInvestmentCashFlowSeries(input),
    );
    const scenarioA = unwrap(
      calculateInvestmentReturns({
        series: projectSeriesA,
        discountRate: assumedRate("10"),
      }),
    );
    const scenarioB = unwrap(
      calculateInvestmentReturns({
        series: projectSeriesB,
        discountRate: assumedRate("10"),
      }),
    );
    expect(scenarioB.netPresentValue.npv).toBe(scenarioA.netPresentValue.npv);
    expect(scenarioB.internalRateOfReturn).toEqual(
      scenarioA.internalRateOfReturn,
    );

    for (const field of [
      "loanDisbursement",
      "promoterContribution",
      "principalRepayment",
    ] as const) {
      const forbiddenFinancing = {
        ...input,
        periods: [
          { ...input.periods[0]!, [field]: m("10000000") },
          ...input.periods.slice(1),
        ],
      } as ProjectInvestmentCashFlowCompositionInput;
      expectError(
        composeProjectInvestmentCashFlowSeries(forbiddenFinancing),
        "FORBIDDEN_PROJECT_RETURN_SOURCE_FIELD",
      );
    }
  });

  it("evaluates an explicitly normalized equity-return series without mixing perspectives", () => {
    const equitySeries = series(["-400", "100", "150", "250"], "EQUITY_RETURN");
    const result = unwrap(
      calculateInvestmentReturns({
        series: equitySeries,
        discountRate: assumedRate("10"),
      }),
    );
    expect(result.perspective).toBe("EQUITY_RETURN");
    expect(result.series).toBe(equitySeries);
    expect(result.internalRateOfReturn.irr.status).toBe("DEFINED");
  });

  it("never infers terminal value or working-capital recovery", () => {
    const input = realisticComposition();
    const noRecovery = {
      ...input,
      periods: input.periods.map((period) => ({
        ...period,
        components: {
          ...period.components,
          terminalValue: assumedAmount("0"),
          workingCapitalRecovery: assumedAmount("0"),
        },
      })),
    };
    const result = unwrap(composeProjectInvestmentCashFlowSeries(noRecovery));
    expect(result.periods[4]!.cashFlow).toBe("450");
    expect(result.periods[4]!.components.terminalValue!.value).toBe("0");
    expect(result.periods[4]!.components.workingCapitalRecovery!.value).toBe(
      "0",
    );
  });

  it("returns metrics without viability or approval labels", () => {
    const result = unwrap(
      calculateInvestmentReturns({
        series: series(["-100", "90"]),
        discountRate: assumedRate("10"),
      }),
    );
    const json = JSON.stringify(result);
    expect(json).not.toMatch(/GOOD|BAD|BANKABLE|NOT_BANKABLE|VIABLE|APPROVED/);
    expect(result).not.toHaveProperty("isViable");
    expect(result).not.toHaveProperty("approvalThreshold");
  });

  it("never emits NaN or Infinity across defined and undefined results", () => {
    const definedResult = unwrap(
      calculateInvestmentReturns({
        series: series(["-100", "110"]),
        discountRate: assumedRate("10"),
      }),
    );
    const undefinedResult = unwrap(
      calculateInvestmentReturns({
        series: series(["0", "0"]),
        discountRate: assumedRate("10"),
      }),
    );
    expect(JSON.stringify(definedResult)).not.toMatch(/NaN|Infinity/);
    expect(JSON.stringify(undefinedResult)).not.toMatch(/NaN|Infinity/);
  });
});
