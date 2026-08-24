# Financial engine

## Status

The decimal-safe arithmetic foundation, Core Financial Engine Phase 1, reusable term-loan repayment engine, revenue/operating-expense projection engine, asset-wise depreciation engine, projected profit-and-loss engine, and indirect-method cash-flow engine are implemented. Phase 1 covers project cost, explicit single-year revenue and expense aggregation, escalation, means of finance, reconciliation, and core working capital. The projection engine adds deterministic multi-year quantity, capacity, selling-price, revenue, expense, and operating-surplus calculations. The depreciation engine adds Straight Line and Written Down Value schedules from explicit per-asset assumptions. The P&L engine composes normalized authoritative flows into EBITDA, EBIT, profit before tax, generic tax, and profit after tax. The cash-flow engine composes authoritative cash-impacting values into operating, investing, and financing cash flows, exact balance continuity, and cumulative movement totals. No rates or business defaults are embedded.

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
- Means of finance plus configured loan terms, calculated repayment periods, loan summaries, and annual repayment summaries
- Revenue and operating-expense projection assumptions, yearly overrides, calculated lines, grouped totals, and pre-depreciation/interest/tax operating surplus
- Source-backed asset depreciation inputs, additions, per-asset schedules, and aggregate yearly summaries
- Normalized projected P&L inputs, generic tax assumptions, yearly rows, cumulative flow totals, and strict composition policy
- Normalized cash-flow inputs, strict composition policy, yearly indirect-method rows, and cumulative cash-flow totals
- Projected balance-sheet result shape
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

## Implemented Formula Registry

`Implemented` means domain code and focused unit tests exist. Arithmetic identities need no external authority; standard financial mathematics and ProjectSetu domain conventions are identified explicitly rather than attributed to a bank or government scheme.

