# Financial engine

## Status

The decimal-safe arithmetic foundation and deterministic financial engines through investment returns are implemented. The generic financing-program foundation additionally evaluates versioned eligibility, cost eligibility, expected benefits, funding constraints, compatibility, and assistance allocations without modifying any financial engine. It contains no live government-program percentages, caps, or compatibility assumptions. No rates or business defaults are embedded.

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
- Normalized balance-sheet inputs, point-in-time yearly results, source-backed accounting balances, retained-earnings and promoter-capital roll-forwards, strict composition policy, and exact reconciliation
- Normalized yearly metrics inputs, deterministic defined/undefined metric results, weighted Average DSCR, and strict authoritative-source adapters
- Explicit project/equity investment cash-flow series, periodic discounted cash flows, deterministic viability-metric states, IRR search policy, and strict project cash-flow composition
- Versioned financing-program definitions, registry resolution, normalized facts/rules, cost eligibility, financial benefits and traces, funding constraints, release metadata, compatibility rules, allocation ledgers, and program-stack results
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

| Formula/function                                                                                        | Module                                                     | Status      | Classification                                                        | Source/basis                                                                             | Test file                                            |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `calculateProjectCostLine`, `calculateProjectCost`                                                      | `src/domain/project-cost/calculations.ts`                  | Implemented | Arithmetic identity and documented fallback convention                | Explicit quantity/rate, stated amounts, and exact sums                                   | `src/domain/project-cost/calculations.test.ts`       |
| `calculateRevenueLine`, `calculateRevenueSummary`                                                       | `src/domain/operations/calculations.ts`                    | Implemented | Arithmetic identity                                                   | Explicit sales quantity multiplied by selling rate                                       | `src/domain/operations/calculations.test.ts`         |
| `escalateDecimalValue`                                                                                  | `src/domain/shared/calculation.ts`                         | Implemented | Arithmetic identity                                                   | Explicit compound-growth formula                                                         | `src/domain/shared/calculation.test.ts`              |
| `calculateOperatingInputLine`, `calculateOperatingInputCostSummary`, `calculateOperatingExpenseSummary` | `src/domain/operations/calculations.ts`                    | Implemented | Arithmetic identity and documented addition convention                | Explicit quantities, rates, additions, and exact sums                                    | `src/domain/operations/calculations.test.ts`         |
| `calculateMeansOfFinance`, `reconcileMeansOfFinance`                                                    | `src/domain/financing/calculations.ts`                     | Implemented | Arithmetic identity                                                   | Exact source sums and finance-minus-cost comparison                                      | `src/domain/financing/calculations.test.ts`          |
| `calculateHoldingPeriodRequirement`, `calculateWorkingCapitalLine`, `calculateWorkingCapital`           | `src/domain/working-capital/calculations.ts`               | Implemented | Arithmetic identity and domain convention                             | Caller-supplied annual bases, holding periods, day base, and margin                      | `src/domain/working-capital/calculations.test.ts`    |
| `calculatePeriodicInterestRate`                                                                         | `src/domain/loan/calculations.ts`                          | Implemented | Domain convention                                                     | Nominal annual percent factor divided by explicit periods per year                       | `src/domain/loan/calculations.test.ts`               |
| `calculatePeriodInterest`                                                                               | `src/domain/loan/calculations.ts`                          | Implemented | Standard financial mathematics                                        | Reducing-balance interest on opening principal                                           | `src/domain/loan/calculations.test.ts`               |
| `calculateEqualPrincipalAmount`                                                                         | `src/domain/loan/calculations.ts`                          | Implemented | Standard financial mathematics                                        | Repayable principal divided by amortization periods                                      | `src/domain/loan/calculations.test.ts`               |
| `calculateEmiPayment`                                                                                   | `src/domain/loan/calculations.ts`                          | Implemented | Standard financial mathematics                                        | Standard amortising-loan payment relationship, including zero-rate branch                | `src/domain/loan/calculations.test.ts`               |
| `generateLoanRepaymentSchedule`                                                                         | `src/domain/loan/calculations.ts`                          | Implemented | Standard financial mathematics and documented domain conventions      | Reducing-balance schedule, explicit moratorium policy, and final-period reconciliation   | `src/domain/loan/calculations.test.ts`               |
| `summarizeLoanScheduleByYear`                                                                           | `src/domain/loan/calculations.ts`                          | Implemented | Aggregation identity and projection-year convention                   | Canonical repayment periods grouped by frequency count                                   | `src/domain/loan/calculations.test.ts`               |
| `calculateRevenueProjection`                                                                            | `src/domain/projection/calculations.ts`                    | Implemented | Arithmetic identity and documented projection convention              | Quantity, capacity factor, unit price, explicit overrides, and compound growth           | `src/domain/projection/calculations.test.ts`         |
| `calculateOperatingExpenseProjection`                                                                   | `src/domain/projection/calculations.ts`                    | Implemented | Arithmetic identity and documented projection convention              | Fixed annual amounts or explicit percentage of projected revenue                         | `src/domain/projection/calculations.test.ts`         |
| `calculateRevenueAndOperatingExpenseProjection`                                                         | `src/domain/projection/calculations.ts`                    | Implemented | Aggregation identity                                                  | Canonical revenue less canonical operating expenses                                      | `src/domain/projection/calculations.test.ts`         |
| `calculateStraightLineAnnualDepreciation`, `calculateAssetDepreciationSchedule`                         | `src/domain/depreciation/calculations.ts`                  | Implemented | Standard accounting mathematics and documented timing convention      | Explicit cost, residual value, useful life, start year, and full-year additions          | `src/domain/depreciation/calculations.test.ts`       |
| `calculateWrittenDownValueDepreciation`, `calculateAssetDepreciationSchedule`                           | `src/domain/depreciation/calculations.ts`                  | Implemented | Standard accounting mathematics and documented timing convention      | Explicit opening carrying value, additions, rate, and residual floor                     | `src/domain/depreciation/calculations.test.ts`       |
| `calculateDepreciationSchedule`, `summarizeDepreciationByYear`                                          | `src/domain/depreciation/calculations.ts`                  | Implemented | Aggregation identity                                                  | Exact sums of canonical asset/year depreciation rows                                     | `src/domain/depreciation/calculations.test.ts`       |
| `calculatePercentageOfPositiveProfitBeforeTax`, `calculateProjectedProfitAndLoss`                       | `src/domain/profit-and-loss/calculations.ts`               | Implemented | Arithmetic identities and explicit generic tax convention             | Normalized authoritative flows and source-backed tax configuration                       | `src/domain/profit-and-loss/calculations.test.ts`    |
| `composeProfitAndLossYearInputs`, `calculateProfitAndLossFromAuthoritativeSchedules`                    | `src/domain/profit-and-loss/calculations.ts`               | Implemented | Strict composition and year-alignment convention                      | Projection totals, annual depreciation, and explicitly normalized interest expense       | `src/domain/profit-and-loss/calculations.test.ts`    |
| `calculateOperatingCashFlow`, `calculateInvestingCashFlow`, `calculateFinancingCashFlow`                | `src/domain/cash-flow/calculations.ts`                     | Implemented | Arithmetic identities and documented cash-classification rules        | Normalized PAT, depreciation, NWC change, capex, financing, and cash loan payments       | `src/domain/cash-flow/calculations.test.ts`          |
| `calculateCashFlowSchedule`                                                                             | `src/domain/cash-flow/calculations.ts`                     | Implemented | Arithmetic identities and exact balance-continuity convention         | Explicit opening cash and normalized sequential yearly cash-impacting values             | `src/domain/cash-flow/calculations.test.ts`          |
| `composeCashFlowYearInputs`, `calculateCashFlowFromAuthoritativeSchedules`                              | `src/domain/cash-flow/adapters.ts`                         | Implemented | Strict composition and year-alignment convention                      | P&L, working-capital changes, cash capex, financing inflows, and loan cash payments      | `src/domain/cash-flow/calculations.test.ts`          |
| `calculateNetFixedAssets`, `calculateClosingRetainedEarnings`, `calculateBalanceSheetSchedule`          | `src/domain/balance-sheet/calculations.ts`                 | Implemented | Accounting identities and exact reconciliation convention             | Normalized authoritative closing balances, PAT, and explicit adjustments                 | `src/domain/balance-sheet/calculations.test.ts`      |
| `adaptDepreciationScheduleToBalanceSheetFixedAssets`, `adaptCashFlowScheduleToBalanceSheetCash`         | `src/domain/balance-sheet/adapters.ts`                     | Implemented | Strict authoritative-balance mapping                                  | Depreciation closing balances and cash-flow closing cash                                 | `src/domain/balance-sheet/calculations.test.ts`      |
| `adaptLoanScheduleToBalanceSheetOutstanding`, `adaptFinancingInflowsToPromoterCapital`                  | `src/domain/balance-sheet/adapters.ts`                     | Implemented | Strict balance mapping and explicit roll-forward convention           | Loan closing principal and explicit yearly promoter contributions                        | `src/domain/balance-sheet/calculations.test.ts`      |
| `composeBalanceSheetYearInputs`, `calculateBalanceSheetFromAuthoritativeSchedules`                      | `src/domain/balance-sheet/adapters.ts`                     | Implemented | Strict composition, debt-classification, and year-alignment rules     | P&L, depreciation, cash flow, loan, financing, and accounting-balance schedules          | `src/domain/balance-sheet/calculations.test.ts`      |
| `calculateDscr`, `calculateAverageDscr`, `calculateInterestCoverageRatio`                               | `src/domain/metrics/calculations.ts`                       | Implemented | Explicit ProjectSetu bankability conventions                          | Authoritative PAT, depreciation, recognized interest, principal repayment, and EBIT      | `src/domain/metrics/calculations.test.ts`            |
| `calculateDebtEquityRatio`, `calculateCurrentRatio`                                                     | `src/domain/metrics/calculations.ts`                       | Implemented | Ratio identities with explicit undefined states                       | Authoritative balance-sheet totals and classified interest-bearing debt                  | `src/domain/metrics/calculations.test.ts`            |
| `calculateBreakEvenMetrics`                                                                             | `src/domain/metrics/calculations.ts`                       | Implemented | Contribution identities and explicit cost-classification boundary     | Authoritative revenue plus explicitly normalized fixed and variable costs                | `src/domain/metrics/calculations.test.ts`            |
| `calculateRoi`, `calculateRoce`, `calculateProfitabilityMargins`                                        | `src/domain/metrics/calculations.ts`                       | Implemented | Explicit ProjectSetu return and margin conventions                    | Authoritative P&L, project-cost, and balance-sheet values                                | `src/domain/metrics/calculations.test.ts`            |
| `composeBankabilityMetricsYearInputs`, `calculateBankabilityMetricsFromAuthoritativeSchedules`          | `src/domain/metrics/adapters.ts`                           | Implemented | Strict authoritative composition and year alignment                   | Normalized P&L, loan principal, balance sheet, project cost, and cost classification     | `src/domain/metrics/calculations.test.ts`            |
| `calculateNetPresentValue`                                                                              | `src/domain/investment-returns/calculations.ts`            | Implemented | Standard periodic financial mathematics                               | Explicit periodic investment cash flows and source-backed discount rate                  | `src/domain/investment-returns/calculations.test.ts` |
| `calculateInternalRateOfReturn`                                                                         | `src/domain/investment-returns/calculations.ts`            | Implemented | Standard periodic financial mathematics and numerical convention      | Decimal.js bracket expansion and bisection over explicit periodic cash flows             | `src/domain/investment-returns/calculations.test.ts` |
| `calculateSimplePaybackPeriod`, `calculateDiscountedPaybackPeriod`                                      | `src/domain/investment-returns/calculations.ts`            | Implemented | Standard recovery mathematics and documented interpolation            | Exact cumulative nominal or discounted investment cash flows                             | `src/domain/investment-returns/calculations.test.ts` |
| `calculateProfitabilityIndex`, `calculateInvestmentReturns`                                             | `src/domain/investment-returns/calculations.ts`            | Implemented | Standard periodic financial mathematics and aggregation               | Explicit period-0 investment, future positive inflows, and independently supplied rates  | `src/domain/investment-returns/calculations.test.ts` |
| `composeProjectInvestmentCashFlowSeries`                                                                | `src/domain/investment-returns/adapters.ts`                | Implemented | Strict source composition and perspective boundary                    | Explicit investment, operating project cash flow, working capital, capex, and recoveries | `src/domain/investment-returns/calculations.test.ts` |
| `evaluateProgramEligibility`, `calculateCostEligibility`                                                | `src/domain/schemes/eligibility.ts`, `cost-eligibility.ts` | Implemented | Versioned deterministic rule evaluation and exact cost reconciliation | Normalized facts, cost items, rule configurations, and source references                 | `src/domain/schemes/calculations.test.ts`            |
| `calculateFinancialBenefits`, `calculateProgramFundingConstraint`                                       | `src/domain/schemes/benefits.ts`, `calculations.ts`        | Implemented | Configured Decimal.js benefit and compliance calculations             | Explicit eligible basis, rate/fixed/per-unit inputs, caps, and financing facts           | `src/domain/schemes/calculations.test.ts`            |
| `evaluateProgramCompatibility`, `validateAssistanceAllocations`, `evaluateProgramStack`                 | `src/domain/schemes/compatibility.ts`, `evaluation.ts`     | Implemented | Versioned convergence and conservative conflict convention            | Explicit compatibility rules, benefit types, same-cost policy, and allocation ledger     | `src/domain/schemes/calculations.test.ts`            |
| `registerProgramDefinition`, `resolveProgramVersion`, `listActivePrograms`                              | `src/domain/schemes/registry.ts`                           | Implemented | Append-only version registry and as-of-date convention                | Stable program/version identity, effective dates, lifecycle, and provenance              | `src/domain/schemes/registry.test.ts`                |

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
- **Limitations:** margins are not calculated inside P&L; the downstream metrics module calculates them from copied P&L outputs and represents zero-revenue margins as undefined. No opening/closing balance-sheet values are summed.

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

