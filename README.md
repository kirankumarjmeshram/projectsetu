# ProjectSetu

ProjectSetu is a workspace for preparing deterministic financial projections and Detailed Project Reports (DPRs) for Indian MSME proposals. It combines structured project inputs, Decimal.js-based financial calculations, scheme screening, supporting documents and quotations, versioned reports, and PDF/DOCX/XLSX exports.

ProjectSetu supports professional preparation and review; it does not guarantee loan approval, subsidy eligibility, statutory compliance, or acceptance by a bank or government authority. Users and reviewers must verify source documents, current scheme rules, licences, quotations, and assumptions.

## Typical workflow

1. Create an account and sign in.
2. Create a project with its real promoter, location, activity, and purpose.
3. Enter project cost and means of finance. New projects contain no sample financial data.
4. Enter sales capacity, utilisation, pricing, growth, operating costs, working capital, loan terms, and other assumptions.
5. Add supporting documents and supplier quotations; approve and map quotation amounts deliberately.
6. Review validation issues and calculate the projections.
7. Review financial statements, ratios, viability indicators, and scheme-screening results.
8. Generate a versioned DPR and download PDF, DOCX, or XLSX artifacts. Generate a new version after changing project inputs.

Unknown facts should remain blank until they are known. Scheme questionnaire answers are not preselected, and generated narrative does not invent market, promoter, process, or compliance facts.

## Capabilities

ProjectSetu composes canonical project-cost, funding, revenue, operating-expense, depreciation, loan, profit-and-loss, cash-flow, balance-sheet, ratio, DSCR, IRR and NPV engines into a single reviewable projection. Scheme screening currently covers versioned definitions for PMEGP, NLM, PMFME, MUDRA and CMEGP; results are informational and remain subject to current official rules and authority review.

Supplier quotations are supporting evidence, not automatic project-cost entries. An amount affects calculations only after a user approves and deliberately maps it, preventing the same purchase from being recognized twice.

## Architecture and stack

- Next.js 16 App Router and React 19
- Pure TypeScript financial and scheme domain modules using Decimal.js
- PostgreSQL 14+ and Drizzle ORM
- Scrypt password hashing, hashed session tokens, HTTP-only cookies, server-side authorization, and role-based admin access
- Vitest unit/integration suites and Playwright browser tests
- PDF, DOCX, and XLSX report exporters

## Local setup

Requirements: Node.js 20.9 or later and npm. The commands below provision a
persistent, UTF-8 local PostgreSQL cluster isolated from automated tests.

```bash
npm install
cp .env.example .env.local
npm run db:dev:prepare
npm run dev
```

On Windows PowerShell, copy the environment file with:

```powershell
Copy-Item .env.example .env.local
```

The example `DATABASE_URL` uses the persistent `projectsetu_dev` database on
127.0.0.1:5434. `db:dev:prepare` safely starts that owned cluster and applies
migrations; repeated calls reuse it. Use `npm run db:dev:stop` for bounded clean
shutdown, or `npm run db:dev:start` and `npm run db:migrate` as separate steps.
`npm run dev:local` combines preparation and the development server; the database
remains running until explicitly stopped.

`npm start` remains production-style startup: it never provisions PostgreSQL and
expects `DATABASE_URL` to identify an already-running, migrated database.
Automated tests continue to use the separate `projectsetu_test` database on
127.0.0.1:5433. Configure other development or production PostgreSQL services and
authentication/session settings as described in [the environment variable catalog](docs/deployment/environment-variables.md).
Open `http://localhost:3000`, select **Create Account**, and enter your own project information.

Development demo users are disabled by default. They are created only when the explicit development seed setting is enabled; never enable it in a shared or production environment.

## Verification

```bash
npm run format:check
npm run typecheck
npm run lint
npm test
npm run test:db
npm run test:e2e
npm run build
```

All test commands now prepare an isolated PostgreSQL database, apply migrations, verify connectivity, and stop the server they started. No manually running database script is needed. Install Chromium once with `npx playwright install chromium`, then use `npm run test:verify` for the full sequence. Individual commands above remain supported.

Use `npm run test:db:prepare` for a standalone preparation check, `npm run test:db:check` to probe an already-running test database, `npm run test:infra` to verify lifecycle behavior, and `npm run test:reports` to generate synthetic DPR QA artifacts. Explicit `TEST_DATABASE_URL` values are restricted to a loopback `projectsetu_test` service (used by CI); production/development `DATABASE_URL` values are never selected by the runner. See [test lifecycle, accounting review and artifact limitations](docs/professional-validation.md).

## Production and operations

- Liveness: `GET /api/health`
- Readiness, including database connectivity: `GET /api/ready`
- Apply migrations: `npm run db:migrate`
- Inspect migration status: `npm run db:migrate:status`
- Container build: `docker build -t projectsetu .`

See the [deployment guide](docs/deployment/README.md), [CI/CD guide](docs/deployment/ci-cd.md), [operations runbook](docs/operations/production-runbook.md), and [security guidelines](docs/security/security-guidelines.md).

Never commit real credentials, tokens, session secrets, private keys, or customer documents.
