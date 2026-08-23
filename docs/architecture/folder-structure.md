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

Canonical domain contracts now cover shared types, projects, applicants, business entities, project cost, operations, working capital, financing, loans, subsidy, schemes, financials, sensitivity, documents, and reports. Planned feature areas remain projects, applicants, project cost, financing, schemes, financials, documents, quotations, and reports. Planned infrastructure areas are database, storage, validation, document processing, and configuration. Directories should be introduced with their first real implementation instead of being filled with placeholders.

Pages must remain thin. Domain logic must not live in React components, route handlers, persistence adapters, or report generators. Prefer the `@/` TypeScript alias over deep relative imports.