## Projected balance-sheet formula reference

The balance-sheet module is a point-in-time composition engine. It copies authoritative closing balances and derives only accounting identities, retained-earnings continuity, promoter-capital continuity, and reconciliation. It does not recalculate revenue, operating expenses, PAT, depreciation, cash movement, loan principal, interest, project cost, working-capital requirements, promoter contributions, or financing. It imports no UI, database, scheme, subsidy, lender-format, or viability-metric code.

### Point-in-time normalized boundary

- **Purpose:** represent each projected year's independent closing financial position without confusing balances with period flows.
- **Inputs:** `BalanceSheetYearInput` supplies gross assets, accumulated depreciation, detailed current assets, non-negative cash, explicitly classified debt, payables, other current liabilities, promoter capital, PAT, retained-earnings adjustments, and other equity. `BalanceSheetProjectionInput` adds project identity and source-backed opening retained earnings.
- **Algorithm:** validate the sequential `1..N` rows and calculate each closing position independently. Only retained earnings carries between years inside the core schedule.
- **Result:** `BalanceSheetSchedule` contains yearly point-in-time rows and deliberately has no cumulative asset, cash, loan, liability, equity, or total-balance sums.
- **Rounding:** none; all authoritative arithmetic uses `ProjectSetuDecimal`.
- **Assumptions:** `1..N` is a ProjectSetu projection convention, not a statutory accounting requirement. Calendar or fiscal labels may be mapped later without changing formula semantics.
- **Limitations:** no subannual closing dates, opening trial balance, comparative statutory columns, consolidation, or Companies Act/lender presentation.

