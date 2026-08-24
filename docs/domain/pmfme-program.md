# PMFME program definitions

## Rule and status interpretation

The original PMFME guideline describes implementation from 2020-21 through
2024-25. The operative component rules implemented here are the Ministry of
Food Processing Industries Office Memorandum
`FM-11/64/2021-FME-Part(2)` dated 18 May 2022. It permits new and existing
micro-food-processing enterprises, makes ODOP a preference rather than an
absolute bar, and replaces the individual/group/common-infrastructure rules
described below.

The official portal remains operational, publishes live application/loan
statistics and lists a 30 December 2025 primary-processing clarification. A
formal continuation/extension order beyond the original period was not located.
Accordingly, no new validity date or `effectiveTo` is invented. Evaluations
after 31 March 2025 retain
`PMFME_FORMAL_CONTINUATION_BEYOND_ORIGINAL_2024_25_PERIOD_NOT_LOCATED` and
require manual review.

## Components

- `GOI.PMFME.INDIVIDUAL_UNIT`
- `GOI.PMFME.GROUP_CAPITAL_SUPPORT`
- `GOI.PMFME.COMMON_INFRASTRUCTURE`
- `GOI.PMFME.SHG_SEED_CAPITAL`

Individual and eligible group-owned micro units receive a calculated 35%
credit-linked capital subsidy on eligible plant/machinery and technical civil
work, capped at Rs 10 lakh per unit. Common infrastructure uses the same 35%
rate but its independent Rs 3 crore cap. The individual Rs 10 lakh cap is never
reused for common infrastructure.

Technical civil work is capped so it cannot exceed 30% of the resulting eligible
project cost. If `P` is eligible plant/machinery and `C` is eligible civil work,
the exact constraint is `C <= 3P / 7`. Land, rental/leased workshed and working
capital do not form the subsidy basis. A source-backed minimum 10% beneficiary
contribution is required and the remaining project funding is bank credit. The
subsidy is credit-linked, not immediate beneficiary cash.

ODOP match and source-backed non-ODOP allowance are distinct typed states. The
18 May 2022 Annexure I negative list is typed explicitly, including trading of
unprocessed produce, loose milk/honey/oil, animal rearing, fresh fish/meat
trading, repacking manufactured products and food-service enterprises.

Seed capital is Rs 40,000 per eligible food-processing SHG member, capped at
Rs 4 lakh per SHG. It is a grant to the federation through the prescribed
government livelihood structure and a loan from the federation to the member;
it is not modeled as capital subsidy.

## AIF convergence

The official PMFME/AIF SOP is registered as
`OFFICIAL_CONVERGENCE_SUPPORTED`. It records PMFME capital subsidy alongside
AIF's 3% interest subvention and credit-guarantee support, subject to independent
eligibility under each scheme. Task 015 does not allocate costs or optimize a
funding stack.

## Deferred and manual-review areas

Sanction, bank underwriting, subsidy release, a formal post-2024-25 continuation
decision, dynamic district ODOP catalogues, and funding composition remain
outside this module.
