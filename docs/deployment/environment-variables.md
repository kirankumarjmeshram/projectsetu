# ProjectSetu — Environment Variables Catalog

This document details all supported configuration variables, their types, defaults, and production security considerations.

---

## 1. Application Runtime Variables

| Variable      | Type                                             | Required in Prod | Default                 | Description                                                  |
| ------------- | ------------------------------------------------ | ---------------- | ----------------------- | ------------------------------------------------------------ |
| `NODE_ENV`    | String (`development` \| `test` \| `production`) | Yes              | `development`           | Defines the runtime environment mode.                        |
| `APP_URL`     | URL String                                       | Yes              | `http://localhost:3000` | Canonical public URL of the application.                     |
| `APP_VERSION` | String                                           | No               | `0.1.0`                 | Application release version for telemetry and health probes. |
| `PORT`        | Number                                           | No               | `3000`                  | TCP port for HTTP server binding.                            |

---

## 2. PostgreSQL Persistence Variables

| Variable                     | Type                        | Required in Prod | Default | Description                                                                |
| ---------------------------- | --------------------------- | ---------------- | ------- | -------------------------------------------------------------------------- |
| `DATABASE_URL`               | Connection String           | **Yes**          | None    | Primary PostgreSQL connection URI (`postgresql://user:pass@host:port/db`). |
| `TEST_DATABASE_URL`          | Connection String           | In Tests / CI    | None    | Isolated database for Vitest integration and DB tests.                     |
| `DB_POOL_MIN`                | Number                      | No               | `2`     | Minimum active connections maintained in PostgreSQL pool.                  |
| `DB_POOL_MAX`                | Number                      | No               | `20`    | Maximum connections allowed in PostgreSQL pool.                            |
| `DB_IDLE_TIMEOUT_MS`         | Number                      | No               | `10000` | Milliseconds before idle connections are closed.                           |
| `DB_CONNECTION_TIMEOUT_MS`   | Number                      | No               | `5000`  | Milliseconds to wait before acquiring connection times out.                |
| `DB_SSL`                     | Boolean (`true` \| `false`) | Cloud DB         | `false` | Enable TLS/SSL connection to PostgreSQL.                                   |
| `DB_SSL_REJECT_UNAUTHORIZED` | Boolean (`true` \| `false`) | No               | `true`  | Enforces certificate verification when SSL is active.                      |

---

## 3. Authentication & Security Variables

| Variable             | Type                        | Required in Prod  | Default                  | Description                                                                |
| -------------------- | --------------------------- | ----------------- | ------------------------ | -------------------------------------------------------------------------- |
| `AUTH_SECRET`        | String (32+ chars)          | **Yes**           | None                     | Cryptographic secret for signing session cookies and HMAC tokens.          |
| `ENABLE_RATE_LIMIT`  | Boolean (`true` \| `false`) | No                | `true`                   | Enables in-memory sliding-window rate limiting on sign-in attempts.        |
| `ALLOW_DEV_SEED`     | Boolean (`true` \| `false`) | **Never in Prod** | `false`                  | When true, provisions demo accounts on startup. Strictly disabled in prod. |
| `DEV_ADMIN_EMAIL`    | Email String                | No                | `admin@example.test`     | Custom email for local development seed admin.                             |
| `DEV_ADMIN_PASSWORD` | String                      | No                | `Admin@ExampleTest2026!` | Custom password for local development seed admin.                          |
| `DEV_USER_EMAIL`     | Email String                | No                | `user@example.test`      | Custom email for local development seed entrepreneur.                      |
| `DEV_USER_PASSWORD`  | String                      | No                | `User@ExampleTest2026!`  | Custom password for local development seed entrepreneur.                   |

---

## 4. Object Storage & Observability

| Variable           | Type                                            | Required in Prod | Default                 | Description                                                  |
| ------------------ | ----------------------------------------------- | ---------------- | ----------------------- | ------------------------------------------------------------ |
| `STORAGE_PROVIDER` | String (`local` \| `s3`)                        | No               | `local`                 | Storage provider for uploaded quotations and generated DPRs. |
| `STORAGE_BUCKET`   | String                                          | If S3            | `projectsetu-documents` | Object storage bucket name.                                  |
| `STORAGE_REGION`   | String                                          | If S3            | `ap-south-1`            | AWS / S3 cloud region.                                       |
| `LOG_LEVEL`        | String (`debug` \| `info` \| `warn` \| `error`) | No               | `info`                  | Minimum log level for structured logger output.              |

---

## 5. Production Security Rules

1. **Never commit secrets**: Do not track `.env` or `.env.local` files in Git.
2. **Use Secret Managers**: Store `DATABASE_URL` and `AUTH_SECRET` in AWS Secrets Manager, GCP Secret Manager, Vault, or hosting provider encrypted environment variables.
3. **Redaction**: The runtime logger automatically redacts passwords, tokens, and database credentials from all log entries.