### Fixed assets and total assets

- **Purpose:** derive asset totals without accepting contradictory net-fixed-asset or aggregate totals.
- **Inputs:** non-negative gross fixed assets and accumulated depreciation, plus non-negative inventory, receivables, other current assets, and cash and bank.
- **Formula/algorithm:** `net fixed assets = gross fixed assets - accumulated depreciation`; `total current assets = inventory + receivables + other current assets + cash and bank`; `total assets = net fixed assets + total current assets`.
- **Result:** exact asset balances, with accumulated depreciation forbidden from exceeding gross fixed assets.
- **Rounding:** none.
- **Assumptions:** the depreciation adapter copies closing gross assets and accumulated depreciation and verifies `gross - accumulated = authoritative closing net carrying value`. Asset additions are already included in authoritative gross assets.
- **Limitations:** depreciation expense is never an asset. No disposals, revaluation, impairment, leases, detailed inventory accounting, receivable ageing, or bad-debt provision.

### Cash mapping and negative-cash policy

- **Purpose:** use cash-flow output as the sole cash authority without hiding a financing deficit.
- **Inputs:** yearly `CashFlowSchedule.closingCash`.
- **Algorithm:** copy a non-negative closing balance exactly to `cashAndBank`. Zero is valid. A negative balance returns `NEGATIVE_CASH_REQUIRES_EXPLICIT_FINANCING_CLASSIFICATION` rather than converting its sign or creating a liability.
- **Result:** exact cash mapping or a typed composition failure requiring explicit accounting classification.
- **Rounding:** none.
- **Assumptions:** the cash-flow engine already calculated and reconciled closing cash.
- **Limitations:** no automatic overdraft, working-capital borrowing, additional loan, promoter funding, balancing finance, or cash recalculation.