| Formula/function                                                                                        | Module                                       | Status      | Classification                                                   | Source/basis                                                                           | Test file                                         |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ----------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `calculateProjectCostLine`, `calculateProjectCost`                                                      | `src/domain/project-cost/calculations.ts`    | Implemented | Arithmetic identity and documented fallback convention           | Explicit quantity/rate, stated amounts, and exact sums                                 | `src/domain/project-cost/calculations.test.ts`    |
| `calculateRevenueLine`, `calculateRevenueSummary`                                                       | `src/domain/operations/calculations.ts`      | Implemented | Arithmetic identity                                              | Explicit sales quantity multiplied by selling rate                                     | `src/domain/operations/calculations.test.ts`      |
| `escalateDecimalValue`                                                                                  | `src/domain/shared/calculation.ts`           | Implemented | Arithmetic identity                                              | Explicit compound-growth formula                                                       | `src/domain/shared/calculation.test.ts`           |
| `calculateOperatingInputLine`, `calculateOperatingInputCostSummary`, `calculateOperatingExpenseSummary` | `src/domain/operations/calculations.ts`      | Implemented | Arithmetic identity and documented addition convention           | Explicit quantities, rates, additions, and exact sums                                  | `src/domain/operations/calculations.test.ts`      |
| `calculateMeansOfFinance`, `reconcileMeansOfFinance`                                                    | `src/domain/financing/calculations.ts`       | Implemented | Arithmetic identity                                              | Exact source sums and finance-minus-cost comparison                                    | `src/domain/financing/calculations.test.ts`       |
| `calculateHoldingPeriodRequirement`, `calculateWorkingCapitalLine`, `calculateWorkingCapital`           | `src/domain/working-capital/calculations.ts` | Implemented | Arithmetic identity and domain convention                        | Caller-supplied annual bases, holding periods, day base, and margin                    | `src/domain/working-capital/calculations.test.ts` |
| `calculatePeriodicInterestRate`                                                                         | `src/domain/loan/calculations.ts`            | Implemented | Domain convention                                                | Nominal annual percent factor divided by explicit periods per year                     | `src/domain/loan/calculations.test.ts`            |
| `calculatePeriodInterest`                                                                               | `src/domain/loan/calculations.ts`            | Implemented | Standard financial mathematics                                   | Reducing-balance interest on opening principal                                         | `src/domain/loan/calculations.test.ts`            |
| `calculateEqualPrincipalAmount`                                                                         | `src/domain/loan/calculations.ts`            | Implemented | Standard financial mathematics                                   | Repayable principal divided by amortization periods                                    | `src/domain/loan/calculations.test.ts`            |
| `calculateEmiPayment`                                                                                   | `src/domain/loan/calculations.ts`            | Implemented | Standard financial mathematics                                   | Standard amortising-loan payment relationship, including zero-rate branch              | `src/domain/loan/calculations.test.ts`            |
| `generateLoanRepaymentSchedule`                                                                         | `src/domain/loan/calculations.ts`            | Implemented | Standard financial mathematics and documented domain conventions | Reducing-balance schedule, explicit moratorium policy, and final-period reconciliation | `src/domain/loan/calculations.test.ts`            |
| `summarizeLoanScheduleByYear`                                                                           | `src/domain/loan/calculations.ts`            | Implemented | Aggregation identity and projection-year convention              | Canonical repayment periods grouped by frequency count                                 | `src/domain/loan/calculations.test.ts`            |
| `calculateRevenueProjection`                                                                            | `src/domain/projection/calculations.ts`      | Implemented | Arithmetic identity and documented projection convention         | Quantity, capacity factor, unit price, explicit overrides, and compound growth         | `src/domain/projection/calculations.test.ts`      |
| `calculateOperatingExpenseProjection`                                                                   | `src/domain/projection/calculations.ts`      | Implemented | Arithmetic identity and documented projection convention         | Fixed annual amounts or explicit percentage of projected revenue                       | `src/domain/projection/calculations.test.ts`      |
| `calculateRevenueAndOperatingExpenseProjection`                                                         | `src/domain/projection/calculations.ts`      | Implemented | Aggregation identity                                             | Canonical revenue less canonical operating expenses                                    | `src/domain/projection/calculations.test.ts`      |
| `calculateStraightLineAnnualDepreciation`, `calculateAssetDepreciationSchedule`                         | `src/domain/depreciation/calculations.ts`    | Implemented | Standard accounting mathematics and documented timing convention | Explicit cost, residual value, useful life, start year, and full-year additions        | `src/domain/depreciation/calculations.test.ts`    |
| `calculateWrittenDownValueDepreciation`, `calculateAssetDepreciationSchedule`                           | `src/domain/depreciation/calculations.ts`    | Implemented | Standard accounting mathematics and documented timing convention | Explicit opening carrying value, additions, rate, and residual floor                   | `src/domain/depreciation/calculations.test.ts`    |
| `calculateDepreciationSchedule`, `summarizeDepreciationByYear`                                          | `src/domain/depreciation/calculations.ts`    | Implemented | Aggregation identity                                             | Exact sums of canonical asset/year depreciation rows                                   | `src/domain/depreciation/calculations.test.ts`    |
| `calculatePercentageOfPositiveProfitBeforeTax`, `calculateProjectedProfitAndLoss`                       | `src/domain/profit-and-loss/calculations.ts` | Implemented | Arithmetic identities and explicit generic tax convention        | Normalized authoritative flows and source-backed tax configuration                     | `src/domain/profit-and-loss/calculations.test.ts` |
| `composeProfitAndLossYearInputs`, `calculateProfitAndLossFromAuthoritativeSchedules`                    | `src/domain/profit-and-loss/calculations.ts` | Implemented | Strict composition and year-alignment convention                 | Projection totals, annual depreciation, and explicitly normalized interest expense     | `src/domain/profit-and-loss/calculations.test.ts` |
| `calculateOperatingCashFlow`, `calculateInvestingCashFlow`, `calculateFinancingCashFlow`                | `src/domain/cash-flow/calculations.ts`       | Implemented | Arithmetic identities and documented cash-classification rules   | Normalized PAT, depreciation, NWC change, capex, financing, and cash loan payments     | `src/domain/cash-flow/calculations.test.ts`       |
| `calculateCashFlowSchedule`                                                                             | `src/domain/cash-flow/calculations.ts`       | Implemented | Arithmetic identities and exact balance-continuity convention    | Explicit opening cash and normalized sequential yearly cash-impacting values           | `src/domain/cash-flow/calculations.test.ts`       |
| `composeCashFlowYearInputs`, `calculateCashFlowFromAuthoritativeSchedules`                              | `src/domain/cash-flow/adapters.ts`           | Implemented | Strict composition and year-alignment convention                 | P&L, working-capital changes, cash capex, financing inflows, and loan cash payments    | `src/domain/cash-flow/calculations.test.ts`       |

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

## Revenue and operating expense projection formula reference

The projection module extends, rather than replaces, Phase 1's explicit single-year operations calculations. It accepts source-backed year-one assumptions, an explicit positive projection period, and optional year-specific overrides. All money, quantities, percentages, growth, multiplication, compounding, subtraction, and aggregation use `ProjectSetuDecimal`. Native numbers are limited to validated integer years, array indices, and loop control.

### Revenue projection

- **Purpose:** project revenue for one or more products/services across an explicit number of years.
- **Inputs:** product/service name, quantity, unit price, capacity-utilisation percentage, quantity-growth percentage, selling-price-escalation percentage, projection period, and optional year-specific overrides.
- **Formula/algorithm:** `effective quantity = quantity × capacity utilisation / 100`; `revenue = effective quantity × unit price`. Each line is calculated separately and exact line revenues are summed for the year's total revenue.
- **Result:** `RevenueProjectionYear` rows with transparent line inputs, selected quantity/capacity/price, effective quantity, rates used for the following year, and total revenue.
- **Rounding:** no intermediate, yearly, or display rounding.
- **Assumptions:** quantity and unit price must be non-negative. Zero quantity, zero unit price, or zero capacity therefore produces valid zero revenue. Capacity utilisation is an explicit 0–100 percent-point value. An empty revenue collection produces canonical zero totals.
- **Limitations:** no physical production/inventory flow, seasonality, product mix, returns, discounts, indirect taxes, date-based periods, or capacity constraint beyond the supplied utilisation factor.

