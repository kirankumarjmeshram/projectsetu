# DPR requirements baseline

> **Product Requirements Baseline — not an authoritative source for current government scheme rules.**

This document records product scope and vocabulary. It does not specify formulas, eligibility rules, rates, ceilings, required annexures for a particular live scheme, or a bank's current credit policy. Scheme-specific implementation must be verified against official source material, versioned by effective date, and retain provenance and last-verification metadata.

## Self-funded project report

A self-funded report should eventually describe the project, promoter and business, location, products/services, market and operating assumptions, implementation plan, employment impact, project cost, funding contribution, projected operations, and financial viability. Debt, subsidy, or lender-specific sections should be optional rather than fabricated.

## Bankable DPR

A serious bankable model is expected eventually to support:

- Project cost and means of finance
- Promoter contribution, term loan, and working capital
- Production/capacity and sales assumptions
- Raw materials, operating expenses, and employee costs
- Depreciation, interest, and loan repayment
- Projected profit and loss, cash flow, and balance sheet
- Break-even, DSCR, ROI, IRR, payback, and financial ratios
- Sensitivity analysis and repayment capacity
- A source-backed bankability conclusion

The report must distinguish inputs, assumptions, deterministic calculations, validation issues, and narrative. It must not make a bankability claim from missing or invented values.

## Government subsidy or scheme DPR

A credit-linked subsidy report includes the bankable baseline where applicable and must additionally support:

- Eligible and ineligible project cost
- Subsidy rate, ceiling, calculated subsidy, and admissible subsidy
- Beneficiary contribution and bank finance
- Scheme and cost eligibility
- Implementation conditions and required approvals
- Scheme-specific annexures
- Employment generation and socio-economic impact
- Subsidy release mechanism
- Post-sanction compliance and lock-in conditions

Scheme participation must identify an exact `SchemeVersion`. A report must retain the official sources, effective period, last verified date, and unresolved eligibility or evidence issues. Project mode alone must never imply a particular government scheme.

## Cross-cutting report requirements

Reports should be reproducible from versioned inputs and deterministic domain results. Quotation, land, registration, approval, and guideline evidence should be linked by protected document references, not embedded binary content. Confidential reports and source documents require authorization and private storage.

AI may eventually assist with narrative and explanation, but it must not originate or silently modify calculated financial values, eligibility outcomes, scheme rules, or source claims.

## Current implementation status

Canonical TypeScript contracts now cover the concepts above. Calculations, validations, templates, provider integrations, data persistence, uploads, rendering, and current scheme rules are not implemented.
