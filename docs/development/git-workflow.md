# Git workflow

Keep the workflow lightweight: `main` should remain releasable, and short-lived work should use `feature/*`, `fix/*`, `refactor/*`, or `docs/*` branches. Keep commits focused, reviewable, tested, and free of secrets or private data.

Examples:

```text
feat(projects): add project creation flow
fix(finance): correct repayment calculation
docs(architecture): document scheme engine
refactor(documents): separate extraction pipeline
test(finance): add dscr cases
chore(deps): update dependencies
```

Pull requests should describe the behavior and architecture affected, validation performed, source/provenance changes, migrations, security implications, and deferred work.
