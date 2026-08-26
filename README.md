# ProjectSetu

ProjectSetu is a deterministic financial calculation platform, MSME Detailed Project Report (DPR) generator, and Indian government scheme intelligence system. It features bankable multi-year cash flows, versioned government scheme modeling (PMEGP, NLM, PMFME, MUDRA, CMEGP), multi-program funding composition, document & quotation ingestion, PDF/DOCX/Excel artifact export, multi-tenant isolation, admin operations console, and production-grade PostgreSQL persistence.

## Architecture and stack

- **Frontend & App Framework**: Next.js 16 (App Router), React 19, Tailwind CSS
- **Domain Modeling**: 100% pure deterministic TypeScript domain layer with Decimal.js precision
- **Persistence & Database**: PostgreSQL 14+ with Drizzle ORM (schema migrations, connection pooling, SSL)
- **Authentication & Security**: Scrypt password hashing, session token SHA-256 hashing, HTTP-only secure cookies, sliding-window rate limiting, and server-side RBAC
- **Testing & Quality**: Vitest unit suite, PostgreSQL integration suite, Playwright browser E2E suite, ESLint, and Prettier

## Local development

Requires Node.js 20.9+ and npm.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local

# 3. Start local PostgreSQL & run migrations
npm run db:migrate

# 4. Start development server
npm run dev
```

Open `http://localhost:3000`.

## Verification & Test Suites

```bash
npm run format:check  # Prettier style validation
npm run typecheck     # TypeScript strict compilation
npm run lint          # ESLint rules check
npm test              # Vitest domain & unit tests
npm run test:db       # PostgreSQL persistence integration tests
npm run test:e2e      # Playwright browser end-to-end tests
npm run build         # Next.js production build
```

## Production Deployment & Operations

ProjectSetu is ready for containerized or bare-metal production deployment with isolated health probes:

- **Liveness Probe**: `GET /api/health`
- **Readiness Probe**: `GET /api/ready`
- **Database Migration**: `npm run db:migrate`
- **Database Migration Status**: `npm run db:migrate:status`
- **Docker Multi-Stage Build**: `docker build -t projectsetu .`

For detailed production guidance:

- [Production Deployment Guide](docs/deployment/README.md)
- [Environment Variables Catalog](docs/deployment/environment-variables.md)
- [CI/CD Pipeline Architecture](docs/deployment/ci-cd.md)
- [Operations & Incident Runbook](docs/operations/production-runbook.md)
- [Security Guidelines](docs/security/security-guidelines.md)

> **Security Guarantee**: Never commit real credentials, tokens, session secrets, private keys, or customer documents to version control.
