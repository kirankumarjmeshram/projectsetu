# Canonical domain model

## Status

The TypeScript contracts, Core Financial Engine Phase 1 arithmetic identities, deterministic term-loan repayment engine, revenue/operating-expense projection engine, asset-wise depreciation engine, projected profit-and-loss engine, indirect-method cash-flow engine, projected balance-sheet engine, and financial-ratios and bankability-metrics engine listed below are implemented in `src/domain`. Scheme and lender rules, persistence mappings, runtime schemas, UI forms, report rendering, investment-return metrics, and provider integrations are not implemented.

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

## Projected cash flow

`CashFlowYearInput` is a normalized cash-impact boundary. Every `1..N` projection row explicitly supplies authoritative PAT, depreciation, signed change in net working capital, capital expenditure, promoter contribution, loan disbursement, principal repayment, and cash interest paid. `CashFlowProjectionInput` adds project identity and a source-backed initial opening cash balance. The module does not recalculate revenue, operating expenses, PAT, depreciation, loan principal, loan interest, working-capital requirements, project cost, or financing assumptions.

`CashFlowYear` separates operating, investing, and financing sections. Operating cash flow is `PAT + depreciation - change in NWC`; investing cash flow is `-capital expenditure`; financing cash flow is `promoter contribution + loan disbursement - principal repayment - cash interest paid`. Net movement is the exact sum of those sections, and closing cash is opening cash plus net movement. Each next-year opening equals the prior closing exactly. Cumulative section and net-movement totals are flow sums; closing cash instead equals initial opening cash plus cumulative net movement.

The NWC sign convention is `current-year NWC - opening/previous-year NWC`. A positive change is cash tied up and therefore an operating outflow; a negative change releases cash. Year 1 is explicit: balance-based normalization requires and retains a source-backed opening NWC assumption, then compares the first requirement with its value. Opening NWC is never inferred and Year 1 change is never assumed to be zero. Every later change subtracts the immediately preceding authoritative NWC balance. Cash balances may become negative and are never automatically balanced with invented finance.

Pure adapters compose existing schedules without copying their formulas. P&L contributes only PAT and depreciation; tax is not deducted again, depreciation is added back once, and no operating expense is separately added back. Working-capital summaries may be converted from absolute requirements to signed changes. Depreciation schedules contribute only explicitly opted-in annual additions as cash capex; original startup assets and non-cash acquisitions require separate normalization, and depreciation expense, accumulated depreciation, and carrying values never become capex. The upstream composition owner must ensure the same purchase/addition is not also supplied through another normalized project-capex schedule. Loan annual summaries contribute only principal repaid and interest paid. Promoter contributions and loan disbursements come from explicit financing schedules and are never inferred from project cost.

Promoter contribution and loan disbursement are financing inflows; principal repayment and cash interest paid are financing outflows. Principal repayment remains separate from interest and is never a P&L expense. Only explicitly normalized cash interest paid is an interest cash outflow; charged, accrued unpaid, or capitalized interest and debt balances are forbidden from the normalized payment contract and are not silently treated as cash. Presenting cash interest in financing is the current ProjectSetu reporting convention and may become configurable if an alternative accounting presentation is added later. PAT already reflects P&L tax, so no second tax deduction occurs. The current assumption is that tax expense and tax paid do not differ; deferred tax and tax-payment timing are deferred.

Composition is strict by default. Project ids must match, the P&L `1..N` timeline must be sequential, source years must be valid and unique, extra source years fail, and every source must supply each required year. A missing source becomes zero only through its explicit `USE_EXPLICIT_ZERO` policy; a supplied numeric zero remains authoritative present data. Projection-year sequencing is a current ProjectSetu composition convention, not a statutory accounting rule, and future calendar or fiscal labels can be mapped without changing the formulas.

