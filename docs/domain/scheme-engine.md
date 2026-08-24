# Scheme, program, and assistance engine

## Status and boundary

Task 013 implements the generic, versioned Scheme / Government Assistance / Credit Program Engine foundation. Task 014 adds authoritative PMEGP definitions as a dedicated registration module; it adds no PMEGP branch to generic evaluators. NLM, PMFME, CMEGP, AIF, AHIDF, Stand-Up India, state-scheme, and district-scheme rules remain absent. Generic tests continue to use `TEST.*` and `CUSTOM.*` definitions.

The module is pure domain logic. It has no UI, database, network, portal, document-processing, AI, sanction, claim, or disbursement dependency. Existing project-cost, financing, loan, projection, statement, metrics, and investment-return engines remain authoritative and scheme-agnostic. Program evaluation returns constraints and calculated expected entitlements; it never mutates financing or claims that assistance was sanctioned, released, received, or adjusted.

## Program rather than subsidy

`FinancingProgramDefinition` represents base finance, credit programs, capital or margin-money subsidy, interest subvention, credit guarantee, grant, reimbursement, seed capital, composite assistance, and custom programs. A program may contain zero financial benefits, so credit-only programs do not need a fake subsidy. `ProgramId` is an open validated namespaced string such as `TEST.CREDIT_ONLY` or `CUSTOM.CONSULTANT_42`, not a closed enum of known Indian schemes.

Normal bankable projects use `selectedPrograms = []`. `evaluateProgramStack` then returns permanent `BANKABLE_PROJECT` mode with zero invented assistance and no scheme eligibility requirement.

## Immutable versions and registry

Every definition carries `programId`, `versionId`, `effectiveFrom`, optional `effectiveTo`, lifecycle status, jurisdiction, and provenance. Supported statuses are `DRAFT`, `ACTIVE`, `SUPERSEDED`, `RETIRED`, `SUSPENDED`, and `ARCHIVED`.

`FinancingProgramRegistry` is append-only within a calculation context:

- `registerProgramDefinition` rejects duplicate program/version keys rather than replacing rules;
- `getProgramDefinition` explicitly resolves any retained version, including retired and superseded history;
- `resolveProgramVersion` selects the latest applicable selectable version for an as-of date, never an unconditional "latest";
- `listActivePrograms` returns only active versions effective on the requested date.

`ProgramEvaluationSnapshot` records the exact program id, version id, and evaluation date required for reproducibility. A changed percentage or cap requires a new version.

## Provenance

`RuleSourceReference` records authority, document title, source type, optional URL, document version, publication/effective/retrieval dates, page/reference, and notes. Manual and custom rules do not require a web URL. Rule-level eligibility results, cost-rule traces, benefit caps, contribution requirements, compatibility rules, and benefit results preserve their source references.

The engine never fetches official websites at evaluation time. The intended update workflow is:

```text
Official guideline/circular
  -> human or administrator verification
  -> create a new immutable Program Version
  -> automated rule tests
  -> publish/activate
  -> new projects resolve the new version

Historical projects retain their explicit old version.
```

## Normalized facts and eligibility

`ProgramEvaluationFacts` separates applicant, project, enterprise, location, activity, financing, and custom fact collections. Facts use stable paths such as `applicant.age` and extensible classification tags such as `LIVESTOCK.GOAT`; different programs require only the facts their rules query.

Typed deterministic rules support required, equality, membership, minimum/maximum/range, boolean, date-range, activity inclusion/exclusion, location, entity type, and explicitly registered custom predicates. `ALL`, `ANY`, and `NONE` groups compose rules without `eval` or arbitrary expression strings.

Rule outcomes are `PASS`, `CONDITIONAL_PASS`, `FAIL`, `UNKNOWN`, or `MANUAL_REVIEW`. Program outcomes are `ELIGIBLE`, `INELIGIBLE`, `CONDITIONALLY_ELIGIBLE`, `INSUFFICIENT_INFORMATION`, or `MANUAL_REVIEW_REQUIRED`. A missing required fact yields `UNKNOWN` and insufficient information, never a silent false, zero, or ineligible decision.

Unusual future logic uses `ProgramRuleHandlerRegistry`. Handlers are explicitly named pure functions registered for eligibility, cost eligibility, or benefit basis resolution. Missing handlers cause manual review; runtime code strings and `eval` are not supported.

