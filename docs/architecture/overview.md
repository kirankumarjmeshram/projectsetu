# Architecture overview

## Status

The repository implements a Next.js application shell, one development landing page, a small domain type guard, and quality tooling. Product workflows and integrations remain unimplemented.

## Dependency direction

`app` composes routes from `features` and reusable `components`. Features orchestrate domain operations and infrastructure interfaces. `domain` contains business concepts and deterministic, pure calculations; it must not import UI or provider code. `lib` contains infrastructure adapters, configuration, validation utilities, and integrations.

```text
app -> features -> domain
 |         |
 v         v
components lib -> external providers
```

Report generation, persistence, and UI must consume the same typed domain results. Formulas must never be duplicated across pages, handlers, and exporters.

No database, authentication, object storage, PDF, OCR, AI, or scheme-rule provider has been selected.