All calculations and reconciliations use `ProjectSetuDecimal` without intermediate rounding. A negative closing cash balance remains valid and never creates an overdraft, additional loan, promoter contribution, or other balancing finance. Only the indirect method is implemented. Balance-sheet mapping remains outside the cash-flow module. Direct-method receipts/payments, collection and payment timing, GST, statutory tax timing, deferred taxes, dividends, disposals, leases, automatic overdrafts/revolving credit, working-capital drawdowns, subsidy cash flows and PMEGP/NLM/PMFME behavior, DSCR, IRR, NPV, and lender-specific formats remain deferred.

## Projected balance sheet

`BalanceSheetYearInput` is a normalized closing-balance boundary. It accepts authoritative gross fixed assets and accumulated depreciation; inventory, receivables, other current assets, and non-negative cash; explicitly classified long-term and current debt; payables and other current liabilities; promoter capital; authoritative PAT; retained-earnings adjustments; and other equity. It deliberately excludes derived net fixed assets, totals, and any balancing account. `BalanceSheetProjectionInput` adds project identity and a source-backed opening retained-earnings balance.

Every `BalanceSheetYear` is an independent point-in-time closing financial position, unlike the period flows in P&L and cash flow. The schedule therefore exposes no cumulative total assets, cash, loan, fixed-assets, liabilities, or equity across years. The engine calculates `net fixed assets = gross fixed assets - accumulated depreciation`, `total current assets = inventory + receivables + other current assets + cash and bank`, `total assets = net fixed assets + total current assets`, `total current liabilities = current debt + payables + other current liabilities`, `total liabilities = long-term loan + total current liabilities`, and `total equity = promoter capital + closing retained earnings + other equity`.

Retained earnings follow `closing = opening + PAT + explicit adjustments`; each following opening equals the previous closing exactly. Opening retained earnings is source-backed and never defaults to zero. PAT is copied from P&L and never recalculated. Negative PAT, retained earnings, other equity, and total equity are valid. Dividends and distributions are not inferred; they remain deferred unless explicitly normalized as a generic retained-earnings adjustment.

Promoter capital is a balance, not income or expense. The financing adapter rolls explicit yearly promoter contributions into closing promoter capital using `closing = opening + contribution`, with exact year-to-year continuity. Loan disbursement is not promoter capital. Opening promoter capital is source-backed, and neither the adapter nor the statement derives capital from the balance difference.

Fixed-asset composition copies the Depreciation Engine's closing gross assets and accumulated depreciation, verifies their exact reconciliation to closing net carrying value, and never treats annual depreciation expense as an asset. Cash composition copies `CashFlowSchedule.closingCash` without recalculation. Non-negative closing cash maps to `cashAndBank`; negative closing cash fails composition because an explicit financing classification is required. It never creates an overdraft, loan, promoter contribution, or balancing liability.

The loan adapter copies only authoritative closing principal into an unclassified total-loan schedule. Current/non-current maturity classification remains an explicit, source-backed accounting input because the Loan Engine does not provide that classification. Composition requires `long-term loan outstanding + current debt = authoritative total closing principal`, preventing the same principal from being counted in both categories. Principal repayment, interest expense/payment, accrued unpaid interest, and capitalized-interest fields are never independently added to the liability. Multiple-loan and accrued-interest-liability accounting remain upstream or deferred.

Inventory, receivables, payables, other current balances, debt classification, retained-earnings adjustments, and other equity use explicit source-backed accounting schedules. The Working Capital Engine's financing requirement or gap is not assumed to equal inventory, total current assets, net working capital, receivables, or payables. Only a future adapter with explicit semantic equivalence may map those balances.

The exact reconciliation is `balance difference = total assets - total liabilities - total equity`; `isBalanced` is true only when the Decimal.js result is exactly zero. Valid but inconsistent balances return a successful row with a non-zero difference and `isBalanced = false`. No cash, reserve, asset, liability, equity, overdraft, suspense, miscellaneous, or plug account is ever created to force balance.

Composition uses P&L projection years `1..N` as the timeline. Project ids must match; invalid, duplicate, extra, missing, and non-sequential years fail. Strict mode requires every normalized source. Only an explicitly selected `USE_EXPLICIT_ZERO` policy converts a missing source row to zero; supplied numeric zero remains present authoritative data. The `1..N` rule is a ProjectSetu projection convention, not statutory presentation, and future calendar/fiscal labels may be mapped without changing calculations.

