# Money and decimal representation

## Status

Accepted

## Context

ProjectSetu will perform authoritative currency, percentage, ratio, interest, discounting, depreciation, repayment, and financial-metric calculations. IEEE-754 binary floating point cannot exactly represent many ordinary decimal values, and hidden conversion through native `number` would undermine deterministic results.

Task 002 deliberately represented financial values as unvalidated decimal text while this choice remained open. This ADR resolves the arithmetic, transport, persistence, percentage, precision, and rounding conventions without implementing financial formulas.

## Requirements

- Exact decimal input for currency values, including fractional rupees and unit rates with more than two decimal places.
- Predictable percentage, ratio, division, power, and iterative-mathematics support.
- Explicit precision and rounding behavior, including negative values.
- Compatibility with TypeScript, Node.js, Next.js, JSON decimal strings, and future relational `DECIMAL`/`NUMERIC` columns.
- Independence from React, databases, APIs, storage, PDF, and AI providers.
- A small API that discourages native-number arithmetic without becoming an accounting framework.

## Options considered

### Option A: JavaScript `number`

Native numbers have excellent ergonomics and native JSON support, but they use IEEE-754 binary floating point. Common decimal inputs such as `0.1` and `0.2` are not represented exactly. Errors can accumulate through repeated escalation, interest, division, and discounting. Serialization does not restore precision already lost. This is unacceptable as the authoritative financial representation.

### Option B: integer smallest currency unit

Integer paise provides exact addition and subtraction for INR amounts already rounded to two decimal places. It does not naturally represent fractional-paise unit rates, percentages, ratios, depreciation, non-terminating division, discount factors, or powers. Those operations require separate scale conventions, rational arithmetic, or repeated conversions. JavaScript safe-integer limits also require an additional big-integer strategy for unrestricted values. Integer paise may still be useful at a specific payment-system boundary, but it is not the general ProjectSetu calculation model.

### Option C: arbitrary-precision decimal arithmetic

Arbitrary-precision decimal arithmetic directly represents decimal inputs and supports explicit precision and rounding. Current mature candidates evaluated from their published package metadata were:

