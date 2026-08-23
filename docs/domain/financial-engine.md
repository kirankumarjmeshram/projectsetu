# Financial engine

## Status

Canonical input/result contracts and the decimal-safe arithmetic foundation are implemented. No financial formulas, rates, or business defaults have been selected.

All financial calculations must be deterministic domain logic. AI may later explain or narrate validated results, but it must never be the source of truth for project cost, promoter contribution, subsidy, bank finance, interest, depreciation, profitability, DSCR, IRR, NPV, break-even, or loan repayment.

Future calculations should use pure functions where practical:

```text
typed input -> domain calculation -> typed result -> UI / database / report generator
```

Formulas must have one domain implementation, comprehensive unit tests, explicit rounding and precision rules, and provenance recording: source, source URL or document, scheme/version, effective date, last verified date, and notes.

Authoritative financial calculations must use the configured `decimal.js` primitive described by accepted ADR 0001. Native JavaScript floating-point arithmetic is not authoritative for money, rates, ratios, or financial metrics.

## Implemented contracts

- Project cost items and stated project-cost totals
- Operational capacity, products/services, inputs, manpower, and expenses
- Working-capital inputs and result shape
- Means of finance and loan terms/schedule rows
- Traceable financial assumptions and asset-wise depreciation assumptions
- Projected profit-and-loss, cash-flow, and balance-sheet result shapes
- Break-even, DSCR, IRR, NPV, ROI, payback, and ratio result shapes
- General sensitivity scenarios and their result shape
- Branded decimal, money, and percentage strings with strict constructors
- A configured 40-significant-digit decimal constructor
- Explicit percent-point conversion, serialization, and rounding helpers

## Arithmetic rules

- `MonetaryAmount` is canonical, unformatted, currency-neutral decimal text.
- `Percentage` uses percent points: `"10"` means 10%, not a factor of 10 or 0.10.
- `percentageToFactor(percentage("10"))` explicitly produces the decimal factor `0.1`.
- Values enter through `decimalValue`, `monetaryAmount`, or `percentage` and become arithmetic instances through `toDecimal`.
- Arithmetic uses `ProjectSetuDecimal` methods such as `plus`, `minus`, `times`, `dividedBy`, and `pow`.
- `toDecimalValue` serializes a finite result as plain canonical decimal text.
- Database `DECIMAL`/`NUMERIC` values and API values should cross boundaries as strings, never through native floating-point numbers.

The shared constructor uses 40 significant digits and half-even rounding for operations that exceed that precision. Future algorithms may use a documented higher-precision clone when justified.

### Example

```ts
const amount = monetaryAmount("1250000.5");
const rate = percentage("7.5");
const result = toDecimal(amount).times(percentageToFactor(rate));
const exactValue = toDecimalValue(result);

const rounded = roundDecimal(result, 2, decimalRoundingModes.HALF_UP);
const roundedValue = toDecimalValue(rounded);
```

This demonstrates decimal primitives only; it is not a ProjectSetu financial formula.

## Rounding and display

Do not round every intermediate result to two decimal places. Calculate at sufficient precision, then round at an explicit domain, statutory, persistence, or reporting boundary using a specified decimal-place count and mode. Scheme-specific and tax-specific rounding remains source-driven future work.

Display formatting is independent. Canonical domain values never contain the INR symbol, commas, Indian digit grouping, or forced trailing zeroes. Whole-rupee and decimal display choices belong to UI/report formatting.

## Future calculations

Totals, revenue, expenses, working capital, interest, repayment, depreciation, statements, metrics, ratios, sensitivity recalculation, validation, and balance-sheet reconciliation are all deferred. Every assumption must remain explicit and source-backed; there are no default percentages or rates.