All balance-sheet arithmetic uses `ProjectSetuDecimal` with no intermediate or tolerance rounding. Statutory formats, subsidies and scheme accounting, tax/GST balances, detailed ageing/inventory, disposals, revaluation, impairment, leases, dividends, drawings, automatic overdraft/financing, consolidation, lender presentation, IRR, and NPV remain deferred.

## Financial ratios and bankability metrics

The pure `domain/metrics` module is a consumer of authoritative financial outputs. `DscrYearInput`, `InterestCoverageYearInput`, `DebtEquityYearInput`, `CurrentRatioYearInput`, `BreakEvenYearInput`, `RoiYearInput`, `RoceYearInput`, and `ProfitabilityMarginYearInput` provide small explicit calculation boundaries. `BankabilityMetricsYearInput` combines those already-normalized values once for full schedule calculation; it does not accept raw products, expenses, asset assumptions, loan terms, or accounting line-item collections. `BankabilityMetricsYearResult` retains every authoritative input alongside its formula components and metrics. `BankabilityMetricsSchedule` adds only weighted Average DSCR; it does not average point-in-time ratios.

`MetricResult` is discriminated by mathematical status. A defined result contains canonical decimal `value`; an undefined result has no value and uses `UNDEFINED_ZERO_DENOMINATOR`, `UNDEFINED_NEGATIVE_EQUITY`, `UNDEFINED_NON_POSITIVE_CONTRIBUTION`, or `UNDEFINED_NEGATIVE_CAPITAL_EMPLOYED`. Undefined does not mean zero, weak, good, bad, approved, or rejected. Domain outputs never use `NaN` or `Infinity` and never take the absolute value of negative equity or capital employed.

ProjectSetu Task 011 uses the DPR-style convention `CADS = PAT + depreciation + recognized interest expense`, `debt service = principal repayment + recognized interest expense`, and `DSCR = CADS / debt service`. PAT may make CADS and DSCR negative; depreciation, recognized interest, and principal repayment must be non-negative. Zero debt service produces an explicit undefined DSCR. Average DSCR is the debt-service-weighted ratio `sum(CADS) / sum(debt service)`, not the arithmetic mean of yearly DSCR values. Years with zero debt service are excluded from both aggregate totals; if every year has zero debt service, Average DSCR is undefined. Lender-specific numerator, denominator, and averaging conventions may be introduced only through a future named policy.

Interest coverage is `EBIT / recognized interest expense`, not EBITDA coverage. Debt-equity is `(long-term debt + current debt) / total equity`; trade payables and other non-interest-bearing current liabilities are excluded. Zero equity is a zero-denominator state, while negative equity has its own undefined status. Current ratio is `total current assets / total current liabilities`. The metrics adapter copies all balance-sheet totals and classified debt; the balance-sheet engine now exposes authoritative `totalCurrentLiabilities` so this ratio does not rebuild a statement total.

Break-even uses explicitly normalized `revenue`, `variableCosts`, and `fixedCosts`. `contribution = revenue - variable costs`, `CMR = contribution / revenue`, `break-even sales = fixed costs / CMR`, and `break-even percentage = break-even sales / revenue × 100`. Zero revenue makes revenue-denominated results undefined. A zero or negative contribution can have a mathematically defined CMR, but break-even sales and percentage are `UNDEFINED_NON_POSITIVE_CONTRIBUTION` because no meaningful positive sales break-even exists. Zero fixed costs with a positive contribution margin produces zero break-even sales. The projection adapter never classifies a category by name or calculation method: every expense, including custom lines, requires exactly one explicit source-backed `FIXED` or `VARIABLE` classification.

Yearly ROI is `PAT / authoritative total project cost × 100`; the same project-cost base is copied into every year and no cumulative ROI is invented. ROCE is `EBIT / capital employed × 100`, where the sole Task 011 capital-employed definition is `total assets - total current liabilities`. Zero capital employed is undefined; negative capital employed has a distinct undefined status. EBITDA, EBIT, PBT, and PAT margins divide the correspondingly named authoritative P&L value by authoritative revenue and multiply by 100. Negative numerators and negative defined ratios or margins remain valid.

