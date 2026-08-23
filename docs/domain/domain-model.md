# Canonical domain model

## Status

The TypeScript contracts listed below are implemented in `src/domain`. They establish vocabulary and boundaries only. Financial calculations, scheme rules, persistence mappings, runtime schemas, UI forms, report rendering, and provider integrations are not implemented.

## Shared contracts

- `Identifier`, ISO date aliases, `DateRange`, `ProjectionYear`, and audit metadata provide lightweight common vocabulary.
- `DecimalValue`, `MonetaryAmount`, and `Percentage` are distinct branded, canonical decimal-string contracts created by strict constructors.
- `ProjectSetuDecimal` is the accepted arbitrary-precision calculation primitive configured to 40 significant digits with half-even precision rounding.
- Percentages use percent points: `percentage("10")` means 10% and converts explicitly to the calculation factor `0.1`.
- `Assumption<T>` requires a source for traceable assumptions.
- `SourceReference` supports official guidelines, quotations, user input, estimates, consultant assumptions, historical data, system calculations, and extensible notes without requiring a URL.
- `ValidationIssue` reports `ERROR`, `WARNING`, or `INFO` with a stable code, message, optional path, and optional context.

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

No amount, tax, freight, installation, or total is calculated. Scheme eligibility is intentionally not stored on the cost item. `CostEligibility` classifies an item for one `SchemeVersion`.

## Operations

`OperatingCapacityPlan` records installed capacity, working days, shifts, production cycle, and explicit year-wise capacity-utilisation assumptions. No utilisation defaults exist.

`ProductOrService` supports multiple outputs with independent units and year-wise selling-price, production, and sales assumptions. `OperatingInput`, `ManpowerRequirement`, and `OperatingExpense` cover production inputs, staffing, and fixed/variable costs. Known expense categories aid consistency while permitting additional category codes.

## Working capital

`WorkingCapitalAssessmentInput` distinguishes current-asset and current-liability lines and supports explicit inventory, receivable, and creditor holding periods. `WorkingCapitalAssessmentResult` can later carry totals, gap, borrower margin, and bank finance. None of those values are currently calculated.

## Financing and loans

`MeansOfFinance` supports promoter contribution, equity, unsecured and term loans, working-capital finance, subsidy/grant, institutional finance, and other contributions. It holds stated values only; equality with project cost is a future validation.

`LoanTerms` models principal, source-backed interest assumptions, moratorium, period, and repayment frequency. `LoanRepaymentSchedule` represents future rows but no schedule generator exists.

## Subsidy and schemes

`Scheme`, `SchemeVersion`, and `SchemeSource` provide explicit version, effective dates, implementing bodies, lifecycle status, primary sources, verification date, and conditions.

`ProjectCostEligibilitySummary` separates total, eligible, and ineligible project cost. `SubsidyAssessment` can represent a rate, ceiling, calculated and admissible amounts, beneficiary contribution, bank finance, release mechanism, lock-in, conditions, and provenance. All fields are neutral to scheme behavior; no eligibility rule or subsidy formula exists.

## Financial assumptions and depreciation

`FinancialAssumptions` groups the projection period, explicit capacity utilisation, escalation/inflation, interest, tax, and depreciation assumptions. Each assumption is traceable to a source. Asset-wise `DepreciationAssumption` records category, method, optional rate, and an explicit authority basis so Companies Act or income-tax treatment is never silently selected.

## Financial statements and metrics

`ProjectedProfitAndLoss`, `ProjectedCashFlow`, and `ProjectedBalanceSheet` are multi-year result contracts with explicit line-item vocabulary. They do not calculate or reconcile values.

Metric result contracts cover break-even, year-wise and average DSCR, project/equity IRR, NPV with its discount rate, ROI, payback, and common financial ratios. No formula or target threshold is implemented.

## Sensitivity

`SensitivityScenario` uses general target paths and adjustments instead of a closed list of scenarios. `SensitivityResult` may later contain recalculated statements, metrics, and repayment capacity. No recalculation exists.

## Documents and provenance

`DocumentReference` and `QuotationReference` contain identifiers and safe metadata only. Binary content, storage paths, provider metadata, and public URLs remain infrastructure concerns. Domain records use `SourceReference` to retain source type, optional document, reference, version, dates, and notes.

## Reports

`ReportDefinition` distinguishes self-funded, bankable, and subsidy reports while allowing template-driven section selection. It deliberately avoids a universal hardcoded section enum. `GeneratedReportReference` is only a future artifact reference; no report engine exists.

## Future calculations and validation

Future deterministic domain modules must calculate costs, operations, working capital, financing reconciliation, loan schedules, subsidy, depreciation, statements, metrics, ratios, and sensitivity. Future validations include means-of-finance mismatch, missing assumptions, balance-sheet reconciliation, and unresolved scheme eligibility. Runtime schema validation remains deferred pending a deliberate library decision.
