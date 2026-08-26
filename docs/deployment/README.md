# ProjectSetu — Production Deployment Guide

## Overview

ProjectSetu is a deterministic financial calculation platform, MSME Detailed Project Report (DPR) generator, and Indian government scheme intelligence system. It is engineered with Next.js 16 (React 19), TypeScript, and PostgreSQL (Drizzle ORM).

---

## 1. Runtime Requirements

- **Node.js**: `v20.9.0+` (LTS recommended)
- **Database**: PostgreSQL `14+` with native `UUID` and `JSONB` support
- **Memory**: Minimum 512MB RAM (1GB+ recommended for concurrent PDF/DOCX generation)
- **Port**: Configurable via `PORT` (default `3000`)

---

## 2. Deployment Architecture

```
[ Internet / Reverse Proxy / CDN ]
                │
         HTTPS (TLS 1.3)
                ▼
[ Next.js Node.js Application Process ]
  ├── Liveness:  GET /api/health
  ├── Readiness: GET /api/ready (pg probe)
  ├── Static Assets: /.next/static & /public
  └── Server Actions & Route Handlers
                │
   PostgreSQL Wire Protocol (SSL)
                ▼
[ Managed PostgreSQL Database (Primary) ]
```

---

## 3. Build and Start Lifecycle

### Standard Node.js Deployment

```bash
# 1. Install production dependencies reproducibly
npm ci

# 2. Run deterministic database migrations
npm run db:migrate

# 3. Compile optimized production build
npm run build

# 4. Start production HTTP server
npm start
```

### Docker Container Deployment

```bash
# Build multi-stage Docker container with Next.js standalone output
docker build -t projectsetu:latest .

# Run container with environment injection
docker run -d \
  --name projectsetu \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://user:password@db-host:5432/projectsetu?sslmode=require" \
  -e AUTH_SECRET="your-secure-32-byte-secret" \
  -e APP_URL="https://projectsetu.org" \
  projectsetu:latest
```

---

## 4. Operational Probes

| Probe Endpoint    | Purpose   | Expected Status              | Description                                                    |
| ----------------- | --------- | ---------------------------- | -------------------------------------------------------------- |
| `GET /api/health` | Liveness  | `200 OK`                     | Fast in-memory process check.                                  |
| `GET /api/ready`  | Readiness | `200 OK` / `503 Unavailable` | Verifies live PostgreSQL connectivity and pool responsiveness. |

---

## 5. Deployment Documentation Index

- [Environment Variables Catalog](./environment-variables.md)
- [CI/CD Pipeline Architecture](./ci-cd.md)
- [Production Operations Runbook](../operations/production-runbook.md)
