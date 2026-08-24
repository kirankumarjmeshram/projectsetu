# PMEGP versioned program definitions

## Authority and version

Task 014 implements two independently selectable definitions from the Ministry of MSME's _Revised Prime Minister's Employment Generation Programme Guidelines_, dated 7 December 2023: `GOI.PMEGP.NEW_ENTERPRISE` and `GOI.PMEGP.UPGRADATION`. Both use immutable version `2023-12-07-REVISED-GUIDELINES`, effective from `2023-12-07`; no later version is fabricated. Clause-level records retain authority, URL, document version, effective/retrieval dates, reference, and notes. Current portal and 2025 booklet records are supporting sources; the revised guideline is primary.

## New enterprise

The definition requires a new enterprise, eligible applicant/entity type, source-backed category and area, capital expenditure, no disqualifying prior government assistance, and an allowed activity. An individual must be strictly above 18. There is no income ceiling. Eighth standard is required only when manufacturing cost exceeds ₹10 lakh or service/business cost exceeds ₹5 lakh. The guideline family definition used is self and spouse; ProjectSetu does not infer family relationships.

Margin-money cost ceilings are ₹50 lakh manufacturing and ₹20 lakh service/business. Excess may remain financed outside the subsidy basis. Land remains in actual cost but is excluded from PMEGP-financeable cost. Ready-built/rented/leased workshed cost requires source-backed annual amount and duration and is capped at three years. Working capital is capped at 40% of the eligible manufacturing project total or 60% of the eligible service/business total. A working-capital-only project is ineligible.

`calculated margin money = PMEGP-admissible project cost × category/area rate`. Rates are general urban 15%, general rural 25%, special urban 25%, and special rural 35%. Missing category/area evidence yields insufficient information. Required contribution is 10% general or 5% special; expected bank finance is the corresponding 90% or 95% of PMEGP-financeable cost. Actual amounts are compared, never rewritten.

The negative list and exceptions are explicit. Slaughtered-meat processing/canning, tobacco, intoxicants/liquor/toddy-for-sale, crop cultivation/plantation, and locally prohibited activities are prohibited. Non-vegetarian hotels/dhabas, agricultural value addition, off-farm/farm-linked activity, dairy, poultry, aquaculture, beekeeping/insect activity, and sericulture-linked activity retain documented exceptions. Piggery is a conditional NER exception requiring explicit evidence. Trading/transport portfolio limits are not applicant-level guarantees; absent current portfolio evidence requires manual review. Regulated plastic/environment-dependent activity likewise requires current compliance evidence.

## Upgradation

Upgradation is a separate definition, not the new-enterprise matrix with altered values. Qualifying prior PMEGP, REGP, or MUDRA units require timely first-loan repayment, at least three profitable years, good turnover, growth potential, and Udyam registration. PMEGP/REGP prior margin money must be adjusted where applicable; MUDRA does not acquire a fake adjustment condition. Missing evidence is insufficient information, never favorable.

Ceilings are ₹1 crore manufacturing and ₹25 lakh service/business. Contribution is 10% and expected bank finance 90%. The standard rate is 15%; NER/Hill-State is 20%. Absolute caps are ₹15 lakh/₹20 lakh for standard/special manufacturing and ₹3.75 lakh/₹5 lakh for standard/special service/business.

## Lifecycle, flow, and boundary

`calculatedEligibleMarginMoney` is an expected entitlement under the selected immutable version—not sanctioned, received, adjusted, or accounting income. Assistance is credit-linked, released to the financing bank, held in TDR/SRF for three years, and adjusted after the recorded prerequisites, physical verification, and implementing-agency instruction. Claim, verification, refund/recovery, and ledger execution are not performed.

```text
version/date resolution
  -> source-backed category, area, activity, and history resolution
  -> exact cost eligibility and limits
  -> generic eligibility evaluation through registered handlers
  -> contribution and bank-finance constraints
  -> margin money for eligible/conditionally eligible cases
  -> normalized summary, snapshot, sources, and traces
```

All finance arithmetic uses Decimal.js with no intermediate rounding or input mutation. Live quota retrieval, portals/APIs, recommendation/optimization, document extraction, sanction/claim/disbursement workflow, TDR/SRF accounting, recovery execution, accounting recognition, cross-scheme compatibility, UI, persistence, and rendering remain deferred. An official rule change requires a new immutable program version.
