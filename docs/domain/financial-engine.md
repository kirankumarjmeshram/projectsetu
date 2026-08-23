# Financial engine

## Status

The decimal-safe arithmetic foundation and Core Financial Engine Phase 1 are implemented. Phase 1 covers project cost, revenue, operating inputs/expenses, escalation, means of finance, reconciliation, and core working capital. No rates or business defaults are embedded.

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

## Phase 1 formula reference

All Phase 1 calculations are pure, retain their source input in line results, and use `ProjectSetuDecimal` without boundary rounding. Unless marked as a domain convention, each formula is an arithmetic identity and requires no government or external-policy provenance.

### Project-cost line

- **Purpose:** derive an auditable project-cost line.
- **Inputs:** a `ProjectCostItem` with either quantity and rate together or a stated amount; optional stated tax, freight, and installation amounts.
- **Calculation:** `base = quantity × rate` when both are supplied; otherwise `base = stated amount`. `additions = tax + freight + installation`. `final = base + additions`.
- **Output:** `ProjectCostLineResult` with method, inputs, base, difference from stated base, addition breakdown, and final amount.
- **Rounding:** none.
- **Assumptions:** absent additions are exact zero. Tax is an already-calculated amount, not a tax-rate calculation.
- **Limitations:** a lone quantity or rate is a typed failure. No GST, eligibility, quotation selection, or scheme treatment is performed.
- **Classification:** quantity/rate and sums are arithmetic identities; stated-amount fallback is an explicit contract convention.

### Project-cost aggregation

- **Purpose:** aggregate calculated cost lines without assuming categories.
- **Inputs:** `ProjectCost.items`.
- **Calculation:** category total is the exact sum of final line amounts in that category; total project cost is the exact sum of all final lines.
- **Output:** `ProjectCostSummary` with lines, supplied category totals, total, stated total, and signed difference from the stated total.
- **Rounding:** none.
- **Assumptions:** an empty collection totals zero; working-capital margin is included only when supplied as a cost item.
- **Limitations:** no scheme eligibility or category reclassification.
- **Classification:** arithmetic identity.

### Revenue line and summary

- **Purpose:** calculate annual product/service revenue from explicit sales assumptions.
- **Inputs:** exactly one sales-quantity and selling-price assumption for the requested projection year.
- **Calculation:** `line revenue = sales quantity × selling rate`; `total revenue = sum of line revenue`.
- **Output:** `RevenueLineResult` and `RevenueSummary`.
- **Rounding:** none.
- **Assumptions:** sales quantity is explicit. Installed capacity and capacity utilisation are not inferred or substituted.
- **Limitations:** missing or duplicate yearly assumptions are typed failures; no production-to-sales conversion, inventory movement, or forecasting.
- **Classification:** arithmetic identity.

### Explicit escalation

- **Purpose:** compound a value by a caller-supplied percent-point rate.
- **Inputs:** canonical decimal base, explicit `Percentage`, and non-negative integer period count.
- **Calculation:** `future value = base × (1 + percentage / 100)^periods`.
- **Output:** the same branded decimal kind through `CalculationResult`.
- **Rounding:** none beyond the accepted 40-significant-digit decimal context.
- **Assumptions:** `"10"` means 10%; zero periods returns the base.
- **Limitations:** this is not a forecast model and supplies no rate or period defaults.
- **Classification:** arithmetic identity.

### Operating-input line and summary

- **Purpose:** calculate the cost of an explicit operating input.
- **Inputs:** quantity, purchase rate, and optional stated transport-cost addition.
- **Calculation:** `base cost = quantity × purchase rate`; `total cost = base cost + transport cost`; summary is the exact sum of line totals.
- **Output:** `OperatingInputLineResult` and `OperatingInputCostSummary` with base/addition breakdown.
- **Rounding:** none.
- **Assumptions:** transport cost is a line-level total addition, not a rate.
- **Limitations:** missing quantity/rate is a typed failure. No statutory cost, wastage, inflation, storage, or supplier rule is inferred.
- **Classification:** multiplication/sums are arithmetic identities; transport treatment is a documented domain convention.

### Operating-expense aggregation

- **Purpose:** aggregate already-stated expenses for a projection year.
- **Inputs:** exactly one yearly amount for each expense.
- **Calculation:** `total operating expenses = sum of selected yearly amounts`.
- **Output:** `OperatingExpenseSummary` and its line results.
- **Rounding:** none.
- **Assumptions:** fixed/variable classification does not change the supplied value.
- **Limitations:** no escalation, allocation, or manpower calculation.
- **Classification:** arithmetic identity.

### Means of finance and reconciliation

- **Purpose:** total supplied finance sources and compare them with project cost.
- **Inputs:** explicit `FinanceSource` amounts and a calculated project-cost total.
- **Calculation:** source-type totals and total finance are exact sums. `difference = total finance − project cost`. Zero is balanced; negative is shortfall; positive is excess.
- **Output:** `MeansOfFinanceSummary` and `FinanceReconciliationResult`, including absolute and signed differences.
- **Rounding:** none; no tolerance is applied.
- **Assumptions:** every finance source is supplied explicitly.
- **Limitations:** no residual bank finance, promoter percentage, subsidy, or approval logic.
- **Classification:** arithmetic identity.

### Holding-period requirement

- **Purpose:** translate an annual base amount and explicit holding period into a requirement.
- **Inputs:** annual amount, holding-period days, and explicit positive day base.
- **Calculation:** `requirement = annual amount × holding days / day base`.
- **Output:** `HoldingPeriodRequirement` with all inputs and exact result.
- **Rounding:** none.
- **Assumptions:** no 360/365 convention; the caller supplies the day base. Top-level inventory, receivable, and creditor holding periods map only to their matching canonical categories.
- **Limitations:** negative holding days and non-positive day bases are typed failures.
- **Classification:** arithmetic identity; category-to-assumption mapping is a domain convention.

### Working-capital summary

- **Purpose:** total current assets and liabilities and derive the gap.
- **Inputs:** calculated/stated working-capital lines and optional explicit borrower-margin percentage.
- **Calculation:** `gap = current assets − current liabilities`. When margin is supplied, `borrower contribution = gap × margin / 100` and `bank finance = gap − borrower contribution`.
- **Output:** `WorkingCapitalSummary` with line breakdown, totals, gap, and optional margin results.
- **Rounding:** none.
- **Assumptions:** a line without a holding period uses its annual base amount directly as its stated requirement. Negative gaps remain negative.
- **Limitations:** no MPBF, Tandon Committee norm, minimum margin, residual floor, or bank policy.
- **Classification:** arithmetic identities after explicit inputs; direct-amount fallback is a domain convention.

## Typed calculation failures

`CalculationResult<T>` returns either a typed value or one or more `CalculationError` records. Structural failures include incomplete quantity/rate pairs, absent or duplicate yearly assumptions, missing working-capital bases/day bases, invalid holding periods, and invalid escalation periods. Decimal syntax remains enforced by the canonical constructors.

## Future calculations

Manpower/pay-period totals, capacity-based production forecasts, inventory flows, interest, repayment, depreciation, tax, statements, subsidy, scheme eligibility, advanced metrics, ratios, sensitivity recalculation, validation, and balance-sheet reconciliation remain deferred. Every future assumption must remain explicit and source-backed.
