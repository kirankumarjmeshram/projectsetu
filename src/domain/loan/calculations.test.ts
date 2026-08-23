import { describe, expect, it } from "vitest";

import type { CalculationResult } from "../shared/calculation";
import {
  decimalValue,
  monetaryAmount,
  percentage,
  toDecimal,
  toMonetaryAmount,
} from "../shared/decimal";
import { sampleUserSource } from "../testing/domain-fixtures";
import {
  calculateEmiPayment,
  calculateEqualPrincipalAmount,
  calculatePeriodicInterestRate,
  generateLoanRepaymentSchedule,
} from "./calculations";
import type {
  LoanRepaymentSchedule,
  LoanTerms,
  RepaymentFrequency,
} from "./loan";

function unwrap<TValue>(result: CalculationResult<TValue>): TValue {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(result.errors.map((error) => error.code).join(", "));
  }

  return result.value;
}

function terms(overrides: Partial<LoanTerms> = {}): LoanTerms {
  return {
    id: "loan-synthetic-term",
    type: "TERM_LOAN",
    principal: {
      value: monetaryAmount("1200"),
      source: sampleUserSource,
    },
    annualInterestRate: {
      value: percentage("12"),
      source: sampleUserSource,
    },
    repaymentPeriods: 12,
    repaymentFrequency: "MONTHLY",
    repaymentMethod: "EQUAL_PRINCIPAL",
    ...overrides,
  };
}

function schedule(overrides: Partial<LoanTerms> = {}): LoanRepaymentSchedule {
  return unwrap(generateLoanRepaymentSchedule(terms(overrides)));
}

function sumAmounts(amounts: readonly string[]): string {
  let total = toDecimal(monetaryAmount("0"));

  for (const amount of amounts) {
    total = total.plus(toDecimal(monetaryAmount(amount)));
  }

  return toMonetaryAmount(total);
}

function expectPrincipalContinuity(result: LoanRepaymentSchedule): void {
  for (let index = 1; index < result.periods.length; index += 1) {
    expect(result.periods[index]?.openingPrincipal).toBe(
      result.periods[index - 1]?.closingPrincipal,
    );
  }
}

describe("calculatePeriodicInterestRate", () => {
  it.each([
    ["MONTHLY", "12", "0.01"],
    ["QUARTERLY", "12", "0.03"],
    ["HALF_YEARLY", "12", "0.06"],
    ["YEARLY", "12", "0.12"],
    ["MONTHLY", "7.5", "0.00625"],
    ["QUARTERLY", "0", "0"],
  ] as const)(
    "converts %s nominal annual rate %s to %s",
    (frequency, annualRate, expectedRate) => {
      const result = unwrap(
        calculatePeriodicInterestRate(percentage(annualRate), frequency),
      );

      expect(result).toBe(expectedRate);
    },
  );

  it("rejects an unsupported runtime frequency", () => {
    const result = calculatePeriodicInterestRate(
      percentage("12"),
      "WEEKLY" as RepaymentFrequency,
    );

    expect(result).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({ code: "UNSUPPORTED_REPAYMENT_FREQUENCY" }),
      ],
    });
  });
});

