# Financial engine

## Status

The decimal-safe arithmetic foundation, Core Financial Engine Phase 1, reusable term-loan repayment engine, and revenue/operating-expense projection engine are implemented. Phase 1 covers project cost, explicit single-year revenue and expense aggregation, escalation, means of finance, reconciliation, and core working capital. The projection engine adds deterministic multi-year quantity, capacity, selling-price, revenue, expense, and operating-surplus calculations. No rates or business defaults are embedded.

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
- **Limitations:** no fiscal-year/calendar-date mapping, partial-year allocation, DSCR, P&L, or cash-flow integration.

## Typed calculation failures

`CalculationResult<T>` returns either a typed value or one or more `CalculationError` records. Structural failures include incomplete quantity/rate pairs, absent or duplicate yearly assumptions, invalid projection periods/overrides, negative projection quantities/prices, growth or escalation below −100%, invalid projection percentages, negative expenses, missing working-capital bases/day bases, invalid holding periods, invalid escalation periods, invalid loan principal/rates/periods, moratorium inconsistencies, and unsupported loan method/frequency configurations. Decimal syntax remains enforced by the canonical constructors.

## Future calculations

Manpower/pay-period totals, physical production and inventory flows, changing-rate or irregular loan behavior, accrued-interest payoff policies, depreciation, interest integration, tax, P&L/cash-flow/balance-sheet statements, subsidy, scheme eligibility, DSCR, IRR, NPV, other advanced metrics, sensitivity recalculation, and balance-sheet reconciliation remain deferred. Every future assumption must remain explicit and source-backed.
