# ProjectSetu — CI/CD Pipeline Architecture

## Continuous Integration & Continuous Delivery Workflow

The ProjectSetu delivery pipeline enforces strict quality gates, automated verification, test database isolation, and zero-downtime deployment safety.

---

## 1. Pipeline Stages

```
Developer Workstation
        │
   Feature Branch (feature/*)
        │
   Pull Request to main
        │
 ┌──────▼───────────────────────────────────────────────┐
 │ GitHub Actions CI Pipeline                           │
 │                                                      │
 │  1. Checkout & Node 20 Setup (with npm cache)       │
 │  2. Clean Dependency Install (npm ci)               │
 │  3. Code Style Verification (npm run format:check)  │
 │  4. TypeScript Strict Compilation (npm run typecheck)│
 │  5. ESLint Rules Verification (npm run lint)        │
 │  6. Domain & Unit Test Suite (npm test)              │
 │  7. DB Migration on Test Postgres (npm run db:migrate)│
 │  8. PostgreSQL Integration Suite (npm run test:db)  │
 │  9. Playwright Headless E2E Suite (npm run test:e2e)│
 │ 10. Production Standalone Build (npm run build)     │
 └──────┬───────────────────────────────────────────────┘
        │
   All Checks Passed & Code Review Approved
        │
   Merge to main
        │
 ┌──────▼───────────────────────────────────────────────┐
 │ Production Release Gate                              │
 │                                                      │
 │  1. Pull latest main commit                          │
 │  2. Run Database Migration: npm run db:migrate      │
 │  3. Execute Production Build                         │
 │  4. Zero-Downtime Container / Process Rolling Update │
 │  5. Verify Readiness: GET /api/ready (HTTP 200)      │
 └──────────────────────────────────────────────────────┘
```

---

## 2. CI Verification Matrix

| Step          | Command                | Description                                                                               |
| ------------- | ---------------------- | ----------------------------------------------------------------------------------------- |
| Format Check  | `npm run format:check` | Verifies code adherence to Prettier formatting rules.                                     |
| Typecheck     | `npm run typecheck`    | Validates TypeScript contracts across all domain, application, and persistence layers.    |
| Lint          | `npm run lint`         | Enforces ESLint and Next.js static analysis rules.                                        |
| Unit Tests    | `npm test`             | Executes 48+ Vitest unit test suites covering deterministic arithmetic and domain logic.  |
| DB Migrations | `npm run db:migrate`   | Applies DDL migrations to the isolated PostgreSQL service container.                      |
| DB Tests      | `npm run test:db`      | Runs PostgreSQL integration suites validating repository transactions and concurrency.    |
| E2E Tests     | `npm run test:e2e`     | Runs Playwright browser scenarios (sign in, project wizard, admin console, health probe). |
| Build         | `npm run build`        | Compiles optimized production bundle with standalone server output.                       |

---

## 3. GitHub Actions Security Safeguards

- **Least-Privilege Permissions**: Workflow runs with `permissions: contents: read`.
- **Isolated Service Containers**: Tests run against an ephemeral `postgres:16-alpine` service with isolated mock credentials.
- **Secrets Isolation**: Forked pull requests cannot access production secret values.
- **Fail Fast**: Any failure in the validation matrix blocks merging to `main`.
