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

Canonical domain contracts cover shared types, projects, applicants, business entities, project cost, operations, revenue/expense projections, working capital, financing, loans, depreciation, profit and loss, cash flow, balance sheet, financial ratios and bankability metrics, investment returns, subsidy, schemes, financial assumptions, sensitivity, documents, and reports. Cohesive `calculations.ts` modules sit beside the contracts they calculate; shared calculation outcomes and escalation remain in `domain/shared`. The dedicated financial modules retain their existing ownership boundaries. The dedicated `domain/schemes` module owns open program identities, immutable versions, provenance, a registry, normalized facts, rule evaluation, cost eligibility, benefits, funding constraints, release metadata, compatibility, and assistance-allocation validation. Generic scheme code imports no live scheme implementation, UI, database, network, or financial-engine calculation. Dedicated definitions live under `domain/schemes/programs/<program>`; PMEGP, NLM, PMFME, MUDRA, and CMEGP each have a separate leaf module. `domain/schemes/programs/index.ts` is registration/bootstrap only. Program modules register independent definitions without editing generic evaluators or underlying financial engines.

Pages must remain thin. Domain logic must not live in React components, route handlers, persistence adapters, or report generators. Prefer the `@/` TypeScript alias over deep relative imports.
