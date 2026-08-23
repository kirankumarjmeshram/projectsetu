# Canonical domain model

## Status

The TypeScript contracts, Core Financial Engine Phase 1 arithmetic identities, deterministic term-loan repayment engine, revenue/operating-expense projection engine, asset-wise depreciation engine, and projected profit-and-loss engine listed below are implemented in `src/domain`. Scheme rules, persistence mappings, runtime schemas, UI forms, report rendering, cash-flow/balance-sheet generation, advanced metrics, and provider integrations are not implemented.

## Shared contracts

- `Identifier`, ISO date aliases, `DateRange`, `ProjectionYear`, and audit metadata provide lightweight common vocabulary.
- `DecimalValue`, `MonetaryAmount`, and `Percentage` are distinct branded, canonical decimal-string contracts created by strict constructors.
- `ProjectSetuDecimal` is the accepted arbitrary-precision calculation primitive configured to 40 significant digits with half-even precision rounding.
- Percentages use percent points: `percentage("10")` means 10% and converts explicitly to the calculation factor `0.1`.
- `Assumption<T>` requires a source for traceable assumptions.
- `SourceReference` supports official guidelines, quotations, user input, estimates, consultant assumptions, historical data, system calculations, and extensible notes without requiring a URL.
- `ValidationIssue` reports `ERROR`, `WARNING`, or `INFO` with a stable code, message, optional path, and optional context.
- `CalculationResult<T>` distinguishes successful typed results from lightweight structural `CalculationError` records.

Financial decimal input must be a finite plain-decimal string. Native numbers, empty values, malformed text, and exponential notation are rejected rather than coerced. Negative values are valid at the primitive level because statements and adjustments may be negative; field-specific restrictions belong to future validation.

Canonical values contain no currency symbol, grouping separators, or display scale. APIs and future database adapters should exchange exact decimal strings. Calculations convert branded values to `ProjectSetuDecimal`, use method-based arithmetic, and serialize back through `toDecimalValue`. Display formatting remains a separate UI/report responsibility.

## Project

`Project` identifies a self-funded, bankable, or subsidy report without naming a specific scheme. It records industry/activity, lifecycle stage and status, an explicitly classified location, projection period, optional implementation period, and audit metadata. `ProjectSchemeParticipation` links a project to a separately versioned scheme.

`ImplementationSchedule` contains unordered/dependency-aware milestones rather than assuming one universal sequence. `EmploymentImpact` supplies lightweight quantitative and qualitative socio-economic fields.

## Applicant, promoter, and business entity

`Applicant`, `Promoter`, and `BusinessEntity` are separate because the applicant/promoter and operating legal entity may differ. Supported vocabulary includes individuals, proprietorships, partnerships, LLPs, companies, FPOs, SHGs, and cooperatives without attempting exhaustive compliance modelling.

Sensitive and registration identifiers are represented through protected reference IDs. Raw PAN, Aadhaar, GST, Udyam, CIN, LLPIN, bank details, or similar values must not appear in fixtures, logs, or ordinary domain payloads.

## Project cost

`ProjectCost` contains reusable `ProjectCostItem` records spanning land, development, buildings, civil works, plant, equipment, installations, furniture, vehicles, IT, pre-operative costs, working-capital margin, and extensible other costs. Items can retain quantity, unit, rate, stated amount, tax, freight, installation, supplier/quotation references, provenance, and notes.

`ProjectCostLineResult` exposes quantity/rate or stated-base calculation, additions, the final amount, and the original source-backed item. `ProjectCostSummary` contains line results, present-category totals, total project cost, stated total, and their exact difference. Scheme eligibility is intentionally not stored on the cost item; `CostEligibility` classifies an item for one `SchemeVersion`.

## Operations

`OperatingCapacityPlan` records installed capacity, working days, shifts, production cycle, and explicit year-wise capacity-utilisation assumptions. No utilisation defaults exist.