### Liabilities and loan classification

- **Purpose:** separate authoritative closing principal from accounting maturity classification and prevent double-counting.
- **Inputs:** Loan Engine total closing principal, source-backed long-term/current classification, payables, and other current liabilities.
- **Formula/algorithm:** require `long-term loan outstanding + current debt = authoritative total closing principal`; calculate `total current liabilities = current debt + payables + other current liabilities`; then `total liabilities = long-term loan outstanding + total current liabilities`.
- **Result:** exact current/non-current debt balances, total current liabilities, and total liabilities. A classification mismatch is a typed input/composition failure, not an unbalanced statement.
- **Rounding:** none.
- **Assumptions:** the Loan Engine does not provide accounting maturity classification. `longTermLoanOutstanding` therefore means the non-current portion when `currentDebt` is separately supplied.
- **Limitations:** principal repayment is not an expense or closing balance. Interest expense/payment, accrued unpaid interest, and capitalized-interest fields are not separately added to principal. Multiple loans, other borrowings, maturity buckets, accrued-interest liabilities, GST/tax payables, and ageing are upstream or deferred.

### Promoter capital and retained earnings

- **Purpose:** derive equity balances from explicit opening balances and authoritative movements rather than from the accounting difference.
- **Inputs:** source-backed opening promoter capital plus explicit annual promoter contributions; source-backed opening retained earnings plus authoritative P&L PAT and explicit signed retained-earnings adjustments; explicit signed other equity.
- **Formula/algorithm:** `closing promoter capital = opening promoter capital + contribution`; `closing retained earnings = opening retained earnings + PAT + retained-earnings adjustments`; next-year openings equal prior closings exactly; `total equity = promoter capital + closing retained earnings + other equity`.
- **Result:** point-in-time promoter capital and retained earnings. Negative PAT, retained earnings, other equity, and total equity are valid.
- **Rounding:** none.
- **Assumptions:** annual promoter contribution is an equity movement, not revenue or expense. Loan disbursement never enters promoter capital. PAT is copied and never recalculated.
- **Limitations:** dividends/distributions remain deferred unless explicitly normalized as a generic retained-earnings adjustment. No share-premium rules, preference shares, partner current accounts, proprietor drawings, or equity-class statutory presentation.

