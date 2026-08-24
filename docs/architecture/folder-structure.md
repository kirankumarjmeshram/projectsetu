# Folder structure

```text
src/
  app/          routing and page composition only
  features/     feature-specific UI and use-case orchestration
  domain/       business concepts and pure business logic
  components/   reusable presentational UI
  lib/          infrastructure, integrations, and utilities
  types/        genuinely cross-cutting technical types
docs/           maintained documentation and ADRs
resources/      sanitized reference resources and schemas
```

Canonical domain contracts cover shared types, projects, applicants, business entities, project cost, operations, revenue/expense projections, working capital, financing, loans, depreciation, profit and loss, cash flow, subsidy, schemes, financials, sensitivity, documents, and reports. Cohesive `calculations.ts` modules sit beside the contracts they calculate; shared calculation outcomes and escalation remain in `domain/shared`. The dedicated `domain/depreciation` module owns only assumption-driven asset schedules and aggregate depreciation arithmetic. The dedicated `domain/profit-and-loss` module owns normalized P&L composition, generic tax assumptions, derived period flows, cumulative flow totals, and strict upstream year alignment. The dedicated `domain/cash-flow` module owns normalized indirect-method composition, cash-section calculations, balance continuity, and pure adapters from authoritative upstream schedules. Planned feature and infrastructure directories should still be introduced only with real implementations.

Pages must remain thin. Domain logic must not live in React components, route handlers, persistence adapters, or report generators. Prefer the `@/` TypeScript alias over deep relative imports.
