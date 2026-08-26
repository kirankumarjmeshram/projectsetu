# DPR report engine

## Boundary and flow

Task 020 implements the application-level DPR foundation under `src/lib/reports`. It is deliberately outside `src/domain`: report code copies existing immutable input, calculation, funding and approved quotation data; it never invokes or duplicates a financial, scheme or funding calculation.

The flow is `input snapshot → calculation/funding snapshot → DprReportModel → narrative validation → report validation → PDF/DOCX/XLSX renderers → report artifact storage`.

The same `DprReportModel` supplies every renderer. Each financial cell retains an exact canonical decimal string, an authoritative source path and a separately rounded display value. This prevents presentation concerns from mutating snapshots.

## Content model and templates

The base template is `BASE_BANKABLE_DPR/1.0`; the content schema is version 1. A bankable project with no selected program is a permanent supported path. The section registry combines base bankable content with generic versioned program/funding and approved quotation/annexure contributors.

There is no program-ID branching in the report builder. Program versions, eligibility, benefit kinds, calculated amounts, release mechanisms and compatibility statuses come from existing evaluation/funding outputs. Unknown compatibility is never described as compatible. Credit is not described as subsidy. Back-ended or conditional assistance is separated from initial funding.

## Narrative providers and editing

`DeterministicNarrativeProvider` produces a complete English DPR with no API key or network. `GuardedNarrativeProvider` accepts an optional injected external generator, limits length and markup, and rejects numeric tokens absent from the allowed authoritative facts. Failure, malformed output or unsupported numbers fall back to deterministic text.

An external provider must receive only minimized approved facts and must not invent numbers, approvals, sanctions, contracts, quotations, licences, compliance or market statistics. No AI SDK or provider secret belongs in `src/domain` or client code.

The preview UI allows edits to selected narrative sections. Approved overrides are stored in the immutable report version. Generating again creates a new version and never overwrites older approved content or artifacts.

## Validation and provenance

Validation classifies `BLOCKING`, `WARNING`, `INFORMATION` and `MANUAL_REVIEW` findings. It checks identity and project association, required financial sections, scheme funding snapshot presence, balance-sheet status, undefined IRR, funding review status and approved/mapped quotation provenance. Only blocking findings prevent export.

Quotation provenance is admitted only when an approved review, active project-cost mapping and approved project document agree. Raw extraction is never authoritative. Sensitive identity documents are not auto-annexed.

Each report version references the project, exact input snapshot, calculation run, optional funding snapshot, selected program/version context, template version, content schema version and generation time. Canonical content and user overrides are persisted for reproducibility.

## Presentation and precision

The central policy uses Decimal.js round-half-up only at presentation: currency, percentages and ratios use two decimal places and currency uses Indian grouping, for example `₹1,25,00,000.00`. Snapshots remain unrounded canonical strings.

XLSX stores a readable display column and a paired exact-snapshot column as text. Financial engines are not recreated as Excel formulas, and authoritative decimals are not globally converted to IEEE-754 numbers.

## Renderers and storage

- PDFKit creates structured A4 pages, cover, contents, page numbers, headings, repeating table headers and paginated financial rows without Chromium.
- `docx` creates an editable A4 Word document with heading styles, a refreshable table of contents, headers/footers and editable tables.
- ExcelJS creates 15 named sheets with paired presentation and exact-snapshot columns.

Generated artifacts use `ReportArtifactStorage`, not PostgreSQL blobs. Local development stores opaque project-scoped keys under `data/reports`; database rows contain metadata, checksums and storage keys. Download actions validate project → report → document association and never accept a raw storage key from the browser. Filenames are sanitized.

PostgreSQL databases must use UTF-8 encoding because persisted report metadata contains Indian-currency and other Unicode presentation text. The embedded integration-test cluster is initialized explicitly with UTF-8 and the `C` locale so Windows host code pages cannot change this behavior.

## Lifecycle and limitations

Statuses are `DRAFT`, `GENERATING`, `REVIEW_REQUIRED`, `READY`, `FAILED` and `SUPERSEDED`. The UI implements preview, warnings, narrative edits, generation, history and downloads. PDF source-document merging, automatic annexure inclusion, external researched market evidence, actual AI transports and full translation are deferred.

Task 021 remains responsible for production authentication/RBAC, deployment, billing, administration, production object-store credentials and operational observability.