### Balance equation and no-plug rule

- **Purpose:** expose assumption inconsistency rather than concealing it.
- **Inputs:** calculated total assets, liabilities, and equity.
- **Formula/algorithm:** `balance difference = total assets - total liabilities - total equity`; `isBalanced = balance difference == 0` using exact Decimal.js equality.
- **Result:** valid inputs always produce a yearly result, whether balanced or not. A non-zero difference yields `isBalanced = false` and remains visible with its exact sign and amount.
- **Rounding:** no tolerance or intermediate rounding.
- **Assumptions:** being unbalanced is a diagnostic result, not an invalid-input error.
- **Limitations:** the engine never creates or changes cash, other assets, reserves, promoter capital, loans, liabilities, suspense, miscellaneous, or any other plug account to force equality.

### Authoritative composition, accounting balances, and explicit zeros

- **Purpose:** align independently owned schedules without silently inventing periods or semantic mappings.
- **Inputs:** project-scoped P&L, fixed-asset, cash, total-loan, debt-classification, promoter-capital, and source-backed accounting-balance schedules, plus a per-source missing-value policy.
- **Algorithm:** use P&L as the sequential timeline; require matching project ids; reject invalid, duplicate, extra, and missing years; verify fixed-asset and promoter-capital roll-forwards; and reconcile debt classification to total closing principal. Strict `ERROR` is the default. Only a specifically selected `USE_EXPLICIT_ZERO` treatment converts a missing source row to canonical zero.
- **Result:** `composeBalanceSheetYearInputs` copies authoritative values unchanged into normalized rows; `calculateBalanceSheetFromAuthoritativeSchedules` calculates only legitimate statement identities.
- **Rounding:** none.
- **Assumptions:** supplied numeric zero is present data and never treated as missing. Inventory, receivables, payables, other balances, debt classification, retained-earnings adjustments, and other equity remain explicit source-backed accounting inputs.
- **Limitations:** Working Capital Engine requirement/gap is not assumed to equal inventory, current assets, NWC, receivables, or payables. The engine does not infer any accounting balance from a financing requirement or from the balance difference.

## Financial-ratios and bankability-metrics formula reference

All Task 011 functions consume normalized authoritative values and return canonical Decimal.js strings. `MetricResult` contains `{ status: "DEFINED", value }` only when a metric is mathematically defined. An undefined result contains a deterministic status and no value; it never substitutes zero, `NaN`, or `Infinity`. Negative PAT, EBITDA, EBIT, PBT, defined margins, ROI, coverage, and DSCR are valid. Negative depreciation, recognized interest, principal repayment, project cost, fixed or variable costs, debt, and ordinary non-negative accounting balances are rejected.

### DSCR and Average DSCR

- **Purpose:** measure annual and aggregate capacity to service explicitly normalized debt obligations.
- **Inputs:** authoritative PAT, depreciation, recognized P&L interest expense, and authoritative principal repayment for each year.
- **Formulas:** `CADS = PAT + depreciation + interest`; `debt service = principal + interest`; `DSCR = CADS / debt service`; `Average DSCR = sum(CADS) / sum(debt service)`.
- **Result:** annual `DscrYearResult` plus `AverageDscrResult`. Zero annual debt service yields `UNDEFINED_ZERO_DENOMINATOR`. Average totals include only years with positive debt service; if total included debt service is zero, Average DSCR is undefined.
- **Rounding:** none beyond the accepted Decimal.js precision context.
- **Assumptions:** this is the explicit ProjectSetu Task 011 DPR-style convention. Average DSCR is a weighted total ratio, not a simple arithmetic mean of annual DSCR values.
- **Limitations:** recognized interest is copied from P&L. The loan adapter supplies principal only and never chooses charged, paid, accrued, or capitalized interest. Lender-specific DSCR variants remain configurable future work.

### Interest coverage

- **Purpose:** measure EBIT coverage of recognized interest expense.
- **Inputs:** authoritative EBIT and recognized P&L interest.
- **Formula:** `interest coverage ratio = EBIT / interest`.
- **Result:** a defined ratio when interest is positive; zero interest yields `UNDEFINED_ZERO_DENOMINATOR`. Negative EBIT produces valid negative coverage.
- **Rounding:** none.
- **Limitations:** this is EBIT coverage, not an unnamed EBITDA-based variant.

### Debt-equity and current ratio

- **Purpose:** measure closing interest-bearing leverage and current liquidity.
- **Inputs:** authoritative long-term debt, current debt, total equity, total current assets, and total current liabilities from the balance sheet.
- **Formulas:** `interest-bearing debt = long-term debt + current debt`; `debt-equity = interest-bearing debt / total equity`; `current ratio = total current assets / total current liabilities`.
- **Result:** zero debt with positive equity is a defined zero. Zero equity or current liabilities yields `UNDEFINED_ZERO_DENOMINATOR`; negative equity yields `UNDEFINED_NEGATIVE_EQUITY` and is never made positive with an absolute value.
- **Rounding:** none.
- **Assumptions:** trade payables and other non-interest-bearing liabilities are not debt-equity numerator items. The balance-sheet engine exposes authoritative `totalCurrentLiabilities = current debt + payables + other current liabilities`; the metrics adapter copies and reconciles it.
- **Limitations:** no lender gearing threshold, tangible-net-worth adjustment, subordinated-debt treatment, or off-balance-sheet debt rule.