`ProductOrService` supports multiple outputs with independent units and year-wise selling-price, production, and sales assumptions. `OperatingInput`, `ManpowerRequirement`, and `OperatingExpense` cover production inputs, staffing, and fixed/variable costs. Known expense categories aid consistency while permitting additional category codes.

Phase 1 adds `RevenueLineResult`/`RevenueSummary`, operating-input base/addition results, and yearly operating-expense summaries. Revenue uses explicit sales quantity and rate; it never infers capacity utilisation. Manpower totals remain deferred because pay-period semantics are not yet canonical.

## Revenue and operating expense projections

`RevenueAndOperatingExpenseProjectionInput` is configured input for an explicit positive number of projection years. `RevenueProjectionAssumption` records a product/service name and unit plus source-backed year-one quantity, unit price, capacity utilisation, quantity growth, and selling-price escalation. Optional `RevenueProjectionYearOverride` records identify a specific projection year and may replace any of those values. Quantity and price overrides become the next year's growth base; capacity overrides apply only to their named year.

`OperatingExpenseProjectionAssumption` is a discriminated union. `FIXED_ANNUAL_AMOUNT` lines carry a source-backed annual amount and escalation rate. `PERCENTAGE_OF_REVENUE` lines carry a source-backed percentage of total projected revenue and an explicit escalation rate for that percentage. Both support method-specific yearly overrides. Categories cover raw materials, wages, salaries, electricity, fuel, repairs, rent, transport, administration, marketing, telephone/internet, stationery/postage, miscellaneous overheads, and named custom items.

Calculated output is separate from configured input. `RevenueProjectionLine` exposes selected quantity, capacity, effective quantity, unit price, next-year growth rates, and revenue. `OperatingExpenseProjectionLine` exposes its method, selected amount or rate, next-year escalation, and expense. `RevenueAndOperatingExpenseProjectionYear` retains both detailed line collections plus revenue, grouped operating costs, total expenses, and operating surplus before depreciation, interest, and tax.

Quantities and prices must be non-negative; zero quantity, zero price, or zero capacity produces valid zero revenue. Fixed expense amounts may be zero. Capacity and percentage-of-revenue rates remain within 0–100 percent points. Quantity growth, selling-price escalation, and expense escalation may be negative to model decline but cannot be below −100%. A quantity or price override becomes the authoritative base for subsequent compounding. All calculations are unrounded `ProjectSetuDecimal` operations. Depreciation, interest, tax, financial statements, viability metrics, subsidies, and scheme rules remain outside this module.

## Working capital

`WorkingCapitalAssessmentInput` distinguishes current-asset and current-liability lines and supports explicit inventory, receivable, and creditor holding periods. `WorkingCapitalSummary` exposes calculated line amounts, current-asset/liability totals, their signed gap, and optional borrower contribution/bank finance when a margin is explicitly supplied. Holding-period results retain annual amount, days, and caller-supplied day base.

## Financing and loans

`MeansOfFinance` supports promoter contribution, equity, unsecured and term loans, working-capital finance, subsidy/grant, institutional finance, and other contributions. `MeansOfFinanceSummary` totals supplied sources by type, while `FinanceReconciliationResult` reports exact balance, shortfall, or excess against project cost without tolerance.

`LoanTerms` is configured input. It holds source-backed original principal and annual percentage rate, total schedule periods, explicit `MONTHLY`, `QUARTERLY`, `HALF_YEARLY`, or `YEARLY` frequency, and `EQUAL_PRINCIPAL` or `EMI` repayment method. Total schedule periods include moratorium periods; moratorium duration is therefore an unambiguous whole count at the configured frequency rather than a month value that is silently converted.

`LoanMoratorium` requires an explicit type, period count, and interest treatment. Supported combinations are `PRINCIPAL_ONLY`/`PAY_CURRENT`, `FULL_PAYMENT`/`ACCRUE`, and `FULL_PAYMENT`/`CAPITALIZE`. Separate accrual does not increase principal and remains identifiable as unpaid accrued interest. Capitalization increases principal and consequently the base for later interest. Unsupported combinations are typed failures, not inferred bank rules.