| Package                                                      | Version evaluated | Assessment                                                                                                                                                     |
| ------------------------------------------------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`decimal.js`](https://www.npmjs.com/package/decimal.js)     | 10.6.0            | Broad decimal mathematics, significant-digit precision, configurable rounding, powers, built-in TypeScript declarations, MIT license.                          |
| [`big.js`](https://www.npmjs.com/package/big.js)             | 7.0.1             | Small and mature, but intentionally narrower; division precision is decimal-place based and advanced future mathematics would require more surrounding policy. |
| [`bignumber.js`](https://www.npmjs.com/package/bignumber.js) | 11.1.5            | Mature and capable, including non-decimal bases, but ProjectSetu does not need its broader base-conversion focus.                                              |

All three avoid binary floating-point arithmetic when constructed from strings. Installing more than one would add ambiguity without value.

## Comparison

| Criterion                     | Native `number`       | Integer paise                   | Arbitrary decimal                                         |
| ----------------------------- | --------------------- | ------------------------------- | --------------------------------------------------------- |
| Exact ordinary decimal inputs | No                    | Only at fixed chosen scale      | Yes                                                       |
| Currency addition/subtraction | Risk of binary error  | Exact                           | Exact                                                     |
| Fractional unit rates         | Risk of binary error  | Requires extra scale            | Direct                                                    |
| Percentages and ratios        | Risk of binary error  | Requires scale conventions      | Direct                                                    |
| Division and powers           | Available but inexact | Awkward                         | Supported with configured precision                       |
| JSON/database boundary        | Easy but lossy        | Conversion required             | Decimal strings map naturally                             |
| Developer ergonomics          | Highest               | Simple only for currency totals | Explicit method-based arithmetic                          |
| Accidental unsafe arithmetic  | Easy                  | Possible unit/scale mistakes    | Branded strings plus conversion helpers make it difficult |

## Decision

Use `decimal.js` as the single core domain arithmetic dependency.

Canonical contract values remain serializable branded decimal strings. Authoritative calculations must convert those values to the configured `ProjectSetuDecimal` constructor and use decimal methods. Native JavaScript number arithmetic must not be used for authoritative financial calculations.

The shared configuration uses 40 significant digits and `ROUND_HALF_EVEN` when a decimal operation must round to the configured precision. Forty digits gives substantial headroom beyond displayed INR amounts while keeping iterative work bounded. Individual future financial algorithms may use a separately cloned constructor with a documented higher precision when their convergence analysis requires it.

## Internal representation

- `DecimalValue` is canonical, unformatted decimal text validated and normalized by `decimalValue`.
- `MonetaryAmount` is a branded `DecimalValue` created by `monetaryAmount`.
- `Percentage` is a branded `DecimalValue` created by `percentage`.
- `ProjectSetuDecimal` is the configured `decimal.js` constructor for calculations.
- `toDecimal` converts a domain decimal value to an arithmetic instance.
- `toDecimalValue` serializes a finite arithmetic result without exponential notation.

The primitive is currency-neutral. INR is current product/report metadata and presentation context, not a property of decimal arithmetic. Forex and multi-currency conversion are out of scope.

## Percentage convention

Percentages use **percent points** internally and at boundaries: `10%` is represented as `"10"`, `7.5%` as `"7.5"`, and `11.375%` as `"11.375"`. They are never represented ambiguously as both `10` and `0.10`.

`percentageToFactor` explicitly converts percent points to a calculation factor, so `percentage("10")` becomes the decimal factor `0.1`. Function and field names must state whether they accept a percentage or a factor.

## JSON/API representation

APIs must transport financial decimals as canonical strings, not JSON numbers:

```json
{
  "amount": "1250000.5",
  "interestRate": "11.25"
}
```

Inbound values must pass the appropriate constructor. Empty strings, arbitrary text, native numbers, `NaN`, infinities, malformed decimals, and exponential notation are rejected rather than coerced. Transport schemas remain a future validation-layer responsibility.

## Database representation

Future relational schemas should use appropriately sized `DECIMAL`/`NUMERIC` columns. Exact database values should cross the adapter boundary as strings, pass through the domain constructors, become `ProjectSetuDecimal` only during calculation, and serialize back to canonical strings for persistence:

```text
Database DECIMAL/NUMERIC
  -> driver decimal string
  -> domain branded decimal value
  -> ProjectSetuDecimal calculation
  -> canonical decimal string
  -> Database DECIMAL/NUMERIC
```

Database adapters must not route exact decimals through native numbers. Column precision and scale remain schema-specific decisions to record when persistence is designed.

## Rounding policy

1. Parse exact decimal strings and calculate with sufficient internal precision.
2. Do not round every intermediate result to two decimal places.
3. Apply rounding only at an explicit domain, contractual, statutory, persistence, or reporting boundary.
4. Specify decimal places and rounding mode at that boundary. Use `roundDecimal` rather than implicit formatting.
5. Format the rounded value independently for display.

The shared 40-digit, half-even configuration governs precision-limited internal operations; it does not create a universal currency, tax, EMI, or scheme rounding rule. Scheme-specific and statutory rounding rules require verified sources and tests.

## Display-format policy

Canonical values never contain `₹`, commas, Indian digit grouping, or forced trailing zeroes. Indian numbering, the INR symbol, configurable decimal places, and whole-rupee DPR presentation belong to UI/report formatting. Arithmetic, domain rounding, and display formatting remain separate responsibilities.

## Consequences

- `decimal.js` becomes an intentional dependency of the otherwise provider-independent domain layer.
- Financial contract values remain safe for JSON and future database boundaries.
- Arithmetic is more explicit than native operators: callers use methods such as `plus`, `times`, `dividedBy`, and `pow`.
- TypeScript brands distinguish general decimal text, monetary amounts, percentages, and ordinary strings after construction.
- Negative values remain valid; later domain validations may restrict specific fields.
- Tests can assert exact decimal strings and explicit rounding behavior.

## Limitations

- TypeScript brands are compile-time safeguards, not runtime schema validation. Untrusted values must use constructors at every boundary.
- Canonical normalization does not preserve input scale or trailing zeroes; display scale is separate metadata/policy.
- Forty significant digits is a default, not proof that every future iterative algorithm has sufficient precision or convergence.
- This ADR does not define currency metadata, database column sizes, tax rules, scheme rounding, payment-provider minor units, or financial formulas.

## Alternatives rejected

- Native `number` was rejected as authoritative because ordinary decimal values and accumulated calculations are not exact.
- Integer paise was rejected as the universal model because ProjectSetu requires higher-scale unit rates, percentages, ratios, division, and powers.
- `big.js` and `bignumber.js` remain sound libraries but were rejected to avoid multiple packages and because `decimal.js` most directly covers the planned mathematical breadth.
- A custom decimal implementation was rejected as unnecessary risk.

## Migration considerations

Existing Task 002 decimal strings must be migrated through `monetaryAmount`, `percentage`, or `decimalValue`; direct string assignment will no longer type-check. API adapters, database adapters, fixtures, and forms must construct branded values at trusted validation boundaries. Future stored values should be audited for canonical plain-decimal syntax before adoption.

No historical production data or persistence schema exists at the time of this decision.

## Date

2026-08-23
