# Scheme engine

## Status

Not implemented. PMEGP, NLM, PMFME, subsidy, and other government-scheme rules are explicitly deferred until authoritative source materials are supplied and validated.

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