### Contribution and break-even

- **Purpose:** calculate sales needed to cover explicitly classified fixed costs.
- **Inputs:** authoritative yearly revenue plus explicitly normalized variable and fixed costs.
- **Formulas:** `contribution = revenue - variable costs`; `CMR = contribution / revenue`; `break-even sales = fixed costs / CMR`, equivalently `fixed costs × revenue / contribution`; `break-even percentage = break-even sales / revenue × 100`.
- **Result:** zero fixed costs with positive contribution produces zero break-even sales. Zero revenue makes all revenue-denominated metrics undefined. A zero or negative contribution retains its mathematically defined CMR when revenue is positive, but break-even sales and percentage use `UNDEFINED_NON_POSITIVE_CONTRIBUTION`.
- **Rounding:** none.
- **Assumptions:** the same authoritative revenue basis is required for P&L and break-even in every year. Each projection expense, including custom items, requires exactly one source-backed `FIXED` or `VARIABLE` classification.
- **Limitations:** expense categories and fixed-annual/percentage-of-revenue methods never silently determine cost behavior. Capacity-based break-even and richer semi-variable classifications are deferred.

### ROI and ROCE

- **Purpose:** calculate explicit yearly return measures without inventing aggregate investment analysis.
- **Inputs:** authoritative PAT, total project cost, EBIT, total assets, and total current liabilities.
- **Formulas:** `ROI = PAT / total project cost × 100`; `capital employed = total assets - total current liabilities`; `ROCE = EBIT / capital employed × 100`.
- **Result:** the same authoritative total-project-cost base is used for every yearly ROI. Zero denominators are undefined. Negative PAT or EBIT yields a valid negative defined return. Negative capital employed yields `UNDEFINED_NEGATIVE_CAPITAL_EMPLOYED` rather than an absolute-value ratio.
- **Rounding:** none.
- **Assumptions:** `total assets - current liabilities` is the sole ProjectSetu Task 011 capital-employed definition and does not change between years or mix with the alternative equity-plus-non-current-debt presentation.
- **Limitations:** no cumulative ROI, ROE, or average-capital denominator is calculated in the metrics module. The dedicated investment-returns module owns NPV, IRR, simple and discounted payback, and profitability index; MIRR remains deferred.

### Profitability margins

- **Purpose:** express authoritative P&L subtotals as percentages of authoritative revenue.
- **Formulas:** `EBITDA margin = EBITDA / revenue × 100`; `EBIT margin = EBIT / revenue × 100`; `PBT margin = PBT / revenue × 100`; `PAT margin = PAT / revenue × 100`.
- **Result:** zero revenue yields `UNDEFINED_ZERO_DENOMINATOR` for every margin. A zero numerator with positive revenue yields defined zero, and negative numerators yield valid negative margins.
- **Rounding:** none.
- **Limitations:** no gross-profit, industry benchmark, or lender acceptance interpretation.

### Authoritative metrics composition and year alignment

- **Purpose:** align normalized owners without duplicating their financial formulas.
- **Inputs:** P&L revenue, EBITDA, EBIT, PBT, PAT, depreciation, and recognized interest; loan principal repayment; balance-sheet totals and classified debt; total project cost; and projection amounts with explicit cost classifications.
- **Algorithm:** adapters copy upstream values; cost classification sums only explicitly classified projection lines. Composition uses P&L as the sequential `1..N` timeline, requires a single project id, rejects invalid, duplicate, missing, extra, and out-of-order years, and verifies that break-even revenue exactly equals the same year's P&L revenue. Missing authoritative source data fails; a supplied canonical zero is valid data and may produce an undefined mathematical result.
- **Result:** normalized `BankabilityMetricsYearInput` rows and a `BankabilityMetricsSchedule` containing yearly results plus weighted Average DSCR. No average is invented for current ratio, debt-equity, ROI, ROCE, or margins.
- **Rounding:** no intermediate rounding; all arithmetic and comparisons use `ProjectSetuDecimal`.
- **Assumptions:** `1..N` is a current ProjectSetu projection convention, not a statutory accounting requirement. Future adapters may map fiscal/calendar labels without changing formulas.
- **Limitations:** the engine measures and does not approve. It has no lender, scheme, PMEGP, NLM, PMFME, subsidy, credit-score, CIBIL, collateral, drawing-power, CMA, industry-benchmark, UI, database, or report-rendering logic.

## Investment-returns formula reference

All Task 012 functions operate on an explicit `InvestmentCashFlowSeries` with sequential periods `0..N`. Period 0 is the present; later periods are equally spaced projection periods. Every financial operation, including discount factors, NPV evaluations, IRR bounds and midpoints, interpolation, and reconciliation, uses Decimal.js without intermediate presentation rounding.

