# Architecture overview

## Status

The repository implements a Next.js application shell, a development landing page, quality tooling, canonical provider-independent TypeScript contracts, Core Financial Engine Phase 1 arithmetic identities, and a deterministic term-loan repayment engine described in [the domain model](../domain/domain-model.md). Product workflows, persistence, statements, viability metrics, and other advanced financial calculations remain unimplemented.

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

Domain modules are organized around project identity, applicants and business entities, costs, operations, working capital, financing, loans, subsidy, scheme versions, financial contracts, sensitivity, documents, reports, provenance, and validation. Cohesive modules expose their own public contracts; there is intentionally no global barrel file.

No database, authentication, object storage, PDF, OCR, AI, or scheme-rule provider has been selected. Decimal arithmetic is established by ADR 0001 without selecting a persistence provider.
