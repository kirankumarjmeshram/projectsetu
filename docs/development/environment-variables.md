# Environment variables

Copy `.env.example` to `.env.local` for development. Never commit local environment files or real credentials. Production secrets must come from environment variables or a secure secret manager.

| Variable         | Required now | Purpose                                                                       |
| ---------------- | ------------ | ----------------------------------------------------------------------------- |
| `APP_URL`        | No           | Canonical application URL; safe local example is `http://localhost:3000`.     |
| `DATABASE_URL`   | No           | Future PostgreSQL connection string. Provider and schema are undecided.       |
| `AUTH_SECRET`    | No           | Future authentication signing/encryption secret. Authentication is undecided. |
| `STORAGE_BUCKET` | No           | Future private object-storage bucket identifier.                              |
| `STORAGE_REGION` | No           | Future object-storage region.                                                 |
| `OPENAI_API_KEY` | No           | Placeholder for a possible future AI integration; AI provider is undecided.   |

Empty placeholders are intentional. Add a variable only when code consumes it, document its format and lifecycle here, and fail clearly when a required variable is absent.