describe("equal-principal repayment", () => {
  it("calculates the equal principal amount without boundary rounding", () => {
    const result = unwrap(
      calculateEqualPrincipalAmount(monetaryAmount("1000.01"), 3),
    );

    expect(result).toBe("333.3366666666666666666666666666666666667");
  });

  it("produces a normal reducing-balance schedule with declining interest", () => {
    const result = schedule();

    expect(result.periods).toHaveLength(12);
    expect(result.periods[0]).toMatchObject({
      openingPrincipal: "1200",
      interestCharged: "12",
      principalRepayment: "100",
      totalPayment: "112",
      closingPrincipal: "1100",
    });
    expect(result.periods.at(-1)).toMatchObject({
      openingPrincipal: "100",
      interestCharged: "1",
      principalRepayment: "100",
      totalPayment: "101",
      closingPrincipal: "0",
    });
    expect(result.periods[0]?.interestCharged).toBe("12");
    expect(result.periods[1]?.interestCharged).toBe("11");
    expect(result.summary).toMatchObject({
      totalPrincipalRepaid: "1200",
      totalInterestCharged: "78",
      totalInterestPaid: "78",
      totalRepayments: "1278",
      endingPrincipal: "0",
    });
    expectPrincipalContinuity(result);
  });

  it("reconciles a fractional principal exactly in the final period", () => {
    const result = schedule({
      principal: {
        value: monetaryAmount("1000.01"),
        source: sampleUserSource,
      },
      annualInterestRate: {
        value: percentage("9"),
        source: sampleUserSource,
      },
      repaymentPeriods: 3,
      repaymentFrequency: "YEARLY",
    });

    expect(result.periods.at(-1)?.closingPrincipal).toBe("0");
    expect(result.summary.totalPrincipalRepaid).toBe("1000.01");
    expect(result.periods.at(-1)?.principalRepayment).toBe(
      result.periods.at(-1)?.openingPrincipal,
    );
  });

  it("supports a zero-interest equal-principal schedule", () => {
    const result = schedule({
      annualInterestRate: {
        value: percentage("0"),
        source: sampleUserSource,
      },
    });

    expect(
      result.periods.every((period) => period.interestCharged === "0"),
    ).toBe(true);
    expect(result.summary.totalInterestCharged).toBe("0");
    expect(result.summary.totalRepayments).toBe("1200");
  });

  it("preserves exact totals for a large principal", () => {
    const largePrincipal = monetaryAmount("1000000000000000000000000");
    const result = schedule({
      principal: { value: largePrincipal, source: sampleUserSource },
      annualInterestRate: {
        value: percentage("8"),
        source: sampleUserSource,
      },
      repaymentPeriods: 4,
      repaymentFrequency: "QUARTERLY",
    });

    expect(result.periods[0]?.principalRepayment).toBe(
      "250000000000000000000000",
    );
    expect(result.summary.totalPrincipalRepaid).toBe(largePrincipal);
    expect(result.summary.endingPrincipal).toBe("0");
  });
});

