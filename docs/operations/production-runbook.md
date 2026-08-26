# ProjectSetu — Production Operations & Recovery Runbook

This operational runbook provides step-by-step procedures for deploying, monitoring, troubleshooting, backing up, and recovering ProjectSetu in production environments.

---

## 1. Standard Production Deployment Procedure

### Pre-Deployment Checklist

- [ ] CI workflow has completed successfully on the target commit.
- [ ] Database backup snapshot has been verified.
- [ ] Target environment variables are configured in the secret manager.

### Execution Commands

```bash
# 1. Fetch latest release code
git checkout main
git pull origin main

# 2. Install production dependencies
npm ci

# 3. Apply schema migrations safely
npm run db:migrate

# 4. Check migration sync status
npm run db:migrate:status

# 5. Build production bundle
npm run build

# 6. Restart/Reload application service (PM2 / Systemd / Docker)
# Example using PM2:
pm2 reload projectsetu --update-env

# 7. Verify readiness
curl -I http://127.0.0.1:3000/api/ready
```

---

## 2. Post-Deployment Verification

Execute the following operational checks:

1. **Liveness Check**:

   ```bash
   curl -s http://127.0.0.1:3000/api/health
   # Expected response: {"status":"healthy","version":"0.1.0",...} (HTTP 200)
   ```

2. **Readiness & DB Check**:

   ```bash
   curl -s http://127.0.0.1:3000/api/ready
   # Expected response: {"status":"ready","database":"connected","latencyMs":...,...} (HTTP 200)
   ```

3. **Admin Console Check**:
   - Access `/admin` with administrator credentials.
   - Verify System Diagnostics tab shows healthy connection and low latency.

---

## 3. Database Backup & Disaster Recovery

### Automated Backups

- In cloud environments (AWS RDS / GCP Cloud SQL / Neon / Supabase), configure **automated daily snapshots** with a 30-day retention window and **Point-In-Time Recovery (PITR)** enabled.

### Manual Backup Script (`pg_dump`)

```bash
# Export compressed PostgreSQL database dump
pg_dump "$DATABASE_URL" \
  --format=custom \
  --file="backup_projectsetu_$(date +%Y%m%d_%H%M%S).dump" \
  --no-owner \
  --no-privileges
```

### Database Restore Procedure

```bash
# 1. Put application into maintenance mode or stop worker processes
# 2. Restore dump into PostgreSQL target database
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="$DATABASE_URL" \
  backup_projectsetu_20260826_120000.dump

# 3. Run migration status check
npm run db:migrate:status

# 4. Restart application and verify readiness probe
curl -s http://127.0.0.1:3000/api/ready
```

---

## 4. Incident Response & Troubleshooting

### Scenario A: Database Connectivity Outage (`503 Service Unavailable`)

- **Symptoms**: `/api/ready` returns 503; logs indicate `Database connectivity check failed`.
- **Action**:
  1. Verify PostgreSQL server status and CPU/connection utilization.
  2. Inspect connection pool saturation: check `DB_POOL_MAX` in `.env` against database `max_connections`.
  3. Verify network security groups and firewall rules between application servers and PostgreSQL.
  4. If using SSL, verify `DB_SSL=true` and CA certificates.

### Scenario B: Migration Failure During Deployment

- **Symptoms**: `npm run db:migrate` exits with error; table constraints conflict.
- **Action**:
  1. Inspect specific failed statement using `npm run db:migrate:status`.
  2. The application will continue serving existing schema if deployment was staged before binary switch.
  3. Fix migration SQL idempotency (`IF NOT EXISTS` / exception handling) and re-run.

### Scenario C: High Authentication Failure Rate

- **Symptoms**: Multiple 429 Too Many Requests logs; brute-force detection.
- **Action**:
  1. In-memory rate limiter protects individual email accounts (5 attempts per 60s).
  2. Review Admin Audit logs at `/admin/audit` to inspect potential malicious IP patterns.
  3. Deactivate compromised accounts via `/admin/users` if necessary.

### Scenario D: Rollback Procedure

- **Action**:
  1. Revert to previous application container image or Git commit:
     ```bash
     git checkout <previous_stable_commit>
     npm ci
     npm run build
     pm2 reload projectsetu
     ```
  2. Check `/api/ready` to confirm health.
