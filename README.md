# ProjectSetu

ProjectSetu is an early-stage application for creating bankable project reports, subsidy-based DPRs, financial projections, and document-supported estimates. The repository contains engineering foundations, canonical domain contracts, Core Financial Engine Phase 1 arithmetic identities, a deterministic term-loan repayment engine, a revenue/operating-expense projection engine, an asset-wise depreciation engine, projected profit-and-loss, cash-flow, and balance-sheet composition engines, and a deterministic financial-ratios and bankability-metrics engine. Business workflows, scheme and lender rules, investment-return metrics, document processing, and AI features are not implemented.

## Architecture and stack

The Next.js App Router composes pages in `src/app`; feature orchestration lives in `src/features`; deterministic business concepts belong in `src/domain`; reusable UI belongs in `src/components`; and infrastructure adapters belong in `src/lib`. The stack is Next.js, React, TypeScript, Tailwind CSS, Decimal.js, ESLint, Prettier, Vitest, and a PostgreSQL-ready (but provider-neutral) architecture.

## Local development

Requires Node.js 20.9 or newer and npm.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The example values are safe for local setup; leave unused future integration variables empty.

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

## Repository map

- `src/app` — routes and page composition
- `src/features` — feature-specific UI and orchestration
- `src/domain` — pure domain types and calculations
- `src/components` — reusable presentational UI
- `src/lib` — infrastructure and utilities
- `docs` — product, architecture, development, domain, and security guidance
- `resources` — safe, sanitized reference materials and schemas

Start with the [documentation index](docs/README.md), [architecture overview](docs/architecture/overview.md), [local setup](docs/development/local-setup.md), and [security guidelines](docs/security/security-guidelines.md).

> Never commit secrets, private customer documents, generated customer reports, database dumps, or sensitive personal and financial data. Use environment variables or a secure secret manager for production secrets.