describe("EMI repayment", () => {
  it("calculates a known amortising payment using Decimal power", () => {
    const result = unwrap(
      calculateEmiPayment(monetaryAmount("1000"), decimalValue("0.1"), 2),
    );

    expect(result).toBe("576.1904761904761904761904761904761904762");
  });

  it("creates an EMI schedule with interest and principal components", () => {
    const result = schedule({
      principal: {
        value: monetaryAmount("1000"),
        source: sampleUserSource,
      },
      annualInterestRate: {
        value: percentage("10"),
        source: sampleUserSource,
      },
      repaymentPeriods: 2,
      repaymentFrequency: "YEARLY",
      repaymentMethod: "EMI",
    });

    expect(result.periods[0]).toMatchObject({
      openingPrincipal: "1000",
      interestCharged: "100",
      principalRepayment: "476.1904761904761904761904761904761904762",
      totalPayment: "576.1904761904761904761904761904761904762",
    });
    expect(result.periods.at(-1)?.closingPrincipal).toBe("0");
    expect(result.summary.totalPrincipalRepaid).toBe("1000");
    expectPrincipalContinuity(result);
  });

  it("uses principal divided by periods when interest is zero", () => {
    const payment = unwrap(
      calculateEmiPayment(monetaryAmount("1200"), decimalValue("0"), 12),
    );
    const result = schedule({
      annualInterestRate: {
        value: percentage("0"),
        source: sampleUserSource,
      },
      repaymentMethod: "EMI",
    });

    expect(payment).toBe("100");
    expect(
      result.periods.every((period) => period.totalPayment === "100"),
    ).toBe(true);
    expect(result.summary).toMatchObject({
      totalPrincipalRepaid: "1200",
      totalInterestCharged: "0",
      totalRepayments: "1200",
      endingPrincipal: "0",
    });
  });

  it("reconciles the final principal instead of retaining a precision residual", () => {
    const result = schedule({
      principal: {
        value: monetaryAmount("1000.01"),
        source: sampleUserSource,
      },
      annualInterestRate: {
        value: percentage("7.25"),
        source: sampleUserSource,
      },
      repaymentPeriods: 7,
      repaymentFrequency: "YEARLY",
      repaymentMethod: "EMI",
    });
    const finalPeriod = result.periods.at(-1);

    expect(finalPeriod?.principalRepayment).toBe(finalPeriod?.openingPrincipal);
    expect(finalPeriod?.closingPrincipal).toBe("0");
    expect(result.summary.totalPrincipalRepaid).toBe("1000.01");
  });

  it("supports a fractional nominal rate over multiple years", () => {
    const result = schedule({
      principal: {
        value: monetaryAmount("500000.25"),
        source: sampleUserSource,
      },
      annualInterestRate: {
        value: percentage("7.5"),
        source: sampleUserSource,
      },
      repaymentPeriods: 24,
      repaymentMethod: "EMI",
    });

    expect(result.periodicInterestRate).toBe("0.00625");
    expect(result.annualSummaries).toHaveLength(2);
    expect(result.summary.endingPrincipal).toBe("0");
    expect(result.summary.totalPrincipalRepaid).toBe("500000.25");
  });

  it("closes exactly over a long 360-period tenure", () => {
    const result = schedule({
      principal: {
        value: monetaryAmount("1000000"),
        source: sampleUserSource,
      },
      annualInterestRate: {
        value: percentage("8.125"),
        source: sampleUserSource,
      },
      repaymentPeriods: 360,
      repaymentMethod: "EMI",
    });

    expect(result.periods).toHaveLength(360);
    expect(result.annualSummaries).toHaveLength(30);
    expect(result.summary.totalPrincipalRepaid).toBe("1000000");
    expect(result.summary.endingPrincipal).toBe("0");
    expectPrincipalContinuity(result);
  });
});

describe("moratorium behavior", () => {
  it("keeps principal fixed and pays current interest for PRINCIPAL_ONLY", () => {
    const result = schedule({
      principal: {
        value: monetaryAmount("1000"),
        source: sampleUserSource,
      },
      annualInterestRate: {
        value: percentage("10"),
        source: sampleUserSource,
      },
      repaymentPeriods: 3,
      repaymentFrequency: "YEARLY",
      moratorium: {
        type: "PRINCIPAL_ONLY",
        periods: 1,
        interestTreatment: "PAY_CURRENT",
      },
    });

    expect(result.periods[0]).toMatchObject({
      phase: "MORATORIUM",
      interestCharged: "100",
      interestPayment: "100",
      principalRepayment: "0",
      totalPayment: "100",
      closingPrincipal: "1000",
      closingAccruedInterest: "0",
    });
    expect(result.summary).toMatchObject({
      totalPrincipalRepaid: "1000",
      totalInterestCharged: "250",
      totalInterestPaid: "250",
      numberOfAmortizationPeriods: 2,
      endingPrincipal: "0",
    });
  });

  it("keeps FULL_PAYMENT accrued interest separate from principal", () => {
    const result = schedule({
      principal: {
        value: monetaryAmount("1000"),
        source: sampleUserSource,
      },
      annualInterestRate: {
        value: percentage("10"),
        source: sampleUserSource,
      },
      repaymentPeriods: 3,
      repaymentFrequency: "YEARLY",
      moratorium: {
        type: "FULL_PAYMENT",
        periods: 1,
        interestTreatment: "ACCRUE",
      },
    });

    expect(result.periods[0]).toMatchObject({
      interestCharged: "100",
      interestPayment: "0",
      totalPayment: "0",
      accruedInterestAdded: "100",
      closingAccruedInterest: "100",
      closingPrincipal: "1000",
    });
    expect(result.periods[1]?.openingAccruedInterest).toBe("100");
    expect(result.summary).toMatchObject({
      totalInterestCharged: "250",
      totalInterestPaid: "150",
      endingPrincipal: "0",
      endingAccruedInterest: "100",
    });
  });

  it("capitalizes FULL_PAYMENT interest into future principal", () => {
    const result = schedule({
      principal: {
        value: monetaryAmount("1000"),
        source: sampleUserSource,
      },
      annualInterestRate: {
        value: percentage("10"),
        source: sampleUserSource,
      },
      repaymentPeriods: 3,
      repaymentFrequency: "YEARLY",
      moratorium: {
        type: "FULL_PAYMENT",
        periods: 1,
        interestTreatment: "CAPITALIZE",
      },
    });

    expect(result.periods[0]).toMatchObject({
      interestCharged: "100",
      interestPayment: "0",
      capitalizedInterest: "100",
      closingPrincipal: "1100",
      closingAccruedInterest: "0",
    });
    expect(result.periods[1]).toMatchObject({
      openingPrincipal: "1100",
      interestCharged: "110",
      principalRepayment: "550",
    });
    expect(result.summary).toMatchObject({
      originalPrincipal: "1000",
      totalCapitalizedInterest: "100",
      totalPrincipalRepaid: "1100",
      totalInterestCharged: "265",
      totalInterestPaid: "165",
      endingPrincipal: "0",
    });
    expect(
      toDecimal(result.summary.originalPrincipal)
        .plus(toDecimal(result.summary.totalCapitalizedInterest))
        .toFixed(),
    ).toBe(result.summary.totalPrincipalRepaid);
  });

  it("treats an explicit zero moratorium like no moratorium", () => {
    const withoutMoratorium = schedule();
    const withZeroMoratorium = schedule({
      moratorium: {
        type: "PRINCIPAL_ONLY",
        periods: 0,
        interestTreatment: "PAY_CURRENT",
      },
    });

    expect(withZeroMoratorium).toEqual(withoutMoratorium);
  });
});

