import { describe, expect, it } from "vitest";

import {
  DECIMAL_PRECISION,
  decimalRoundingModes,
  decimalValue,
  InvalidDecimalValueError,
  monetaryAmount,
  percentage,
  percentageToFactor,
  ProjectSetuDecimal,
  roundDecimal,
  toDecimal,
  toDecimalValue,
} from "./decimal";

describe("decimal arithmetic foundation", () => {
  it("uses the deliberate precision and rounding configuration", () => {
    expect(ProjectSetuDecimal.precision).toBe(DECIMAL_PRECISION);
    expect(ProjectSetuDecimal.rounding).toBe(decimalRoundingModes.HALF_EVEN);
  });

  it("adds ordinary decimals exactly", () => {
    const result = toDecimal(decimalValue("0.1")).plus(
      toDecimal(decimalValue("0.2")),
    );

    expect(toDecimalValue(result)).toBe("0.3");
  });

  it("applies a percent-point rate to a representative amount", () => {
    const amount = toDecimal(monetaryAmount("1234567.89"));
    const rate = percentage("10");
    const result = amount.times(percentageToFactor(rate));

    expect(toDecimalValue(result)).toBe("123456.789");
  });

  it("repeats decimal escalation without binary floating-point drift", () => {
    const escalation = percentage("7.5");
    const multiplier = toDecimal(decimalValue("1")).plus(
      percentageToFactor(escalation),
    );
    let result = toDecimal(monetaryAmount("100"));

    for (let year = 0; year < 5; year += 1) {
      result = result.times(multiplier);
    }

    expect(toDecimalValue(result)).toBe("143.5629326171875");
  });

  it("supports representative interest-style multiplication", () => {
    const principal = toDecimal(monetaryAmount("1250000"));
    const annualRate = percentage("11.375");

    expect(
      toDecimalValue(principal.times(percentageToFactor(annualRate))),
    ).toBe("142187.5");
  });

  it("preserves large monetary values and fractional units", () => {
    const largeAmount = toDecimal(
      monetaryAmount("999999999999999999999999.99"),
    );
    const result = largeAmount.plus(toDecimal(monetaryAmount("0.01")));

    expect(toDecimalValue(result)).toBe("1000000000000000000000000");
  });

  it("rounds non-terminating division only at an explicit boundary", () => {
    const result = toDecimal(decimalValue("10")).dividedBy(
      toDecimal(decimalValue("3")),
    );
    const rounded = roundDecimal(result, 4, decimalRoundingModes.HALF_UP);

    expect(toDecimalValue(rounded)).toBe("3.3333");
  });

  it("supports negative values and normalizes decimal text", () => {
    expect(monetaryAmount("-1250.500")).toBe("-1250.5");
    expect(decimalValue("-0")).toBe("0");
  });
});

describe("percentage convention", () => {
  it("stores percentages as percent points and converts explicitly to a factor", () => {
    const tenPercent = percentage("10");

    expect(tenPercent).toBe("10");
    expect(toDecimalValue(percentageToFactor(tenPercent))).toBe("0.1");
  });
});

describe("invalid decimal input", () => {
  it.each([
    "",
    "arbitrary text",
    "NaN",
    "Infinity",
    "1e3",
    ".5",
    "1.",
    "01",
    Number.NaN,
    Number.POSITIVE_INFINITY,
    10,
  ])("rejects invalid or non-string input %s", (input) => {
    expect(() => decimalValue(input)).toThrow(InvalidDecimalValueError);
  });

  it("requires a valid explicit rounding scale", () => {
    const value = toDecimal(decimalValue("1.25"));

    expect(() => roundDecimal(value, -1, decimalRoundingModes.HALF_UP)).toThrow(
      RangeError,
    );
    expect(() =>
      roundDecimal(value, 1.5, decimalRoundingModes.HALF_UP),
    ).toThrow(RangeError);
  });
});