Adapters copy P&L revenue, EBITDA, EBIT, PBT, PAT, depreciation, and explicitly normalized recognized interest without recalculating them. The loan adapter copies only authoritative annual principal repayment; it cannot select charged, cash-paid, accrued, or capitalized loan interest. Balance-sheet adapters copy totals and classified debt, and project-cost normalization copies `totalProjectCost`. Break-even normalization copies projection revenue and sums only explicitly classified expense-line amounts. Composition requires one project id and exact sequential `1..N` year alignment, rejects invalid, duplicate, missing, extra, and out-of-order years, and requires break-even revenue to equal P&L revenue for the same year. `1..N` is a ProjectSetu projection convention, not a statutory accounting rule; calendar or fiscal labels may later be mapped without changing metric semantics.

All ratio arithmetic, aggregation, reconciliation, division, and percentage conversion uses `ProjectSetuDecimal` at configured precision with no intermediate rounding. Presentation rounding belongs to report/UI layers. The engine does not recalculate revenue, operating expenses, EBITDA, EBIT, PAT, depreciation, interest, principal, debt balances, balance-sheet values, or project cost. It contains no approval threshold, lender policy, PMEGP/NLM/PMFME rule, subsidy calculation, UI, persistence, or report rendering. IRR, NPV, MIRR, discounted payback, profitability index, lender-specific formulas and thresholds, CMA ratios, working-capital bank-finance methods, credit scoring, collateral ratios, drawing power, and industry benchmarks remain deferred.

## Other financial assumptions

`FinancialAssumptions` groups the projection period, explicit capacity utilisation, escalation/inflation, interest, tax, and depreciation assumptions. Each assumption is traceable to a source. Asset-wise `DepreciationAssumption` records category, method, optional rate, and an explicit authority basis so Companies Act or income-tax treatment is never silently selected.

This general financial-assumption contract is not the depreciation calculation input. The dedicated engine uses `DepreciableAsset` so method-specific required fields and asset additions are explicit.

## Other financial statements and metrics

The former placeholder financial-statement contracts have been superseded by the dedicated `ProfitAndLossSchedule`, `CashFlowSchedule`, and `BalanceSheetSchedule` calculation contracts.

The former placeholder metric result contracts have been superseded by the dedicated `BankabilityMetricsSchedule` and explicit `MetricResult` status model. Investment-return contracts and formulas for IRR, NPV, MIRR, and discounted payback remain deferred to Task 012.

## Sensitivity

`SensitivityScenario` uses general target paths and adjustments instead of a closed list of scenarios. `SensitivityResult` may later contain recalculated statements, metrics, and repayment capacity. No recalculation exists.

## Documents and provenance

`DocumentReference` and `QuotationReference` contain identifiers and safe metadata only. Binary content, storage paths, provider metadata, and public URLs remain infrastructure concerns. Domain records use `SourceReference` to retain source type, optional document, reference, version, dates, and notes.

## Reports

`ReportDefinition` distinguishes self-funded, bankable, and subsidy reports while allowing template-driven section selection. It deliberately avoids a universal hardcoded section enum. `GeneratedReportReference` is only a future artifact reference; no report engine exists.

## Future calculations and validation

Future deterministic domain modules must calculate manpower, physical production/inventory flows, irregular or changing-rate loan behavior, subsidy, advanced interest-accounting treatment, investment-return metrics, lender-policy evaluation, and sensitivity. Direct-method cash flow, statutory tax timing, deferred tax, loss carry-forward, tax credits, statutory/tax depreciation, monthly or day-count timing, detailed accounting subledgers, acquisitions/disposals, impairment, revaluation, and lease accounting remain deferred. Future validations include broader project completeness and unresolved scheme eligibility. Runtime schema validation remains deferred pending a deliberate library decision.