describe("loan schedule validation and zero principal", () => {
  it.each([0, -1, 1.5])(
    "rejects invalid repayment periods %s for outstanding principal",
    (repaymentPeriods) => {
      const result = generateLoanRepaymentSchedule(terms({ repaymentPeriods }));

      expect(result).toEqual({
        ok: false,
        errors: expect.arrayContaining([
          expect.objectContaining({ code: "INVALID_REPAYMENT_PERIODS" }),
        ]),
      });
    },
  );

  it("rejects a moratorium longer than the total schedule", () => {
    const result = generateLoanRepaymentSchedule(
      terms({
        repaymentPeriods: 3,
        moratorium: {
          type: "PRINCIPAL_ONLY",
          periods: 4,
          interestTreatment: "PAY_CURRENT",
        },
      }),
    );

    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "MORATORIUM_EXCEEDS_SCHEDULE" }),
      ]),
    });
  });

  it("rejects a moratorium that leaves no principal-repayment period", () => {
    const result = generateLoanRepaymentSchedule(
      terms({
        repaymentPeriods: 3,
        moratorium: {
          type: "FULL_PAYMENT",
          periods: 3,
          interestTreatment: "ACCRUE",
        },
      }),
    );

    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "NO_AMORTIZATION_PERIODS" }),
      ]),
    });
  });

  it("rejects unsupported moratorium combinations", () => {
    const result = generateLoanRepaymentSchedule(
      terms({
        moratorium: {
          type: "PRINCIPAL_ONLY",
          periods: 1,
          interestTreatment: "CAPITALIZE",
        },
      }),
    );

    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          code: "UNSUPPORTED_MORATORIUM_CONFIGURATION",
        }),
      ]),
    });
  });

  it("rejects unsupported runtime methods and frequencies", () => {
    const unsupportedMethod = generateLoanRepaymentSchedule(
      terms({ repaymentMethod: "BALLOON" as LoanTerms["repaymentMethod"] }),
    );
    const unsupportedFrequency = generateLoanRepaymentSchedule(
      terms({
        repaymentFrequency: "WEEKLY" as LoanTerms["repaymentFrequency"],
      }),
    );

    expect(unsupportedMethod).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "UNSUPPORTED_REPAYMENT_METHOD" }),
      ]),
    });
    expect(unsupportedFrequency).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "UNSUPPORTED_REPAYMENT_FREQUENCY" }),
      ]),
    });
  });

  it("returns an explicit empty zero schedule for zero principal", () => {
    const result = schedule({
      principal: { value: monetaryAmount("0"), source: sampleUserSource },
      repaymentPeriods: 0,
      repaymentMethod: "EMI",
    });

    expect(result.periods).toEqual([]);
    expect(result.annualSummaries).toEqual([]);
    expect(result.summary).toEqual({
      originalPrincipal: "0",
      totalPrincipalRepaid: "0",
      totalInterestCharged: "0",
      totalInterestPaid: "0",
      totalRepayments: "0",
      totalCapitalizedInterest: "0",
      endingPrincipal: "0",
      endingAccruedInterest: "0",
      numberOfSchedulePeriods: 0,
      numberOfAmortizationPeriods: 0,
    });
  });
});