### Growth, escalation, and yearly overrides

- **Purpose:** allow quantity, selling price, capacity, and applicable rates to vary across projection years without inferring forecasts.
- **Inputs:** default quantity growth and selling-price escalation of at least −100%, plus optional overrides identified by a unique projection year.
- **Formula/algorithm:** absent an override, `next quantity = selected current quantity × (1 + quantity growth / 100)` and `next price = selected current price × (1 + price escalation / 100)`. A quantity or price override replaces that year's calculated value and becomes the base for the following year. A rate override controls growth from that selected year to the next. Capacity overrides apply only to their named year; otherwise the base capacity assumption applies.
- **Result:** auditable yearly values and the exact rates used to derive the following year's values.
- **Rounding:** compounding remains in the accepted 40-significant-digit decimal context with no currency rounding.
- **Assumptions:** year 1 uses base values unless explicitly overridden. Rates are percent points; `"10"` means 10%. Zero growth preserves the selected value; negative rates model decline; −100% reduces the following year's value to zero.
- **Limitations:** rates below −100% are rejected because they would produce negative projected values. Overrides outside the projection period or duplicate overrides for one line/year are typed failures.

### Fixed annual operating expenses

- **Purpose:** project stated annual expense amounts such as salaries, rent, repairs, or custom overheads.
- **Inputs:** expense name/category, year-one annual amount, explicit annual escalation of at least −100%, and optional yearly amount/rate overrides.
- **Formula/algorithm:** the selected amount is the current year's expense; `next amount = selected current amount × (1 + escalation / 100)`. An amount override becomes the next escalation base.
- **Result:** `OperatingExpenseProjectionLine` rows showing the selected annual amount, escalation used for the next year, and calculated expense.
- **Rounding:** none.
- **Assumptions:** zero expense is valid. Expense categories classify output but do not supply amounts or rates.
- **Limitations:** no monthly phasing, quantity-consumption norms, payroll headcount, statutory employment cost, allocation, tax, or supplier-specific behavior.

### Percentage-of-revenue operating expenses

- **Purpose:** represent variable expenses for which the caller explicitly selects projected revenue as the basis.
- **Inputs:** expense name/category, percentage of revenue, explicit rate escalation of at least −100%, projected yearly revenue, and optional yearly rate overrides.
- **Formula/algorithm:** `expense = total projected revenue × percentage / 100`; `next percentage = selected current percentage × (1 + rate escalation / 100)`.
- **Result:** line rows retain the exact percentage and resulting amount. A zero-revenue year produces zero expense.
- **Rounding:** none.
- **Assumptions:** the percentage and every projected escalated rate must remain between 0 and 100 percent points. Rate escalation changes the rate, not an already-calculated amount.
- **Limitations:** projected revenue is the only percentage basis implemented; percentage of raw material, quantity, contribution, or another line is deferred.

### Expense grouping and operating surplus

- **Purpose:** provide the yearly structure required by future statements without implementing a P&L.
- **Inputs:** canonical expense lines and canonical total revenue for the same projection year.
- **Formula/algorithm:** exact line amounts are grouped into raw-material/variable costs, wages, salaries, utilities, repairs/maintenance, and administrative/other costs. Wages, salaries, utilities, repairs, and raw materials follow their named categories. Other percentage-of-revenue lines are variable; remaining fixed lines are administrative/other. `total operating expenses = sum of all expense lines`; `operating surplus before depreciation, interest and tax = total revenue − total operating expenses`.
- **Result:** one `RevenueAndOperatingExpenseProjectionYear` per year, retaining detailed revenue/expense lines and exact grouped totals.
- **Rounding:** none; line, category, total-expense, and surplus values reconcile exactly in the configured decimal context.
- **Assumptions:** custom fixed items are administrative/other; custom percentage-based items are variable. The result is a projection-domain output, not a financial statement.
- **Limitations:** depreciation, loan interest, taxation, P&L, cash flow, balance sheet, DSCR, IRR, NPV, subsidies, and scheme rules are not calculated.

## Depreciation formula reference

The depreciation module is a pure calculation boundary. It does not import projects, revenue, loans, statements, schemes, subsidy logic, UI, or infrastructure. Monetary amounts and supplied percentage rates remain canonical decimal strings; native numbers are used only for validated whole projection years, useful-life years, indices, and loop control.

### Straight Line depreciation

- **Purpose:** spread each asset component's depreciable amount across an explicit useful life.
- **Inputs:** source-backed original cost and residual value, positive whole useful-life years, depreciation start year, and optional source-backed additions.
- **Formula/algorithm:** `depreciable amount = cost − residual value`; `annual depreciation = depreciable amount / useful life`. The original asset and each addition are independent components using the asset's configured useful life. Each component tracks its own elapsed life, accumulated depreciation, and residual value; exhausting one component cannot restart it while another remains active. A component's final useful-life year consumes its exact remaining depreciable amount, and total depreciation is capped at the cumulative residual floor.
- **Result:** asset/year rows exposing gross value movement, additions, depreciation base, annual and accumulated depreciation, closing carrying value, and residual floor.
- **Rounding:** none. Repeating division remains in the configured 40-significant-digit Decimal.js context; no currency/display scale is imposed.
- **Assumptions:** the original asset is available for the full `depreciationStartYear`. A later addition begins a new full useful-life stream in its stated year. Zero cost is valid.
- **Limitations:** no rate-derived useful life, partial-year convention, acquisition date, statutory classification, or automatic rate/life lookup.

