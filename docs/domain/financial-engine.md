# Financial engine

## Status

Not implemented. No formulas, rates, assumptions, or monetary representation have been selected.

All financial calculations must be deterministic domain logic. AI may later explain or narrate validated results, but it must never be the source of truth for project cost, promoter contribution, subsidy, bank finance, interest, depreciation, profitability, DSCR, IRR, NPV, break-even, or loan repayment.

Future calculations should use pure functions where practical:

```text
typed input -> domain calculation -> typed result -> UI / database / report generator
```

Formulas must have one domain implementation, comprehensive unit tests, explicit rounding and precision rules, and provenance recording: source, source URL or document, scheme/version, effective date, last verified date, and notes.

JavaScript floating point must not be used casually for money. Before implementing calculations, approve an ADR comparing integer paise, an arbitrary-precision decimal library, and PostgreSQL numeric/decimal types. See ADR 0001.