describe("annual loan aggregation and schedule invariants", () => {
  it("groups a monthly schedule into projection years", () => {
    const result = schedule({ repaymentPeriods: 24 });

    expect(result.annualSummaries).toEqual([
      {
        projectionYear: 1,
        openingPrincipal: "1200",
        principalRepaid: "600",
        interestCharged: "111",
        interestPaid: "111",
        totalDebtService: "711",
        closingPrincipal: "600",
        openingAccruedInterest: "0",
        closingAccruedInterest: "0",
      },
      {
        projectionYear: 2,
        openingPrincipal: "600",
        principalRepaid: "600",
        interestCharged: "39",
        interestPaid: "39",
        totalDebtService: "639",
        closingPrincipal: "0",
        openingAccruedInterest: "0",
        closingAccruedInterest: "0",
      },
    ]);
  });

  it("groups a quarterly schedule into projection years", () => {
    const result = schedule({
      principal: {
        value: monetaryAmount("800"),
        source: sampleUserSource,
      },
      annualInterestRate: {
        value: percentage("8"),
        source: sampleUserSource,
      },
      repaymentPeriods: 8,
      repaymentFrequency: "QUARTERLY",
    });

    expect(result.annualSummaries).toEqual([
      expect.objectContaining({
        projectionYear: 1,
        openingPrincipal: "800",
        principalRepaid: "400",
        interestCharged: "52",
        interestPaid: "52",
        totalDebtService: "452",
        closingPrincipal: "400",
      }),
      expect.objectContaining({
        projectionYear: 2,
        openingPrincipal: "400",
        principalRepaid: "400",
        interestCharged: "20",
        interestPaid: "20",
        totalDebtService: "420",
        closingPrincipal: "0",
      }),
    ]);
  });

  it("matches annual principal, interest, and debt-service totals exactly", () => {
    const result = schedule({
      principal: {
        value: monetaryAmount("500000.25"),
        source: sampleUserSource,
      },
      annualInterestRate: {
        value: percentage("7.5"),
        source: sampleUserSource,
      },
      repaymentPeriods: 24,
      repaymentMethod: "EMI",
    });

    expect(
      sumAmounts(
        result.annualSummaries.map((summary) => summary.principalRepaid),
      ),
    ).toBe(result.summary.totalPrincipalRepaid);
    expect(
      sumAmounts(
        result.annualSummaries.map((summary) => summary.interestCharged),
      ),
    ).toBe(result.summary.totalInterestCharged);
    expect(
      sumAmounts(result.annualSummaries.map((summary) => summary.interestPaid)),
    ).toBe(result.summary.totalInterestPaid);
    expect(
      sumAmounts(
        result.annualSummaries.map((summary) => summary.totalDebtService),
      ),
    ).toBe(result.summary.totalRepayments);
    expectPrincipalContinuity(result);
  });
});
