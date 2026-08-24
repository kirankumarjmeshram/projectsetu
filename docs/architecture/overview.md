# Architecture overview

## Status

The repository implements a Next.js application shell, a development landing page, quality tooling, canonical provider-independent TypeScript contracts, Core Financial Engine Phase 1 arithmetic identities, a deterministic term-loan repayment engine, a revenue/operating-expense projection engine, an asset-wise depreciation engine, a projected profit-and-loss composition engine, and an indirect-method cash-flow composition engine described in [the domain model](../domain/domain-model.md). Product workflows, persistence, balance-sheet generation, viability metrics, and other advanced financial calculations remain unimplemented.

## Dependency direction

`app` composes routes from `features` and reusable `components`. Features orchestrate domain operations and infrastructure interfaces. `domain` contains business concepts and deterministic, pure calculations; it must not import UI or provider code. `lib` contains infrastructure adapters, configuration, validation utilities, and integrations.

```text
app -> features -> domain
 |         |
 v         v
components lib -> external providers
```

Report generation, persistence, and UI must consume the same typed domain results. Formulas must never be duplicated across pages, handlers, and exporters.

The domain layer imports only other domain modules plus the accepted core arithmetic dependency, `decimal.js`. It has no React, Next.js, API, database, storage, AI, or document-rendering dependencies and can be tested under a Node environment.

Domain modules are organized around project identity, applicants and business entities, costs, operations, projections, working capital, financing, loans, depreciation, profit and loss, cash flow, subsidy, scheme versions, financial contracts, sensitivity, documents, reports, provenance, and validation. Cohesive modules expose their own public contracts; there is intentionally no global barrel file.

The profit-and-loss module depends only on normalized financial flows and type-only upstream schedule contracts. Its calculation path composes authoritative projection, depreciation, and explicitly normalized interest-expense values; it does not call or duplicate their calculation formulas.

The cash-flow module uses a normalized indirect-method boundary and type-only upstream schedule contracts. Pure adapters copy authoritative P&L, working-capital, asset-addition, financing, and loan-payment values; the engine derives only cash-flow sections, net movement, continuity, and cumulative cash totals. It imports no UI, provider, persistence, scheme, subsidy, or viability-metric code.

No database, authentication, object storage, PDF, OCR, AI, or scheme-rule provider has been selected. Decimal arithmetic is established by ADR 0001 without selecting a persistence provider.