`LoanRepaymentPeriod` is calculated output. It exposes sequence, projection year, phase, opening/closing principal, the periodic decimal rate, interest charged, principal repayment, interest payment, total payment, capitalized interest, and opening/added/closing accrued interest. `LoanRepaymentSummary` distinguishes original principal, total principal repaid, interest charged/paid, total repayments, capitalized interest, ending balances, and schedule/amortization period counts. `AnnualLoanRepaymentSummary` derives from canonical periods and exposes opening/closing principal, principal repaid, interest charged/paid, total debt service, and accrued-interest balances without recalculating the loan.

Positive principal requires at least one post-moratorium amortization period. Zero principal intentionally produces a valid empty schedule with zero totals. Schedule interest is period-based nominal reducing-balance interest; dates, day counts, partial periods, changing rates, prepayments, rounded contractual instalments, and accrued-interest payoff rules are deferred.

## Subsidy and schemes

`Scheme`, `SchemeVersion`, and `SchemeSource` provide explicit version, effective dates, implementing bodies, lifecycle status, primary sources, verification date, and conditions.

`ProjectCostEligibilitySummary` separates total, eligible, and ineligible project cost. `SubsidyAssessment` can represent a rate, ceiling, calculated and admissible amounts, beneficiary contribution, bank finance, release mechanism, lock-in, conditions, and provenance. All fields are neutral to scheme behavior; no eligibility rule or subsidy formula exists.

## Depreciation

`DepreciationProjectionInput` supplies an explicit positive projection period and individual `DepreciableAsset` assumptions. Every asset has a custom name, a neutral category, original cost, residual value, start year, and either Straight Line useful life or Written Down Value rate. Rates and useful lives are source-backed assumptions; categories never select rates or statutory treatment. Optional `DepreciationAssetAddition` records add source-backed cost and their own residual value in a stated projection year.

`AssetDepreciationYear` exposes opening and closing gross value, additions, opening carrying value, full-year depreciation base, depreciation, accumulated depreciation, closing carrying value, cumulative residual floor, and method. `AssetDepreciationSchedule` retains these rows asset-by-asset. `AggregateDepreciationYear` exactly sums the underlying rows into opening/closing gross fixed assets, additions, annual and accumulated depreciation, and closing net carrying value.

The original asset is available for a full year beginning in `depreciationStartYear`. Additions are available for depreciation for their full stated projection year. A Straight Line addition begins its own independent useful-life stream using the asset's configured useful life and its explicitly supplied residual value; an exhausted component is never restarted by another active addition. WDV applies the supplied rate to opening carrying value plus that year's additions. Each addition's residual value is added to the asset's cumulative residual floor. Addition ids must be unique within their parent asset. Multiple distinct additions may share a year; they are processed in supplied order and combined into that year's addition total. No monthly, daily, half-year, acquisition-date, or disposal convention is inferred.

All authoritative arithmetic uses `ProjectSetuDecimal` without intermediate currency rounding. Straight Line's final useful-life year consumes the exact remaining depreciable balance so carrying value reaches residual value even when annual division repeats in the decimal context. WDV is capped whenever its normal rate would cross the residual floor. Zero cost and 0% WDV rates produce valid zero-depreciation behavior; 100% WDV remains capped by residual value.

## Projected profit and loss

`ProfitAndLossYearInput` is the normalized authoritative boundary: projection year, revenue, operating expenses, depreciation, and interest expense. It deliberately excludes upstream product/expense lines, asset balances/additions, loan principal/payment fields, and all source-module calculation assumptions. `ProfitAndLossProjectionInput` adds project identity and an explicit tax configuration. Revenue and expenses must be non-negative authoritative flows, while EBITDA, EBIT, profit before tax, and profit after tax may be negative.

`ProfitAndLossYear` calculates `EBITDA = revenue − operating expenses`, `EBIT = EBITDA − depreciation`, `profit before tax = EBIT − interest expense`, and `profit after tax = profit before tax − tax expense`. `ProfitAndLossSchedule` retains primary yearly rows plus exact cumulative sums for every implemented P&L flow. Cumulative values are period-flow totals, not balance-like amounts.

