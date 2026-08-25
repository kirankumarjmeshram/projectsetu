import { describe, expect, it } from "vitest";

import {
  InvalidPersistedDecimalError,
  isValidDecimalString,
  parsePersistedDecimal,
  serializeDecimal,
} from "./decimal";

describe("parsePersistedDecimal", () => {
  it("accepts a plain positive integer", () => {
    expect(parsePersistedDecimal("42")).toBe("42");
  });

  it("accepts zero", () => {
    expect(parsePersistedDecimal("0")).toBe("0");
  });

  it("accepts a negative integer", () => {
    expect(parsePersistedDecimal("-7")).toBe("-7");
  });

  it("accepts a decimal number", () => {
    expect(parsePersistedDecimal("1234.56")).toBe("1234.56");
  });

  it("accepts a negative decimal number", () => {
    expect(parsePersistedDecimal("-0.001")).toBe("-0.001");
  });

  it("accepts a very large number", () => {
    const large = "999999999999999999999999999999999999.99";
    expect(parsePersistedDecimal(large)).toBe(large);
  });

  it("rejects NaN", () => {
    expect(() => parsePersistedDecimal("NaN")).toThrow(
      InvalidPersistedDecimalError,
    );
  });

  it("rejects Infinity", () => {
    expect(() => parsePersistedDecimal("Infinity")).toThrow(
      InvalidPersistedDecimalError,
    );
  });

  it("rejects -Infinity", () => {
    expect(() => parsePersistedDecimal("-Infinity")).toThrow(
      InvalidPersistedDecimalError,
    );
  });

  it("rejects scientific notation", () => {
    expect(() => parsePersistedDecimal("1e5")).toThrow(
      InvalidPersistedDecimalError,
    );
    expect(() => parsePersistedDecimal("1.5E+10")).toThrow(
      InvalidPersistedDecimalError,
    );
  });

  it("rejects leading zeros", () => {
    expect(() => parsePersistedDecimal("007")).toThrow(
      InvalidPersistedDecimalError,
    );
  });

  it("rejects empty string", () => {
    expect(() => parsePersistedDecimal("")).toThrow(
      InvalidPersistedDecimalError,
    );
  });

  it("rejects non-string input", () => {
    expect(() => parsePersistedDecimal(42)).toThrow(
      InvalidPersistedDecimalError,
    );
    expect(() => parsePersistedDecimal(null)).toThrow(
      InvalidPersistedDecimalError,
    );
    expect(() => parsePersistedDecimal(undefined)).toThrow(
      InvalidPersistedDecimalError,
    );
  });

  it("rejects strings with spaces", () => {
    expect(() => parsePersistedDecimal(" 42")).toThrow(
      InvalidPersistedDecimalError,
    );
    expect(() => parsePersistedDecimal("42 ")).toThrow(
      InvalidPersistedDecimalError,
    );
  });

  it("rejects strings with currency symbols", () => {
    expect(() => parsePersistedDecimal("$42")).toThrow(
      InvalidPersistedDecimalError,
    );
  });

  it("rejects comma-formatted numbers", () => {
    expect(() => parsePersistedDecimal("1,234.56")).toThrow(
      InvalidPersistedDecimalError,
    );
  });
});

describe("serializeDecimal", () => {
  it("passes through a valid canonical decimal", () => {
    expect(serializeDecimal("1234.56")).toBe("1234.56");
  });

  it("passes through zero", () => {
    expect(serializeDecimal("0")).toBe("0");
  });

  it("rejects invalid values", () => {
    expect(() => serializeDecimal("NaN")).toThrow(InvalidPersistedDecimalError);
    expect(() => serializeDecimal("1e5")).toThrow(InvalidPersistedDecimalError);
  });
});

describe("isValidDecimalString", () => {
  it("returns true for valid decimal strings", () => {
    expect(isValidDecimalString("42")).toBe(true);
    expect(isValidDecimalString("0")).toBe(true);
    expect(isValidDecimalString("1234.56")).toBe(true);
    expect(isValidDecimalString("-7.5")).toBe(true);
  });

  it("returns false for invalid values", () => {
    expect(isValidDecimalString("NaN")).toBe(false);
    expect(isValidDecimalString("Infinity")).toBe(false);
    expect(isValidDecimalString("1e5")).toBe(false);
    expect(isValidDecimalString(42)).toBe(false);
    expect(isValidDecimalString(null)).toBe(false);
    expect(isValidDecimalString("")).toBe(false);
  });
});

describe("decimal round-trip fidelity", () => {
  const testCases = [
    "0",
    "1",
    "-1",
    "12345678901234567890.12345678901234567890",
    "0.001",
    "999999999999999999999999999999999999.99",
    "-0.00000000001",
  ];

  for (const value of testCases) {
    it(`round-trips ${value} exactly`, () => {
      const serialized = serializeDecimal(value);
      const parsed = parsePersistedDecimal(serialized);
      expect(parsed).toBe(value);
    });
  }

  it("preserves domain decimal.js output format through serialize/parse", () => {
    // Simulating what domain decimalValue("123.45") produces
    const domainOutput = "123.45";
    const serialized = serializeDecimal(domainOutput);
    const restored = parsePersistedDecimal(serialized);
    expect(restored).toBe(domainOutput);
  });
});
