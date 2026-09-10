# Professional test and DPR review

All financial and business assumptions in the professional fixtures are synthetic applicant inputs. They are not market research, loan sanctions, scheme determinations, or CA certification.

## Reproducible commands

Install with `npm ci`, then install Chromium once with `npx playwright install chromium` (Linux CI uses `--with-deps`). On PowerShell use `npm.cmd` if the execution policy blocks `npm.ps1`.

- `npm test`: owned database lifecycle, migrations, unit/domain/readiness tests.
- `npm run test:watch`: same lifecycle for a Vitest watch session.
- `npm run test:db`: same lifecycle and real PostgreSQL integration tests.
- `npm run test:e2e`: same lifecycle; starts its own Next.js server on 127.0.0.1:3100, waits for `/api/ready`, runs Chromium, then stops the server.
- `npm run test:db:prepare`: start, migrate, check UTF-8/readiness, and stop the database started by this command. This is a preparation check, not a daemon command.
- `npm run test:db:check`: read-only live check. Does not start a server; exits nonzero when PostgreSQL is stopped.
- `npm run test:infra`: verify reachability, borrowed-server ownership, UTF-8, repeated migrations, failure handling, and the real readiness 503 response.
- `npm run test:reports`: produce deterministic no-scheme and scheme-linked PDF/DOCX/XLSX fixtures under `tmp/professional-qa/` using the real exporters.
- `npm run test:verify`: typecheck, lint, unit, DB, E2E and production build in sequence. Stops on failure; no background manual DB session is needed.

The default isolated cluster is `.postgres-test-data`, listening only on 127.0.0.1:5433, with database `projectsetu_test`. It is persistent across commands. The runner never reads `.env` or `DATABASE_URL` to select the test target. It injects its test URL into both application and integration-test environments. It does not drop or truncate databases. A non-UTF-8 database fails with guidance instead of being silently deleted.

An explicit `TEST_DATABASE_URL` selects an already-running loopback PostgreSQL service with database name exactly `projectsetu_test`; URL query overrides and remote hosts are rejected. CI uses this mode on port 5432. The runner verifies and migrates that database but does not stop the external service. These credentials must belong to a disposable test service.

Only one managed command may run per checkout. `.test-run.lock` records the owning PID. If a terminal is forcibly killed, first inspect that PID and verify no test/server process remains; only then remove the stale lock. A live owner is never killed or its lock stolen. PostgreSQL stopped by the runner uses bounded `pg_ctl stop -m fast`, preserving the cluster. Force-killing the whole terminal cannot guarantee cleanup.

In a restricted Windows agent sandbox, Playwright may require permission to terminate its own Next.js/Chromium process trees. This is distinct from normal developer terminal execution. The verified E2E run used that permission and completed teardown.

## Accounting findings and changes

Case A models a millet-processing unit: machinery and packing equipment ₹8 lakh, working-capital reserve ₹2 lakh, applicant equity ₹4 lakh and proposed term loan ₹6 lakh. Case B supplies PMMY facts explicitly and uses the same finances; no subsidy is introduced. All selling prices, utilisation, growth, expenses, tax rates, loan terms and working-capital days are fixture assumptions.

