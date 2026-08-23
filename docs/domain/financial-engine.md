# Financial engine

## Status

Canonical input and result contracts are implemented. No formulas, rates, defaults, rounding policies, or arithmetic representation have been selected.

All financial calculations must be deterministic domain logic. AI may later explain or narrate validated results, but it must never be the source of truth for project cost, promoter contribution, subsidy, bank finance, interest, depreciation, profitability, DSCR, IRR, NPV, break-even, or loan repayment.

Future calculations should use pure functions where practical:

```text
typed input -> domain calculation -> typed result -> UI / database / report generator
```

Formulas must have one domain implementation, comprehensive unit tests, explicit rounding and precision rules, and provenance recording: source, source URL or document, scheme/version, effective date, last verified date, and notes.

JavaScript floating point must not be used casually for money. Before implementing calculations, approve an ADR comparing integer paise, an arbitrary-precision decimal library, and PostgreSQL numeric/decimal types. See ADR 0001.

## Implemented contracts

- Project cost items and stated project-cost totals
- Operational capacity, products/services, inputs, manpower, and expenses
- Working-capital inputs and result shape
- Means of finance and loan terms/schedule rows
- Traceable financial assumptions and asset-wise depreciation assumptions
- Projected profit-and-loss, cash-flow, and balance-sheet result shapes
- Break-even, DSCR, IRR, NPV, ROI, payback, and ratio result shapes
- General sensitivity scenarios and their result shape

`MonetaryAmount` and `Percentage` are provisional decimal-text boundary aliases. They deliberately prevent casual numeric arithmetic but do not decide the eventual calculation representation.

## Future calculations

Totals, revenue, expenses, working capital, interest, repayment, depreciation, statements, metrics, ratios, sensitivity recalculation, validation, and balance-sheet reconciliation are all deferred. Every assumption must remain explicit and source-backed; there are no default percentages or rates.
