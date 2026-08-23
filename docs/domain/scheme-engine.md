# Scheme engine

## Status

Versioning, participation, cost-eligibility, and subsidy result contracts are implemented. PMEGP, NLM, PMFME, subsidy, and all other government-scheme rules remain explicitly deferred until authoritative source materials are supplied and validated.

Rules must be deterministic, testable, separated from UI, and versioned so historical projects can retain the rules that applied at calculation time. The future model should represent:

```text
Scheme
SchemeVersion
EffectiveFrom
EffectiveUntil
Rules
Source
LastVerifiedAt
```

Every rule set must record its source, source URL or document, scheme/version, effective date, last verified date, and notes. Do not hardcode a government rule without provenance. Rule changes require updated tests, documentation, and an explicit version; they must never silently alter historical behavior.

## Implemented contracts

- `Scheme`, `SchemeVersion`, `SchemeSource`, and project participation
- Version lifecycle statuses and a status type guard
- Scheme-version-specific cost eligibility: eligible, ineligible, partially eligible, or conditionally eligible
- Separate total, eligible, and ineligible project-cost amounts
- Subsidy assessment fields for rates, ceilings, calculated/admissible amounts, contribution, finance, release terms, conditions, and provenance

## Future rules

No category eligibility, beneficiary eligibility, percentage, ceiling, lower-of rule, release behavior, lock-in behavior, or scheme condition is implemented. Those rules must be versioned deterministic domain logic derived from verified official sources.
