# Money and decimal representation

## Status

Proposed — decision intentionally deferred

## Context

Financial calculations require explicit precision, scale, rounding, serialization, and database behavior. Casual JavaScript floating-point arithmetic is not acceptable for monetary values.

## Decision

No representation is selected in the foundation phase. Choose and document a strategy before implementing financial calculations.

## Consequences

Financial formula implementation remains blocked until this ADR is resolved. Domain APIs and persistence types must follow the selected strategy consistently.

## Alternatives Considered

- Integer paise representation
- An arbitrary-precision decimal library
- PostgreSQL numeric/decimal types, paired with an explicit application representation

Evaluation must cover rounding policy, percentage and ratio calculations, database boundaries, JSON transport, developer ergonomics, performance, and testability.

## Date

2026-08-23
