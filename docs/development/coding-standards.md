# Coding standards

- Keep routing and page composition in `app`, orchestration in `features`, pure business logic in `domain`, and provider code in `lib`.
- Use strict, explicit TypeScript types; avoid `any`, duplicated types, magic values, large components, and deep relative imports.
- Centralize schema validation at application boundaries rather than scattering it through UI. A validation library and schemas are intentionally not selected yet.
- Implement future calculations as pure functions where practical: typed input → domain calculation → typed result → UI, persistence, or reports.
- Never duplicate financial formulas across consumers. Tests must use synthetic data and cover normal cases, boundaries, invalid inputs, rounding, and versioned scheme behavior.
- Comment non-obvious business reasoning, sourced scheme constraints, security constraints, and unusual architecture—not code that is already self-explanatory.
- Update relevant documentation and tests with meaningful architecture or behavior changes. Never silently change financial or scheme behavior.
