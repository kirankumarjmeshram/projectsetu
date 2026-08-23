# Architecture decisions

Significant, durable choices are recorded as Architecture Decision Records in `docs/adr`. Copy the template, assign the next four-digit number, and keep the decision focused.

Create an ADR before committing to a database/provider schema, authentication provider, storage provider, PDF library, AI provider, scheme-rule architecture, or monetary representation. Update an ADR's status rather than rewriting history; superseding decisions should link to earlier records.

Current established constraints are modular responsibility boundaries, deterministic domain calculations, provider-neutral infrastructure, strict TypeScript, and source provenance for financial and scheme rules. Provider and money-strategy choices remain open.