### Written Down Value depreciation

- **Purpose:** apply an explicit declining-balance percentage while preserving a residual floor.
- **Inputs:** authoritative opening carrying value, additions in the year, cumulative residual value, and a supplied 0–100 percent-point rate.
- **Formula/algorithm:** under the full-year addition convention, `depreciation base = opening carrying value + additions`; `normal depreciation = depreciation base × rate / 100`; `depreciation = min(normal depreciation, depreciation base − residual value)`; `closing carrying value = depreciation base − depreciation`.
- **Result:** each closing carrying value becomes the next asset row's opening carrying value exactly.
- **Rounding:** none; multiplication, percentage conversion, cap, and balance movement use `ProjectSetuDecimal`.
- **Assumptions:** 0% is valid. 100% reaches zero only when the cumulative residual floor is zero.
- **Limitations:** no statutory block pooling, written-down tax block behavior, half-year tax rule, or category-selected rate.

### Additions, continuity, and residual value

- **Purpose:** show capital additions explicitly without silently treating them as present from year 1.
- **Inputs:** an id unique within the parent asset, projection year, non-negative cost, and an explicit non-negative residual value no greater than that addition's cost.
- **Formula/algorithm:** additions enter gross and carrying values in their stated year and are available for depreciation for that full projection year. The addition's residual value increases the cumulative asset floor. For every row, `opening carrying value + additions − depreciation = closing carrying value`, `opening gross value + additions = closing gross value`, and `accumulated depreciation = closing gross value − closing carrying value`.
- **Result:** additions remain visible in asset rows and aggregate yearly summaries; no addition is inferred in another year.
- **Rounding:** none.
- **Assumptions:** additions cannot precede the asset's depreciation start year and must fall within the projection. Multiple distinct additions may use the same year; the engine processes them in supplied order and combines their cost and residual values in that year's row. Duplicate addition ids are rejected.
- **Limitations:** no monthly/day timing, commissioning date, disposal, asset sale, gain/loss, revaluation, or impairment.

### Asset and aggregate schedules

- **Purpose:** provide deterministic asset-by-asset schedules and exact yearly totals for later consumers.
- **Inputs:** project identifier, positive whole projection period, and zero or more validated assets.
- **Formula/algorithm:** schedules begin at each asset's configured depreciation start year. Annual summaries sum every available asset row for opening/closing gross value, additions, annual depreciation, accumulated depreciation, and closing net carrying value. Years with no active asset rows contain canonical zeros.
- **Result:** `DepreciationSchedule` retains both canonical asset schedules and `AggregateDepreciationYear` summaries. Aggregate depreciation and carrying values exactly equal their underlying row sums.
- **Rounding:** no intermediate or summary rounding.
- **Validation:** negative costs, residuals, or additions; residual over related cost; duplicate addition ids; invalid projection/start/addition years; non-positive/non-whole useful life; rates outside 0–100%; missing method inputs; and incompatible or unsupported method configurations return typed failures.
- **Limitations:** no P&L, cash-flow, balance-sheet, taxation, interest, DSCR, IRR, NPV, subsidy, or scheme-specific integration. Companies Act and Income Tax Act rules, statutory rates, tax blocks, half-year rules, dates, disposals, revaluation, impairment, and lease accounting are explicitly deferred.

## Loan formula reference

Loan inputs and outputs remain currency-neutral canonical decimal strings. All authoritative money, rate, interest, power, payment, balance, and aggregation operations use `ProjectSetuDecimal`. Native numbers are used only for validated integer period counts, loop indices, and projection-year grouping.

### Nominal periodic interest rate

- **Purpose:** convert the configured annual percentage into the decimal factor used for each schedule period.
- **Inputs:** an explicit annual `Percentage` and one of `MONTHLY`, `QUARTERLY`, `HALF_YEARLY`, or `YEARLY`.
- **Formula/algorithm:** `periodic rate = (annual percent / 100) / periods per year`, where periods per year are respectively 12, 4, 2, and 1.
- **Result:** `DecimalValue`; for example, 12% monthly produces `"0.01"`.
- **Rounding:** no currency or display rounding; division uses the accepted 40-significant-digit decimal context.
- **Assumptions:** the annual input is a nominal annual rate allocated evenly across scheduled periods. Frequency is never inferred.
- **Limitations:** this is not an effective-annual-rate conversion and does not model dates, partial periods, daily accrual, or a 360/365/actual day count.

### Reducing-balance period interest

