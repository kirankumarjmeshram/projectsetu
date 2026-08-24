# Architecture overview

## Status

The repository implements a Next.js application shell, quality tooling, canonical provider-independent TypeScript contracts, deterministic financial engines through investment returns, a generic versioned financing-program engine, and separately registered PMEGP, NLM, PMFME, PMMY/MUDRA, and Maharashtra CMEGP definitions. Product workflows, persistence, other authoritative live government-program rules, lender-policy evaluation, irregular-date returns, WACC, and other advanced financial calculations remain unimplemented.

## Dependency direction

`app` composes routes from `features` and reusable `components`. Features orchestrate domain operations and infrastructure interfaces. `domain` contains business concepts and deterministic, pure calculations; it must not import UI or provider code. `lib` contains infrastructure adapters, configuration, validation utilities, and integrations.

```text
app -> features -> domain
 |         |
 v         v
components lib -> external providers
```

Report generation, persistence, and UI must consume the same typed domain results. Formulas must never be duplicated across pages, handlers, and exporters.

The domain layer imports only other domain modules plus the accepted core arithmetic dependency, `decimal.js`. It has no React, Next.js, API, database, storage, AI, or document-rendering dependencies and can be tested under a Node environment.

Domain modules are organized around project identity, applicants and business entities, costs, operations, projections, working capital, financing, loans, depreciation, profit and loss, cash flow, balance sheet, financial metrics, investment returns, subsidy, scheme versions, financial assumptions, sensitivity, documents, reports, provenance, and validation. Cohesive modules expose their own public contracts; there is intentionally no global barrel file.

The profit-and-loss module depends only on normalized financial flows and type-only upstream schedule contracts. Its calculation path composes authoritative projection, depreciation, and explicitly normalized interest-expense values; it does not call or duplicate their calculation formulas.

The cash-flow module uses a normalized indirect-method boundary and type-only upstream schedule contracts. Pure adapters copy authoritative P&L, working-capital, asset-addition, financing, and loan-payment values; the engine derives only cash-flow sections, net movement, continuity, and cumulative cash totals. It imports no UI, provider, persistence, scheme, subsidy, or viability-metric code.

The balance-sheet module composes point-in-time closing balances from authoritative depreciation, cash-flow, loan, P&L, financing, and explicit accounting-balance schedules. It derives only legitimate balance identities and roll-forwards, never creates a balancing account, and reports an exact non-zero difference as a valid unbalanced result. It imports no UI, provider, persistence, scheme, subsidy, or viability-metric code.

The metrics module consumes explicit normalized P&L, loan-principal, balance-sheet, project-cost, and fixed/variable cost-classification outputs. It calculates only named ratios and their formula components, uses explicit undefined states instead of zero, NaN, or Infinity when a denominator is invalid, and contains no lender approval threshold, scheme rule, UI, persistence, IRR, or NPV dependency.

The investment-returns module consumes an explicit equally spaced `0..N` investment cash-flow series tagged as project or equity return. Its project adapter composes only source-backed project investment, operating cash generation, working-capital investment/recovery, capex, terminal value, and other explicit project flows; financing and accounting-profit fields are forbidden. NPV evaluation, discounted schedules, payback interpolation, PI, and IRR root evaluation use Decimal.js. Bounded bracket expansion and bisection use native integers only for loop control. The module imports no UI, persistence, scheme, subsidy, lender-threshold, P&L, balance-sheet, or financing schedule.

The schemes module decorates an authoritative bankable project model rather than replacing it. A registry resolves immutable `programId`/`versionId` definitions by evaluation date; pure rule, cost, benefit, funding, compatibility, and allocation evaluators produce traceable outcomes. No selected combination is valid merely because multiple selection is supported: missing convergence rules remain unknown/manual-review states. The module returns constraints and calculated expected assistance without mutating project cost, means of finance, loans, statements, or cash flows.

`domain/schemes/programs/pmegp` is a leaf program module over those generic contracts. New-enterprise and upgradation retain separate program identities, rules, cost limits, rate tables, lifecycle metadata, evaluators, and version snapshots. Core project-cost and financial engines do not import it.

The NLM, PMFME, MUDRA, and CMEGP leaf modules follow the same dependency direction. NLM keeps activity-specific definitions and overlays the verified 2026 amendment on its 2025 base guideline. PMFME separates unit, group, common-infrastructure, and seed-capital components and registers only official AIF convergence metadata. MUDRA is credit-only. CMEGP uses its Maharashtra GR matrix and retains unverified cost/activity details as manual review. The shared programs index only bootstraps definitions into the unchanged registry.

No database, authentication, object storage, PDF, OCR, AI, or scheme-rule provider has been selected. Decimal arithmetic is established by ADR 0001 without selecting a persistence provider.
