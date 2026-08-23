# Local setup

## Prerequisites

- Node.js 20.9 or newer
- npm

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The current application does not require a database or third-party credentials.

Before submitting changes, run:

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```
