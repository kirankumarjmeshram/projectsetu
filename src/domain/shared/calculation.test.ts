import { describe, expect, it } from "vitest";

import { escalateDecimalValue } from "./calculation";
import { monetaryAmount, percentage } from "./decimal";

describe("escalateDecimalValue", () => {
  it.each([
    { rate: "0", periods: 5, expected: "100" },
    { rate: "10", periods: 1, expected: "110" },
    { rate: "7.5", periods: 1, expected: "107.5" },
    { rate: "5", periods: 3, expected: "115.7625" },
    { rate: "25", periods: 0, expected: "100" },
  ])(
    "applies $rate percent for $periods periods",
    ({ rate, periods, expected }) => {
      const result = escalateDecimalValue(
        monetaryAmount("100"),
        percentage(rate),
        periods,
      );

      expect(result.ok && result.value).toBe(expected);
    },
  );

  it.each([-1, 1.5])(
    "returns a typed failure for invalid period %s",
    (periods) => {
      const result = escalateDecimalValue(
        monetaryAmount("100"),
        percentage("5"),
        periods,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0]?.code).toBe("INVALID_ESCALATION_PERIODS");
      }
    },
  );
});
