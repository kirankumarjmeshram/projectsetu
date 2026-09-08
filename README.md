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

Requirements: Node.js 20.9 or later, npm, and PostgreSQL 14 or later.

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run dev
```

On Windows PowerShell, copy the environment file with:

```powershell
Copy-Item .env.example .env.local
```

Configure `DATABASE_URL` and the required authentication/session settings described in [the environment variable catalog](docs/deployment/environment-variables.md). The application does not create a PostgreSQL server; the configured server must already be running. Open `http://localhost:3000`, select **Create Account**, and enter your own project information.

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

`npm run test:db` and the readiness/E2E checks require an accessible migrated test database. The repository test helper uses PostgreSQL on `127.0.0.1:5433` when started explicitly.

## Production and operations

- Liveness: `GET /api/health`
- Readiness, including database connectivity: `GET /api/ready`
- Apply migrations: `npm run db:migrate`
- Inspect migration status: `npm run db:migrate:status`
- Container build: `docker build -t projectsetu .`

See the [deployment guide](docs/deployment/README.md), [CI/CD guide](docs/deployment/ci-cd.md), [operations runbook](docs/operations/production-runbook.md), and [security guidelines](docs/security/security-guidelines.md).

Never commit real credentials, tokens, session secrets, private keys, or customer documents.