### Cash-flow perspective and project composition

- **Purpose:** preserve the economic meaning of the cash-flow stream before applying return formulas.
- **Inputs:** a series explicitly labelled `PROJECT_RETURN` or `EQUITY_RETURN`. The project adapter accepts source-backed initial investment, operating project cash flow, working-capital investment, capital expenditure, other explicitly normalized investment cash flow, and optional explicitly source-backed terminal value and working-capital recovery.
- **Project formula:** `net investment cash flow = operating project cash flow + terminal value + working-capital recovery + other explicit investment cash flow - initial investment - working-capital investment - capital expenditure`.
- **Boundary:** project cash flow excludes promoter contribution, loan disbursement, principal repayment, and cash interest. PAT, EBITDA, EBIT, closing cash, net cash movement, loan outstanding, and balance-sheet totals are neither accepted nor inferred as investment cash flow. A caller may supply an already-authoritative equity-return series, but no equity adapter invents distributions from accounting or financing schedules.
- **Timing:** initial investment is allowed only at period 0. Later explicit investment enters as capex or working-capital investment. Terminal value and working-capital recovery are included only in the period in which the caller supplies them; omission contributes zero and never triggers inference at the horizon.
- **Rounding:** none.
- **Limitations:** duplicate recognition is prevented by upstream normalization responsibility, not by guessing whether differently named source items represent the same cash flow. Calendar dates and irregular periods are deferred.

### Net present value

- **Purpose:** measure the present-value surplus of an explicit periodic cash-flow stream.
- **Inputs:** sequential cash flows `CF_t` and a source-backed non-negative periodic discount rate `r`, expressed in percent points.
- **Formula:** `NPV = sum(CF_t / (1 + r)^t)` for `t = 0..N`. Period 0 therefore has discount factor 1.
- **Result:** each `DiscountedCashFlowRow` exposes its cash flow, discount-factor multiplier, present value, and cumulative present value; the final cumulative value reconciles exactly to NPV.
- **Rounding:** none beyond the configured Decimal.js precision context.
- **Assumptions:** periods are equally spaced and the supplied rate matches that periodicity. The engine does not select a cost of capital, hurdle rate, or scheme rate.
- **Limitations:** negative discount rates, XNPV, date-based discounting, inflation decomposition, and risk-adjusted rate construction are deferred.

### Internal rate of return

- **Purpose:** find the periodic rate at which NPV is zero without using native floating-point root arithmetic.
- **Inputs:** an explicit periodic cash-flow series and an explicit `IrrSearchPolicy`, or the documented default Decimal.js search policy.
- **Algorithm:** ignore zero cash flows when counting signs; zero sign changes returns `UNDEFINED_NO_SIGN_CHANGE`. More than one sign change can permit multiple IRRs but does not prove multiple roots exist, so Task 012 returns `AMBIGUOUS_MULTIPLE_IRR_POSSIBLE` instead of claiming the first root found is unique. For exactly one sign change, check 0% exactly, then search strictly above −100% using deterministic upper-bound expansion and bisection. Exact roots on initial or expanded boundaries are accepted. A rate is defined only when its Decimal NPV residual meets the configured NPV tolerance; rate-interval, bracket-expansion, or iteration exhaustion otherwise returns `NUMERICAL_CONVERGENCE_FAILURE`.
- **Result:** a defined unrounded periodic rate in percent points, its residual NPV and iteration count; or a deterministic non-defined status with no fabricated rate.
- **Rounding:** none.
- **Assumptions:** equally spaced periods and a conventional single-sign-change cash-flow pattern. The engine reports ambiguity rather than choosing among possible roots.
- **Limitations:** MIRR, XIRR, arbitrary dates, polynomial root enumeration, and automated economic interpretation are deferred.

### Simple and discounted payback

- **Purpose:** identify when cumulative investment cash flow becomes non-negative.
- **Inputs:** nominal cash flows for simple payback; the same explicit cash flows plus source-backed discount rate for discounted payback.
- **Formula:** cumulative cash flow is summed exactly. If recovery occurs within period `k`, fractional payback is `(k - 1) + unrecovered amount before k / recovery cash flow in k`. Discounted payback applies the same rule to present values.
- **Result:** defined payback, zero when the series is non-negative from period 0, or `NOT_RECOVERED_WITHIN_HORIZON`. Every cumulative row is exposed for exact audit and reconciliation.
- **Rounding:** none.
- **Limitations:** payback records conventional first recovery. A later non-conventional negative flow does not revoke it, so post-recovery cash-flow risk must be evaluated separately. Discounted payback depends on the caller's supplied discount rate. No maximum-acceptable-payback rule is embedded.

### Profitability index and aggregate analysis