- **Purpose:** calculate transparent interest for one canonical repayment period.
- **Inputs:** the period's opening outstanding principal and its periodic decimal rate.
- **Formula/algorithm:** `interest charged = opening principal × periodic rate`.
- **Result:** exact `MonetaryAmount` interest charged, retained separately from principal repayment and interest payment.
- **Rounding:** no per-period currency rounding.
- **Assumptions:** scheduled period-based accrual only; after principal is repaid, later interest uses the reduced opening principal.
- **Limitations:** no fees, penalty interest, date-based accrual, irregular drawdowns, or lender-specific conventions.

### Equal-principal repayment

- **Purpose:** amortise principal in equal scheduled components while allowing interest and total payment to decline.
- **Inputs:** principal outstanding after any moratorium and the number of remaining amortization periods.
- **Formula/algorithm:** `scheduled principal = repayable principal / amortization periods`; each period pays current reducing-balance interest in addition. The final period repays its exact opening principal.
- **Result:** canonical schedule periods showing opening principal, interest, principal repayment, total payment, and closing principal.
- **Rounding:** intermediate amounts are not rounded to rupees or paise. The final-period principal is reconciled to the exact opening principal, so closing principal is exactly zero.
- **Assumptions:** principal repayment begins only after moratorium and is recalculated from post-moratorium principal when interest was capitalized.
- **Limitations:** no balloon, bullet, stepped, irregular, or rounded contractual instalments.

### EMI / equal-total-instalment repayment

- **Purpose:** calculate and apply a level total instalment to an amortising reducing-balance loan.
- **Inputs:** principal outstanding after moratorium (`P`), periodic decimal rate (`r`), and remaining amortization periods (`n`).
- **Formula/algorithm:** when `r > 0`, `payment = P × r × (1 + r)^n / ((1 + r)^n − 1)`. `decimal.js` performs the power and all arithmetic. For each period, `principal component = payment − interest charged`.
- **Result:** schedule periods with transparent interest and principal components. For zero interest, `payment = P / n`.
- **Rounding:** no practical-currency rounding is imposed. The final period repays its exact opening principal and recomputes total payment as principal plus current interest, deterministically absorbing the decimal-context residual.
- **Assumptions:** constant nominal periodic rate, regular equal-length indexed periods, and payment at each period boundary.
- **Limitations:** no changing/floating rates, advance EMI, fees, dates, prepayment, arrears, or lender-specific instalment rounding.

### Moratorium behavior

- **Purpose:** make payment deferral and interest treatment explicit instead of treating every moratorium alike.
- **Inputs:** `type`, whole schedule `periods`, and `interestTreatment`. Supported combinations are `PRINCIPAL_ONLY` with `PAY_CURRENT`, and `FULL_PAYMENT` with either `ACCRUE` or `CAPITALIZE`.
- **Formula/algorithm:** principal-only periods charge and pay current interest but repay no principal. Full-payment/accrual periods make no payment and add charged interest to a separate accrued-interest balance. Full-payment/capitalization periods make no payment and add charged interest to outstanding principal, so later interest is charged on the increased principal.
- **Result:** every period separately reports charged interest, paid interest, capitalized interest, opening/added/closing accrued interest, principal movement, and payment.
- **Rounding:** no moratorium-specific rounding.
- **Assumptions:** moratorium duration is a whole count at the configured schedule frequency. Accrued-but-not-capitalized interest remains separate and unpaid through this schedule because no payoff rule was configured.
- **Limitations:** unsupported type/treatment combinations fail. Partial periods, automatic month-to-quarter conversion, interest-on-accrued-interest, and inferred accrued-interest payoff are not implemented.

### Schedule validation, closure, and totals

- **Purpose:** produce a structurally valid, immutable amortization schedule and transparent totals.
- **Inputs:** `LoanTerms`, including principal, annual rate, total schedule periods, explicit frequency, repayment method, and optional moratorium.
- **Formula/algorithm:** moratorium periods occupy the beginning of the configured total schedule; remaining periods amortise principal. Summary principal repayment uses the exact balance identity `original principal + capitalized interest − ending principal`. Charged interest and paid interest remain separate.
- **Result:** `LoanRepaymentSchedule` containing canonical periods, `LoanRepaymentSummary`, and annual summaries.
- **Rounding:** no global or per-row currency rounding. Final-period reconciliation sets a completed amortising schedule's closing principal to canonical zero.
- **Assumptions:** positive principal requires a positive total period count and at least one post-moratorium amortization period. Zero principal returns a valid empty schedule with zero totals.
- **Limitations:** negative principal/rates, invalid counts, moratorium beyond the schedule, and unsupported runtime method/frequency values are typed failures. No dates or payoff quotation are produced.

### Annual loan aggregation