## Cost eligibility

`SchemeCostItem` is the normalized boundary for authoritative cost item id, category, amount, extensible tags, and source references. It does not replace or recalculate the Project Cost Engine.

Cost rules include/exclude categories or tags and apply exact percentage, absolute, maximum-amount, duration, or per-unit caps. A duration cap proportionally limits the item amount from an explicit actual-duration fact; a per-unit cap multiplies a configured maximum by an explicit unit-count fact. Missing or invalid cap facts require manual review rather than becoming zero. Custom pure rules cover genuinely unusual limits. Every `CostEligibilityLineResult` retains the original item, eligible and ineligible amounts, status, and rule-by-rule before/after trace. Partial eligibility is first-class. Every line and aggregate reconciles exactly:

```text
eligible amount + ineligible amount = cost item amount
eligible project cost + ineligible project cost = total project cost
```

## Benefits and financing constraints

Benefit kinds cover subsidy, margin money, grants, interest subvention, guarantees, seed capital, reimbursement, loan limits, credit support, and custom assistance. Calculation methods support percentage, fixed, per-unit, and explicitly registered custom handlers. Bases include total or eligible project cost, eligible capital cost, selected cost items, bank loan, beneficiary contribution, fixed amount, per unit, and custom basis.

Percentage benefits calculate `raw benefit = basis × rate`. Optional minimums and applicable absolute or percentage caps then determine `calculatedEligibleBenefit`. Program-level caps constrain the combined calculated entitlement. `BenefitCalculationTrace` retains basis, rate/fixed/per-unit inputs, raw amount, applied caps, and final amount. All monetary and rate arithmetic uses Decimal.js with no intermediate rounding.

Contribution requirements support percentage of total/eligible cost and absolute minimums. Bank-finance rules express required, optional, or not-permitted finance, minimum/maximum amounts, self-finance permission, and credit linkage. Compliance results retain the source-backed actual amount and shortfall; they never rewrite the user's financing. `ProgramFundingConstraint` exposes these results for a future Financing Plan Composer.

## Release model

Benefits model upfront, back-ended, reimbursement, single/multiple installment, post-verification, post-disbursement, post-completion, and custom-conditional release. Installments retain number, percentage, event trigger, and conditions; configured percentages must total exactly 100. This is descriptive entitlement timing only—workflow automation and actual release tracking are deferred.

## Multi-program compatibility and double funding

`ProgramSelection[]` allows zero, one, or multiple independently evaluated programs. Multiple selection does not imply compatibility. `ProgramConvergenceRule` is effective-dated and can constrain exact versions, benefit kinds, conditions, and same-cost policy. Supported results include allowed, prohibited, conditional, distinct-cost, distinct-benefit, official convergence, manual review, and unknown. No matching rule returns `UNKNOWN` and a `MISSING_CONVERGENCE_RULE` conflict.

Same-cost policies include no double assistance, distinct benefit types, assistance up to cost, explicit convergence, distinct cost portions, and manual review. `CostAssistanceAllocation` records cost item, exact program/version, benefit, eligible basis, calculated amount, allocation type, and optional portion identity. Validation detects prohibited programs, incompatible benefit types, overlapping portions, same-cost double funding, and assistance above configured cost limits.

The combination flow is:

```text
Select programs
  -> evaluate each independently
  -> resolve versioned compatibility
  -> allocate cost bases
  -> validate overlap and double funding
  -> combine only resolved benefits and funding constraints
  -> return conflicts/manual-review items otherwise
```

The engine never silently chooses a winning program or optimizes assistance.

## Retirement and custom programs

Retired definitions remain explicitly resolvable for historical reports but are excluded from active listings. Custom consultant/admin programs use the same contracts and registry, normally under `CUSTOM.*`; no core calculation switch or TypeScript scheme enum changes.

## Deferred

Authoritative definitions other than versioned PMEGP new-enterprise and upgradation, recommendation/best-scheme selection, benefit optimization, application workflow, portals/APIs, document requirements, AI extraction, source ingestion, sanction/claim/release/disbursement tracking, accounting recognition, database persistence, UI, and report rendering remain deferred. See [PMEGP versioned program definitions](pmegp-program.md).