Tax is a discriminated assumption: `NO_TAX` or `PERCENTAGE_OF_POSITIVE_PBT`. Percentage tax is `max(PBT, 0) × rate / 100`; a zero or negative PBT produces zero tax and no credit. The source-backed base rate and every override must remain within 0–100 percent points. An override applies only to its named year and does not compound or change another year. No entity, turnover, location, scheme, or statutory rule supplies a rate.

`composeProfitAndLossYearInputs` maps authoritative projection totals and annual depreciation by exact year, then combines an explicit `ProfitAndLossInterestExpenseSchedule`. Project ids and years must align; duplicates, invalid years, extra years, and missing values fail by default. Missing depreciation or interest becomes zero only when the caller explicitly selects `USE_EXPLICIT_ZERO` for that source. A supplied canonical zero is present data and is never treated as missing. The interest contract admits only `year` and explicitly normalized `interestExpense`; principal repayment, debt service, disbursement, closing principal, and the loan module's charged/paid/accrued/capitalized fields are forbidden. The P&L engine therefore cannot silently select an accounting basis. An upstream accounting policy must normalize the loan output into the interest-expense schedule.

P&L schedules currently use ProjectSetu projection-year indices `1..N`. Requiring a sequential series beginning at 1 is a current domain-composition convention, not a statutory accounting or presentation rule. A future adapter may map those indices to calendar years, fiscal years, or reporting labels without changing any P&L formula semantics.

All P&L subtraction, percentage tax, and aggregation use `ProjectSetuDecimal` without intermediate rounding. Margins are deferred rather than assigning a misleading zero percentage when revenue is zero.

## Other financial assumptions

`FinancialAssumptions` groups the projection period, explicit capacity utilisation, escalation/inflation, interest, tax, and depreciation assumptions. Each assumption is traceable to a source. Asset-wise `DepreciationAssumption` records category, method, optional rate, and an explicit authority basis so Companies Act or income-tax treatment is never silently selected.

This general financial-assumption contract is not the depreciation calculation input. The dedicated engine uses `DepreciableAsset` so method-specific required fields and asset additions are explicit.

## Other financial statements and metrics

`ProjectedCashFlow` and `ProjectedBalanceSheet` remain multi-year result contracts with explicit line-item vocabulary; they do not calculate or reconcile values. The former placeholder P&L result has been superseded by the dedicated `ProfitAndLossSchedule` calculation contract.

Metric result contracts cover break-even, year-wise and average DSCR, project/equity IRR, NPV with its discount rate, ROI, payback, and common financial ratios. No formula or target threshold is implemented.

## Sensitivity

`SensitivityScenario` uses general target paths and adjustments instead of a closed list of scenarios. `SensitivityResult` may later contain recalculated statements, metrics, and repayment capacity. No recalculation exists.

## Documents and provenance

`DocumentReference` and `QuotationReference` contain identifiers and safe metadata only. Binary content, storage paths, provider metadata, and public URLs remain infrastructure concerns. Domain records use `SourceReference` to retain source type, optional document, reference, version, dates, and notes.

## Reports

`ReportDefinition` distinguishes self-funded, bankable, and subsidy reports while allowing template-driven section selection. It deliberately avoids a universal hardcoded section enum. `GeneratedReportReference` is only a future artifact reference; no report engine exists.

## Future calculations and validation

Future deterministic domain modules must calculate manpower, physical production/inventory flows, irregular or changing-rate loan behavior, subsidy, advanced interest-accounting treatment, cash flow, balance sheet, metrics, ratios, and sensitivity. Statutory tax, deferred tax, loss carry-forward, tax credits, statutory/tax depreciation, monthly or day-count timing, acquisitions/disposals, impairment, revaluation, and lease accounting remain deferred. Future validations include broader project completeness, balance-sheet reconciliation, and unresolved scheme eligibility. Runtime schema validation remains deferred pending a deliberate library decision.
