# Multi-scheme funding composer

## Role and dependency boundary

The Task 016 funding composer is pure domain logic under
`src/domain/funding-composer`. It sits above authoritative Project Cost and
Financing Engine results and the Task 013 versioned program registry. It does
not replace or recalculate any of them.

The composer answers whether a user-selected set of zero, one, or multiple
programs produces a valid, explainable funding structure. It composes and
validates; it does not recommend, optimize, sanction, disburse, persist, or
render a report.

```text
Project Cost result ----\
Financing facts ---------+-> Funding composer -> structured funding result
Program registry --------+
Compatibility evidence -/
```

No live program identifier appears in the core algorithm. Future programs can
participate through `FinancingProgramDefinition`, `ProgramSelection`, generic
evaluation results, and effective-dated `ProgramConvergenceRule` metadata.

## Authoritative inputs

`FundingComposerInput` retains:

- project id and evaluation date;
- authoritative total project cost and stable cost-item identities;
- cost category, tags, amount, and available provenance;
- source-backed actual promoter contribution and bank finance;
- optional source-backed requested credit and other finance;
- explicit program selections and optional requested versions;
- normalized program facts; and
- optional manual cost-portion allocations.

The exact sum of cost lines must equal the authoritative project-cost total.
The composer rejects negative costs/finance, duplicate identities, invalid
decimals, and unsourced financing. It never removes a project cost merely
because a program treats the cost as ineligible.

Adapters copy Project Cost and Financing Engine results. They aggregate only
the explicit source lines supplied to them; they do not invent missing finance.

## Eligibility, versioning, and compatibility

Each selection is resolved independently to either its explicit version or the
version effective on `evaluationAsOfDate`. The resulting program id, version id,
and evaluation date remain in the output snapshot. An old explicit version is
not migrated to current rules.

Individual eligibility and pairwise compatibility are separate gates. One
ineligible program does not erase the evaluation of another. For `N` resolved
programs, every `N × (N - 1) / 2` pair is evaluated. Compatibility rules can be
restricted to exact versions and effective dates. Compatibility is never
inferred transitively.

No matching authoritative convergence rule means `UNKNOWN`, not compatible.
Conditional, prohibited, manual-review, allowed-benefit, prohibited-benefit,
same-cost, and distinct-cost rules remain independently traceable. Benefit-level
compatibility is evaluated for each calculated benefit pair.

## Cost portions and allocation ledger

`FundingAllocationLedgerEntry` separates:

- authoritative cost identity;
- optional cost-portion identity;
- allocated cost basis;
- calculated benefit amount;
- program and version;
- benefit id and semantic kind;
- automatic, manual, or non-cost allocation;
- initial, deferred, or non-cash availability;
- release metadata; and
- source/rule provenance.

Cost basis and benefit amount are deliberately different. For example, a
₹10 lakh basis and a 35% calculated entitlement remain ₹10 lakh basis and
₹3.5 lakh benefit; the latter is not treated as the portion of project cost
consumed.

Automatic allocation is deterministic. Explicit allocation is required when a
source rule requires distinct portions and competing automatic claims cannot be
partitioned without making a choice. Manual allocations validate program,
version, benefit, cost, eligible basis, non-negative amount, and unique portion
identity.

The invariant for every cost item is:

```text
sum(allocated cost portions for the cost item)
  <= authoritative cost item amount
```

The composer reports `COST_OVERALLOCATION`, `DOUBLE_FUNDING_CONFLICT`,
`BENEFIT_INCOMPATIBILITY`, or `ALLOCATION_REQUIRED` rather than silently
prorating or reducing a benefit. Officially compatible benefits on distinct
costs remain separate ledger entries. Two explicit non-overlapping portions of
the same line reconcile exactly when the convergence policy permits them.

## Contributions and bank finance

Every program's contribution constraint remains independently visible. Minimum
requirements are converted to exact amounts on their stated bases. Because the
same actual promoter contribution can satisfy multiple minimum tests, minimum
rates are not added; the deterministic combined minimum is the maximum of the
independent minimum amounts. Inconsistent fixed requirements remain a conflict.

For bank finance, the combined minimum is the maximum configured minimum and
the combined maximum is the minimum configured maximum. Required-versus-
prohibited finance, an empty combined range, actual non-compliance, and credit
above a configured program limit are typed conflicts. Actual promoter and bank
amounts are copied and never mutated to satisfy a rule.

Credit remains debt and an initial financing source. `requestedCredit`,
`maximumEligibleCredit`, and credit compliance remain distinct from actual
bank finance. The composer never increases requested or actual credit to a
program maximum.

## Cash, non-cash assistance, and timing

Capital subsidy, margin money, grant, seed capital, and reimbursement are
reported separately. Interest subvention represents future financing-cost
assistance. Credit guarantee represents contingent risk support. Neither
interest subvention nor guarantee coverage is project funding, and neither
changes a Loan Engine schedule.

Only a benefit explicitly configured as `UPFRONT` enters initially available
assistance. Back-ended, installment, post-disbursement, reimbursement,
post-verification, post-completion, and custom-conditional benefits remain
deferred/conditional. Release metadata is preserved, but workflows and actual
cash receipt are not simulated.

Program-level non-financial benefits, such as collateral-support metadata, are
preserved in `nonFinancialBenefits` with their program version and source
references. They are explanatory outputs only and never become cash funding.

The initial-funding identity is:

```text
initial funding sources =
  actual initial promoter contribution
  + actual initial bank/institutional credit
  + other source-backed finance explicitly available initially
  + assistance explicitly available initially

initial funding gap = max(project cost - initial funding sources, 0)
initial funding surplus = max(initial funding sources - project cost, 0)
```

Back-ended subsidy, future reimbursement, interest subvention, and guarantee
coverage are excluded from this equation. The composer shows a gap or surplus;
it never inserts balancing promoter money, bank credit, overdraft, or subsidy.

Benefit totals are derived exactly from ledger entries by semantic kind:

```text
sum(ledger benefit amounts for a kind) = summary total for that kind
```

There is no heterogeneous `totalGovernmentBenefit` that adds subsidy, credit,
guarantee, and interest support as though they were equivalent cash.

## Modes and result status

With no selected programs, the same composer returns `BANKABLE_PROJECT` with no
benefits or compatibility checks. One selection returns `SINGLE_PROGRAM`.
Two or more return `MULTI_PROGRAM`; all use the same calculation path.

Top-level resolution states are `RESOLVED`, `RESOLVED_WITH_WARNINGS`,
`UNRESOLVED`, `INELIGIBLE_SELECTION`, and `MANUAL_REVIEW_REQUIRED`. Blocking
conflicts, warnings, manual-review items, and machine-readable explanations are
separate arrays suitable for later UI and DPR rendering.

Calculated eligibility remains distinct from sanctioned, released, received,
or adjusted assistance. Those latter states do not exist in Task 016 output.

## Precision, purity, and limitations

All authoritative cost, benefit, allocation, constraint, funding, gap, and
surplus arithmetic uses Decimal.js without intermediate rounding. Zero is valid
when explicitly supplied. Invalid negative values and non-finite/malformed
decimals produce typed failures; no `NaN` or infinity result is serialized.

The module imports no UI, React, Next.js server action, database, persistence,
network, AI, document, spreadsheet, or report-rendering code.

Deferred work includes best-program recommendation, combinatorial optimization,
automatic resolution of undocumented compatibility, lender underwriting,
loan schedules, sanction/release tracking, persistence (Task 017), project UI
(Task 018), and DPR rendering (Task 020).