- **Purpose:** expose year-wise principal, interest, and debt service for later reports and viability calculations without duplicating loan formulas.
- **Inputs:** canonical `LoanRepaymentPeriod` rows with projection years assigned from sequence and explicit frequency (12/4/2/1 periods per year).
- **Formula/algorithm:** group rows by projection year and aggregate principal repaid, interest charged, interest paid, and total payment; carry the first opening and last closing principal/accrued balances. The final annual bucket deterministically reconciles only decimal-context summation tails to the canonical whole-schedule totals.
- **Result:** `AnnualLoanRepaymentSummary` rows with opening/closing principal, principal repaid, interest charged/paid, total debt service, and accrued-interest balances.
- **Rounding:** no reporting-scale rounding; annual totals exactly reconcile to canonical schedule-summary totals within the configured decimal context.
- **Assumptions:** projection year 1 begins at schedule period 1; no calendar start date is required.
- **Limitations:** no fiscal-year/calendar-date mapping, partial-year allocation, DSCR, cash-flow integration, or automatic decision about which charged/paid/accrued/capitalized interest is a P&L expense.

## Projected profit-and-loss formula reference

The P&L module is a composition/calculation engine, not another source of revenue, operating expenses, depreciation, or loan interest. Its authoritative calculation path is `Projection Engine totals + Depreciation Engine annual expense + explicitly normalized loan/accounting interest expense -> ProfitAndLossYearInput -> P&L formulas`. It imports no UI, persistence, scheme, subsidy, cash-flow, balance-sheet, or viability-metric code.

### Authoritative input boundary

- **Purpose:** isolate P&L composition from upstream line-item structures and prevent duplicate financial formulas.
- **Inputs:** sequential normalized rows containing year, total revenue, total operating expenses, annual depreciation expense, and explicitly designated interest expense. The interest contract forbids principal repayment/repaid, total debt service, disbursement, closing principal, interest charged/paid, capitalized interest, and accrued interest fields.
- **Algorithm:** copy the authoritative amounts unchanged into the matching P&L year. Revenue, operating expenses, depreciation, and interest are never recalculated.
- **Result:** `ProfitAndLossYearInput` rows suitable for deterministic statement calculation.
- **Rounding:** none.
- **Assumptions:** revenue and all expense inputs are non-negative, including legitimate zero values. Derived profits may be negative.
- **Limitations:** product/expense lines, asset additions and balances, principal repayment, disbursement, total debt service, and financing cash flows do not enter this boundary.

### EBITDA, EBIT, PBT, and PAT

- **Purpose:** derive the core projected P&L flow measures for each year.
- **Inputs:** one validated normalized row plus that year's selected generic tax treatment.
- **Formula/algorithm:** `EBITDA = revenue − operating expenses`; `EBIT = EBITDA − depreciation`; `profit before tax = EBIT − interest expense`; `profit after tax = profit before tax − tax expense`.
- **Result:** `ProfitAndLossYear` retains every authoritative input, derived subtotal, tax mode/rate where applicable, tax expense, and PAT.
- **Rounding:** none; every subtraction uses `ProjectSetuDecimal` and canonical monetary serialization.
- **Assumptions:** losses at EBITDA, EBIT, PBT, or PAT are valid outputs and are never rejected.
- **Limitations:** no gross-profit presentation, other income, exceptional items, extraordinary items, comprehensive income, dividends, retained earnings, or Companies Act/lender presentation format.

### Generic positive-PBT tax

- **Purpose:** support an explicit modelling tax without embedding statutory rules.
- **Inputs:** either `NO_TAX`, or `PERCENTAGE_OF_POSITIVE_PBT` with a source-backed 0–100 percent-point rate and optional unique yearly overrides.
- **Formula/algorithm:** `tax expense = max(profit before tax, 0) × tax rate / 100`; `NO_TAX` always produces zero. A yearly override replaces the base rate only for its exact year and does not compound or affect later years.
- **Result:** exact tax expense and PAT. Zero or negative PBT produces zero tax, so PAT equals PBT.
- **Rounding:** none; no currency, statutory, or display rounding is imposed.
- **Assumptions:** the caller supplies every rate. Entity type, turnover, activity, location, and scheme participation have no effect.
- **Limitations:** no Indian Income Tax Act rules, slabs, MAT, AMT, cess, surcharge, GST, deferred tax, loss carry-forward, tax credit, or tax-depreciation adjustment.

### Upstream year alignment and explicit zeros

- **Purpose:** deterministically compose independently calculated schedules without silently inventing values.
- **Inputs:** one project-scoped projection schedule, one project-scoped depreciation schedule, one project-scoped normalized interest-expense schedule, and a missing-value policy.
- **Algorithm:** projection years are the authoritative timeline. Project ids must match. Source years must be valid and unique; depreciation or interest years outside the projection fail. Every projection year requires matching depreciation and interest under the default `ERROR` policy. `USE_EXPLICIT_ZERO` must be selected independently for a missing source before zero may be inserted. A supplied canonical numeric zero is a present authoritative value and never triggers missing-value handling.
- **Result:** `composeProfitAndLossYearInputs` returns normalized aligned rows; `calculateProfitAndLossFromAuthoritativeSchedules` calculates the P&L from those rows.
- **Rounding:** none.
- **Assumptions:** P&L schedules currently use ProjectSetu projection-year indices `1..N`; sequential validation is a domain-composition convention, not a statutory accounting rule. A future adapter may attach calendar/fiscal-year labels without changing calculation semantics. Tax overrides identify an existing P&L year.
- **Limitations:** the loan engine exposes charged, paid, accrued, and capitalized interest separately. The P&L engine does not arbitrarily choose an accounting treatment; the caller must explicitly normalize the amount regarded as interest expense. Multiple-loan aggregation and capitalization policy remain upstream/deferred.