The original case had a ₹7.40 lakh year-one accounting imbalance: ₹8 lakh startup machinery was omitted from cash capex, and ₹60,000 interest was deducted twice. The fixes include opening startup assets in year-one acquisitions and reverse P&L interest in operating cash flow because actual interest paid is classified under financing. This is consistent with the indirect-method treatment of financing-related expenses described in [IAS 7](https://www.ifrs.org/issued-standards/list-of-standards/ias-7-statement-of-cash-flows.html/); this application review is not a statutory accounting opinion.

The independent Decimal checks reconcile all five years of sales, expenses, depreciation, equal-principal loan amortisation, P&L, cash flow, working capital, debt classification, retained earnings and balance sheets. Year one: revenue ₹15 lakh, operating expenses ₹9.60 lakh, EBITDA ₹5.40 lakh, depreciation ₹80,000, interest ₹60,000, PBT ₹4 lakh, tax ₹1 lakh, PAT ₹3 lakh, working-capital gap ₹1.90 lakh, closing cash ₹2.70 lakh. DSCR is 2.444444… and ICR 7.666666… under the stated fixture assumptions.

Investment returns use the existing pre-tax unlevered approach. The upfront working-capital reserve is excluded from initial fixed investment because the actual operating requirement is deducted separately. NPV, the IRR root, payback and profitability-index arithmetic are independently checked. Terminal working-capital recovery and zero asset salvage are explicitly disclosed, not externally verified. These are not after-tax equity returns.

Unbalanced reports, failed calculations, unsupported financing drawdowns, and startup costs without matching modeled asset acquisitions block export. Land, pre-operative items and other costs must have an explicit supported accounting treatment; this pass does not invent capitalization or amortisation policies. Working-capital bank finance shown by the assessment is an indicative requirement, not an automatic drawdown or sanction.

## Security and user flow

Real PostgreSQL action tests exercise report creation/downloads, owner/admin access, unauthorized callers, cross-project report/document association, unchanged-save calculation preservation, stale report rejection, and immutable historical bytes. Session/framework boundaries are stubbed for these action tests; repositories, SQL, renderers and storage are real. Browser tests separately exercise actual account creation, sign-out/sign-in, project entry, multiple cost/revenue/expense lines, calculation, all downloads, refresh/reopen, changed-input invalidation, recalculation, report v2 and byte-identical v1 downloads.

Input changes now clear in-memory calculation results. Saving identical inputs preserves the current snapshot instead of invalidating the calculation. Raw database errors are no longer returned by project, quotation, document and admin action catch blocks. Explicit authorization and association errors remain available.

Unknown scheme facts and unsupported convergence retain review/unknown states. Approved and mapped quotations are the only report evidence sources. Scheme results remain subject to authority verification and lender appraisal; fixture answers are not proof of eligibility.

## Artifact inspection

Both cases generate valid PDF, DOCX and XLSX artifacts. PDFs have 21 and 23 pages respectively, with no blank pages, landscape schedules, page numbering, disclaimers, parseable text and embedded rupee glyphs. Noto Sans is bundled under its [SIL Open Font License](https://github.com/notofonts/noto-fonts/blob/main/LICENSE); see `resources/fonts/OFL.txt`. English/Latin report output and ₹ were inspected; this does not claim support for all Indian scripts.

DOCX files are valid OOXML ZIPs with editable tables and headings, 7 page sections and portrait/landscape setup. The packaged renderer was attempted and failed because LibreOffice `soffice.exe` is unavailable. No Word/LibreOffice visual QA is claimed.

XLSX files reopen with the required 15 sheets, frozen panes, print areas, landscape setup, exact text snapshot values, and no formulas or invalid-value cells. The footer syntax was corrected to include an explicit center section. Native Excel visual/print rendering has not been performed.

## Non-blocking follow-up recommendations

- Reduce sparse PDF pagination and add page references to the table of contents.
- Add supported accounting schedules for land, preliminary expenses, working-capital loans and other financing before allowing those cases to export.
- Add broader Indian-script fonts and render tests before claiming multilingual DPR support.
- Add Word/LibreOffice and Excel print-render QA to a suitable CI environment.
- Present clearer inline explanation of the working-capital finance requirement versus an actual financed source.

## Git preservation

At inspection, main and origin/main both pointed to `3c79850`; the supplied statement that main was three commits ahead was stale. No staging, commits, merging, pushing, resets or reverts are part of this pass. All changes remain available for review.

## Final verification — 10 September 2026

`npm run test:verify` exited 0: typecheck and lint passed; 942 unit tests in 57 files, 86 real database tests in 8 files, and 3 Chromium tests passed; production build passed. Infrastructure checks passed. Database ownership lock was removed after teardown. A stopped-database check correctly exited 1. `git diff --check` passed and the index is empty.

`npm run format:check` exited 1 on 86 unchanged baseline files. This is an outstanding CI gate, not a financial test failure. Repo-wide formatting was explicitly prohibited and has not been performed. Verdict: NOT READY TO PUSH.

Both fixture exports were regenerated after the final source changes. Independent openpyxl comparisons verified every display cell and all 617 authoritative cells (307 case A, 310 case B). PDF contact-sheet review confirmed coherent pagination; native DOCX/Excel visual and print checks remain unavailable. Artifact evidence is in `tmp/professional-qa/` (ignored generated output).

## Exact change manifest

| File                                                                    | Reason                                                                                             |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`                                              | Verify test infrastructure against the CI PostgreSQL service.                                      |
| `.gitignore`                                                            | Exclude generated test artifacts and lifecycle lock from source checks or Git.                     |
| `.prettierignore`                                                       | Exclude generated test artifacts and lifecycle lock from source checks or Git.                     |
| `README.md`                                                             | Document reproducible commands, audit findings and verification limitations.                       |
| `e2e/project-lifecycle.spec.ts`                                         | Verify actual user lifecycle and immutable downloads using an isolated ready server.               |
| `eslint.config.mjs`                                                     | Exclude generated test artifacts and lifecycle lock from source checks or Git.                     |
| `next.config.ts`                                                        | Include bundled PDF fonts in deployment traces.                                                    |
| `package-lock.json`                                                     | Register managed verification scripts and explicit tsx development dependency.                     |
| `package.json`                                                          | Register managed verification scripts and explicit tsx development dependency.                     |
| `playwright.config.ts`                                                  | Verify actual user lifecycle and immutable downloads using an isolated ready server.               |
| `scripts/migrate-test-db.ts`                                            | Provide owned test infrastructure, reliable teardown, migrations and reproducible artifact checks. |
| `scripts/test-db-setup.ts`                                              | Provide owned test infrastructure, reliable teardown, migrations and reproducible artifact checks. |
| `src/app/actions/admin-actions.ts`                                      | Sanitize unexpected action errors; project saves also preserve unchanged snapshots.                |
| `src/app/actions/document-actions.ts`                                   | Sanitize unexpected action errors; project saves also preserve unchanged snapshots.                |
| `src/app/actions/project-actions.ts`                                    | Sanitize unexpected action errors; project saves also preserve unchanged snapshots.                |
| `src/app/actions/quotation-actions.ts`                                  | Sanitize unexpected action errors; project saves also preserve unchanged snapshots.                |
| `src/domain/cash-flow/adapters.ts`                                      | Add and verify interest reversal to prevent double deduction.                                      |
| `src/domain/cash-flow/calculations.test.ts`                             | Add and verify interest reversal to prevent double deduction.                                      |
| `src/domain/cash-flow/calculations.ts`                                  | Add and verify interest reversal to prevent double deduction.                                      |
| `src/domain/cash-flow/cash-flow.ts`                                     | Add and verify interest reversal to prevent double deduction.                                      |
| `src/features/financial-results/components/cash-flow-table.tsx`         | Clear stale calculations and expose corrected cash-flow/returns explanations.                      |
| `src/features/financial-results/components/investment-returns-card.tsx` | Clear stale calculations and expose corrected cash-flow/returns explanations.                      |
| `src/features/project-wizard/components/wizard-container.tsx`           | Clear stale calculations and expose corrected cash-flow/returns explanations.                      |
| `src/lib/application/orchestrator/calculation-orchestrator.ts`          | Correct startup capex and return investment; flag unsupported accounting treatments.               |
| `src/lib/persistence/testing/auth-integration.test.ts`                  | Exercise real database security, report versioning and safe test connections without silent skips. |
| `src/lib/persistence/testing/test-db.ts`                                | Exercise real database security, report versioning and safe test connections without silent skips. |
| `src/lib/reports/builder.ts`                                            | Block invalid reports, disclose financial assumptions and correct export formatting/font behavior. |
| `src/lib/reports/renderers/excel.ts`                                    | Block invalid reports, disclose financial assumptions and correct export formatting/font behavior. |
| `src/lib/reports/renderers/pdf.ts`                                      | Block invalid reports, disclose financial assumptions and correct export formatting/font behavior. |
| `src/lib/reports/report-engine.test.ts`                                 | Block invalid reports, disclose financial assumptions and correct export formatting/font behavior. |
| `src/lib/reports/validation.ts`                                         | Block invalid reports, disclose financial assumptions and correct export formatting/font behavior. |
| `tsconfig.json`                                                         | Retain Next-generated development type discovery.                                                  |
| `docs/professional-validation.md`                                       | Document reproducible commands, audit findings and verification limitations.                       |
| `resources/fonts/NotoSans-Bold.ttf`                                     | Bundle licensed PDF font with rupee glyph support.                                                 |
| `resources/fonts/NotoSans-Regular.ttf`                                  | Bundle licensed PDF font with rupee glyph support.                                                 |
| `resources/fonts/OFL.txt`                                               | Bundle licensed PDF font with rupee glyph support.                                                 |
| `scripts/professional-report-qa.ts`                                     | Provide owned test infrastructure, reliable teardown, migrations and reproducible artifact checks. |
| `scripts/run-tests.ts`                                                  | Provide owned test infrastructure, reliable teardown, migrations and reproducible artifact checks. |
| `scripts/test-infrastructure.ts`                                        | Provide owned test infrastructure, reliable teardown, migrations and reproducible artifact checks. |
| `src/lib/application/orchestrator/professional-review.test.ts`          | Add independent five-year financial reconciliation and invalid-case fixtures.                      |
| `src/lib/application/orchestrator/testing/professional-fixture.ts`      | Add independent five-year financial reconciliation and invalid-case fixtures.                      |
| `src/lib/persistence/testing/report-actions-integration.test.ts`        | Exercise real database security, report versioning and safe test connections without silent skips. |
| `src/lib/testing/test-database-safety.test.ts`                          | Verify isolated test database URL restrictions.                                                    |

## Final release review

Verdict: NOT READY TO COMMIT because of a reproduced investment-return defect, not formatting. The earlier classification of the 86 formatting warnings as P1 is superseded.

### P2: pre-existing Windows checkout formatting

All 86 failing files are outside this task's changed-file set. Every committed HEAD blob passes Prettier. With the existing `core.autocrlf=true`, `git cat-file --filters HEAD:<path>` reproduces each working-tree file byte-for-byte, and all 86 filtered baseline copies fail Prettier. This proves a baseline CRLF/LF checkout mismatch, not task-introduced formatting or 86 badly formatted committed sources. No unrelated file was formatted. The already-changed package lock was normalized to LF so its explicit check also passes despite its pre-existing exclusion from repository checks.

### P1: declining working capital omitted from project returns

`calculation-orchestrator.ts:1190` clamps negative working-capital changes to zero in investment-return inputs. Intermediate releases are not placed in `workingCapitalRecovery`; only the final balance is recovered. This branch predates the hardening diff but materially affects the financial scope under review.

Reproduction: use the professional fixture with both products' annual quantity growth set to -5 percent and annual price escalation set to zero. Calculation succeeds, every balance sheet balances, and report validation permits export. Working capital falls from 190000 to 182000 in year two: 8000 is released. EBITDA is 477000, so pre-tax unlevered year-two project cash flow should be 485000, but the returns series contains 477000. The omitted releases distort NPV, IRR and payback. The growing-sales fixture does not cover this case. Review evidence: `tmp/professional-qa/declining-review.ts`; reproduce with `npx tsx tmp/professional-qa/declining-review.ts`.

Required remediation: represent negative working-capital changes through the existing authoritative recovery component, combine that release with terminal recovery when applicable, and add a declining-working-capital regression. This review leaves financial source unchanged and reports the unresolved defect.

The startup capex, interest reversal and initial working-capital reserve exclusion are correct for the stated startup fixture. Financial returns are labeled indicative pre-tax unlevered project returns, not post-tax or equity returns. The release finding prevents a blanket statement that returns are correct for all supported inputs.

### Fresh final-state verification

The individually requested typecheck, lint, npm test (942), test:db (86), test:e2e (3), build and test:infra all exited zero. The full test:verify sequence also exited zero with 942 unit, 86 database and 3 browser tests. Git diff-check passed. Both sandbox browser executions required permitted termination of their verified isolated Next.js server trees after all assertions passed; these are not evidence of unattended teardown inside the restricted agent sandbox. PostgreSQL cleanup completed and released the ownership lock. All checks were rerun during this final review, not copied from the prior pass.

Both artifact sets were regenerated and independently parsed again: PDF 21/23 pages, no blank pages, rupee glyphs, page numbering and disclaimers; DOCX valid editable OOXML with 17/20 tables; XLSX 15 sheets each with all 617 authoritative cells and every display cell matched. Representative PDF schedules and disclaimer pages were visually inspected without observed clipping. Native Word and Excel visual/print QA remains unavailable. Security tests passed, including historical v1 downloads after v2 generation. No new security regression was found in the reviewed boundaries.

A final browser rerun with process-termination permission passed all 3 tests in 28.8 seconds and completed automatic teardown without intervention. The ownership lock was absent afterward; a fresh stopped-database check exited 1 as intended.