- **Purpose:** compare discounted future positive inflows with the absolute period-0 investment for a canonical investment pattern.
- **Formula:** `PI = present value of future positive cash flows / abs(period-0 investment)`.
- **Result:** period-0 zero returns `UNDEFINED_ZERO_INITIAL_INVESTMENT`; a positive period-0 flow or any later negative flow returns `INVALID_CASH_FLOW_PATTERN`. These PI restrictions do not invalidate NPV for an otherwise valid signed series. `calculateInvestmentReturns` returns NPV, IRR, simple payback, discounted payback, and PI from the same authoritative series.
- **Rounding:** none.
- **Assumptions:** PI deliberately uses a canonical initial-outlay/future-inflow pattern so that the numerator and denominator remain unambiguous.
- **Limitations:** no ranking, minimum PI, hurdle rate, sanction decision, lender threshold, or scheme eligibility conclusion is produced.

## Generic financing-program calculations

The program engine evaluates already-versioned definitions; it does not fetch, infer, or recommend rules. Cost eligibility applies configured inclusion/exclusion and caps line by line, then reconciles `eligible + ineligible = total` exactly. Percentage assistance uses `raw benefit = configured basis × configured rate`; fixed and per-unit methods use their explicit inputs. Minimums and applicable caps produce `calculatedEligibleBenefit`, never sanctioned or received assistance. Contribution and bank-finance calculations report compliance and shortfall without changing authoritative financing.

All monetary aggregation, percentages, caps, per-unit multiplication, proportional allocations, shortfalls, and cost-limit comparisons use `ProjectSetuDecimal` without intermediate rounding. Compatibility is not arithmetic permission: absent program/version convergence rules yield `UNKNOWN`, manual review, and a conflict. Same-cost assistance is accepted only under the configured policy; otherwise the allocation ledger reports double funding, benefit incompatibility, or overlapping bases. `selectedPrograms = []` bypasses scheme evaluation and returns normal `BANKABLE_PROJECT` mode.

See [Scheme, program, and assistance engine](scheme-engine.md) for generic versioning, provenance, facts, rule semantics, release models, lifecycle behavior, and update workflow. See [PMEGP versioned program definitions](pmegp-program.md) for the independent new-enterprise/upgradation formulas and limits. PMEGP consumes normalized costs and reports constraints; it does not alter any core financial-engine result.

## Typed calculation failures

`CalculationResult<T>` returns either a typed value or one or more `CalculationError` records. Structural failures include incomplete quantity/rate pairs, absent or duplicate yearly assumptions, invalid projection periods/overrides, negative projection quantities/prices, growth or escalation below −100%, invalid projection percentages, negative expenses, missing working-capital bases/day bases, invalid holding periods, invalid escalation periods, invalid depreciation costs/residuals/additions/lives/rates/years or method configurations, invalid loan principal/rates/periods, moratorium inconsistencies, invalid or duplicate P&L/source years, missing/misaligned P&L source values, negative authoritative P&L expenses, invalid tax configuration/rates/overrides, unsupported loan/tax configurations, missing cash-flow sources/opening cash, invalid or misaligned cash-flow years, project-id mismatches, negative cash-flow inputs, invalid or duplicate balance-sheet/source years, missing balance-sheet sources/opening retained earnings, negative ordinary asset/liability/capital balances, accumulated depreciation over gross assets, inconsistent authoritative fixed-asset balances, negative cash mapping, promoter-capital continuity failures, debt-classification mismatches, missing/misaligned metrics sources, inconsistent break-even revenue, unsourced/duplicate cost classifications, negative non-negative metrics inputs, invalid or non-sequential investment periods, invalid discount rates or IRR search policies, missing project investment components, negative non-negative project investment components, later-period initial investment, and forbidden financing/accounting fields in a project-return adapter. Decimal syntax remains enforced by canonical constructors. Valid unbalanced statements, negative PAT, EBITDA, EBIT, PBT, retained earnings, other equity, total equity, defined returns, margins, coverage, DSCR, project operating cash flow, and signed investment cash flow are not calculation failures. Mathematically undefined investment patterns, IRR ambiguity, non-recovery within the horizon, and numerical non-convergence are successful typed states rather than fabricated numbers.

## Future calculations

Manpower/pay-period totals, physical production and inventory flows, changing-rate or irregular loan behavior, accrued-interest payoff and expense/capitalization policies, statutory tax and depreciation, tax adjustments and payment timing, deferred tax, loss carry-forward, tax credits, partial-year depreciation, acquisitions/disposals, revaluation, impairment, lease accounting, P&L presentation extensions, direct-method cash flow, collection/payment/inventory timing, GST cash flow and balances, dividends, overdraft/revolving-credit balancing, working-capital loan draws, detailed accounting subledgers and ageing, statutory/lender balance-sheet formats, consolidation, subsidy cash-flow/accounting recognition, authoritative live-program definitions, recommendation/optimization, sanction/release tracking, MIRR, XIRR, XNPV, irregular-date returns, advanced investment ranking, lender-specific formulas/thresholds, and sensitivity recalculation remain deferred. Every future assumption must remain explicit and source-backed.