### Cumulative P&L flows

- **Purpose:** provide exact multi-year flow totals without treating any balance as a period expense.
- **Inputs:** calculated yearly P&L rows.
- **Formula/algorithm:** independently sum yearly revenue, operating expenses, EBITDA, depreciation, EBIT, interest expense, PBT, tax expense, and PAT.
- **Result:** `ProfitAndLossCumulativeTotals`, with every field exactly reconciling to its yearly row sum.
- **Rounding:** no intermediate or summary rounding.
- **Limitations:** margins are deferred; zero-revenue years therefore do not receive an invented 0% margin. No opening/closing balance-sheet values are summed.

## Projected cash-flow formula reference

The cash-flow module is a composition engine, not a second source of revenue, operating expenses, PAT, depreciation, loan principal, loan interest, working-capital requirements, project cost, or financing amounts. Its normalized path is `P&L PAT and depreciation + signed NWC change + cash capex + explicit financing inflows + loan principal and cash-interest payments -> CashFlowYearInput -> indirect-method cash-flow schedule`. It imports no UI, database, provider, scheme, subsidy, balance-sheet, or viability-metric code.

### Authoritative input and integration boundary

- **Purpose:** convert independently owned upstream values into one cash-impacting yearly contract without duplicating their formulas.
- **Inputs:** sequential normalized rows containing PAT, depreciation, signed change in NWC, capital expenditure, promoter contribution, loan disbursement, principal repayment, and cash interest paid, plus a source-backed initial opening cash balance.
- **Algorithm:** P&L contributes only PAT and depreciation. Tax is not subtracted again, depreciation is added back exactly once, and no operating expense is separately added back. The working-capital adapter calculates `current requirement - opening/previous requirement`; Year 1 requires a source-backed opening NWC and later years use the immediately preceding authoritative balance. The depreciation adapter maps each annual additions total once when the caller opts to treat it as cash purchases; it never derives capex from depreciation, gross assets, WDV, accumulated depreciation, or carrying value. The loan adapter maps only annual principal repaid and interest paid. Explicit financing rows supply promoter contribution and disbursement rather than inferring them from project cost.
- **Result:** `CashFlowYearInput` rows and a `CashFlowSchedule` that preserve every authoritative source value used in the cash calculation.
- **Rounding:** none.
- **Assumptions:** PAT already includes P&L tax. Task 009 assumes tax expense equals cash tax paid, so tax is not subtracted again. Startup/original asset purchases and non-cash acquisitions require explicit upstream normalization rather than being inferred from depreciation schedules. The upstream composition owner must prevent duplicate recognition when a depreciation addition and another normalized project-capex source describe the same purchase.
- **Limitations:** the engine does not choose whether a transaction occurred in cash, deduplicate capex sources, or recompute an upstream amount. Timing, identity, deduplication, and classification decisions remain with the authoritative normalization layer.

### Operating cash flow and signed NWC

- **Purpose:** derive initial indirect-method operating cash flow without reconstructing customer or supplier cash receipts and payments.
- **Inputs:** authoritative PAT, non-negative depreciation, and signed change in net working capital.
- **Formula/algorithm:** `operating cash flow = PAT + depreciation - change in NWC`, where `change in NWC = current-year NWC - prior-year NWC`.
- **Result:** a positive NWC change reduces cash; a negative change releases cash and increases operating cash flow. Depreciation is added back exactly once because it is non-cash.
- **Rounding:** none.
- **Assumptions:** Year 1 compares the first authoritative NWC requirement with the value of an explicit source-backed opening NWC assumption. Opening NWC is never inferred or defaulted. Every later year subtracts the immediately preceding authoritative requirement. An opening NWC of zero and Year 1 requirement of `500000` therefore produces change in NWC of `500000` and cash effect of `-500000`.
- **Limitations:** no other operating adjustment, deferred-tax/payable timing adjustment, receivable collection schedule, supplier payment schedule, inventory-purchase timing, GST cash flow, dividend, or direct-method statement.

### Investing cash flow

- **Purpose:** present actual normalized asset purchases/additions as cash investment.
- **Inputs:** non-negative cash capital expenditure.
- **Formula/algorithm:** `investing cash flow = -capital expenditure`.
- **Result:** capex is an investing outflow; zero capex produces zero investing cash flow.
- **Rounding:** none.
- **Assumptions:** the amount has already been identified upstream as an actual cash purchase/addition.
- **Limitations:** depreciation and asset book values are never cash flows. Asset disposals, sale proceeds, acquisitions, leases, and non-cash asset transactions are deferred.

### Financing cash flow and loan-payment boundary

- **Purpose:** separate source-backed finance inflows and actual debt cash payments from accounting expense and balance measures.
- **Inputs:** non-negative promoter/equity contribution, loan disbursement, principal repayment, and cash interest paid.
- **Formula/algorithm:** `financing cash flow = promoter contribution + loan disbursement - principal repayment - cash interest paid`.
- **Result:** principal repayment is a financing cash outflow only, never a P&L expense. Only explicitly normalized cash interest paid is an interest cash outflow.
- **Rounding:** none.
- **Assumptions:** annual loan `interestPaid` is an authoritative cash payment. The normalized loan-payment contract forbids interest charged, accrued interest, capitalized interest, total debt service, disbursement, and closing principal so those fields cannot be silently substituted. Classifying cash interest paid in financing is the current ProjectSetu reporting convention; a future explicitly configured presentation may classify it differently without changing the cash-paid boundary.
- **Limitations:** charged but unpaid, accrued unpaid, and capitalized interest are non-cash in the period unless another authoritative layer explicitly records a payment. Automatic overdrafts, revolving credit, working-capital loan draws, and scheme/subsidy financing are deferred.

### Net movement, balance continuity, and cumulative totals

- **Purpose:** reconcile cash sections into yearly balances without inventing financing for a deficit.
- **Inputs:** explicit source-backed initial opening cash plus calculated operating, investing, and financing cash flow.
- **Formula/algorithm:** `net cash movement = operating + investing + financing`; `closing cash = opening cash + net cash movement`; each next-year opening is the prior closing. Cumulative section and net totals are exact sums of rows to date.
- **Result:** `closing cash = initial opening cash + cumulative net cash movement` in every year. Cumulative net movement is not confused with closing cash when initial opening cash is non-zero.
- **Rounding:** no intermediate, yearly, or cumulative rounding; all authoritative arithmetic uses `ProjectSetuDecimal`.
- **Assumptions:** negative opening or closing cash is valid and reports an unmet financing position faithfully. No overdraft, additional loan, promoter contribution, or other balancing finance is automatically injected. Cash-flow schedules currently use ProjectSetu projection-year indices `1..N`; sequential validation is a composition convention, not a statutory accounting rule. A future adapter may map calendar or fiscal labels without changing formula semantics.
- **Limitations:** negative cash is not itself classified as an overdraft, financing gap, or infeasibility conclusion.

### Strict year alignment and explicit zeros

- **Purpose:** prevent missing or misaligned upstream periods from being silently dropped or fabricated.
- **Inputs:** one project-scoped P&L timeline and project-scoped working-capital-change, capex, financing-inflow, and loan-cash-payment schedules, plus an optional per-source missing-value policy.
- **Algorithm:** project ids must match. P&L years must be a non-empty sequential `1..N` series. All source years must be positive integers and unique; extra source years fail. Every P&L year requires every normalized source under the default `ERROR` policy. Only an independently selected `USE_EXPLICIT_ZERO` treatment inserts zero for a missing source.
- **Result:** aligned normalized rows that preserve supplied zeros as present authoritative data. A legitimate numeric zero never triggers missing-value behavior.
- **Rounding:** none.
- **Limitations:** one combined row per projection year; subannual timing and multiple-loan/capex-source aggregation remain upstream responsibilities.

## Typed calculation failures

`CalculationResult<T>` returns either a typed value or one or more `CalculationError` records. Structural failures include incomplete quantity/rate pairs, absent or duplicate yearly assumptions, invalid projection periods/overrides, negative projection quantities/prices, growth or escalation below −100%, invalid projection percentages, negative expenses, missing working-capital bases/day bases, invalid holding periods, invalid escalation periods, invalid depreciation costs/residuals/additions/lives/rates/years or method configurations, invalid loan principal/rates/periods, moratorium inconsistencies, invalid or duplicate P&L/source years, missing/misaligned P&L source values, negative authoritative P&L expenses, invalid tax configuration/rates/overrides, unsupported loan/tax configurations, missing cash-flow sources/opening cash, invalid or misaligned cash-flow years, project-id mismatches, and negative depreciation, capex, contribution, disbursement, principal repayment, or cash-interest payments. Decimal syntax remains enforced by the canonical constructors. Negative PAT, signed NWC changes, and cash balances remain valid cash-flow values.

## Future calculations

Manpower/pay-period totals, physical production and inventory flows, changing-rate or irregular loan behavior, accrued-interest payoff and expense/capitalization policies, statutory tax and depreciation, tax adjustments and payment timing, deferred tax, loss carry-forward, tax credits, partial-year depreciation, acquisitions/disposals, revaluation, impairment, lease accounting, P&L presentation extensions, margins, direct-method cash flow, collection/payment/inventory timing, GST cash flow, dividends, overdraft/revolving-credit balancing, working-capital loan draws, balance-sheet statements, subsidy cash flows and accounting, scheme eligibility, DSCR, IRR, NPV, other advanced metrics, sensitivity recalculation, and balance-sheet reconciliation remain deferred. Every future assumption must remain explicit and source-backed.
