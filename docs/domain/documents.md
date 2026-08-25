# Document Management & Quotation Processing

## 1. Overview & Architectural Principles

Task 019 introduces the production foundation for project document management and quotation processing in **ProjectSetu**.

### Core Principle: "Extraction Is Not Authority"
Raw extracted data from documents is treated strictly as **evidence and proposed facts**. It never directly alters authoritative financial models or Project Cost inputs without explicit user review, correction, approval, and mapping:

```text
UPLOAD -> EXTRACT / MANUAL ENTRY -> REVIEW & VERIFY -> APPROVE -> MAP TO PROJECT COST -> PROJECT COST ENGINE
```

---

## 2. Document Storage Abstraction

Document storage is decoupled behind the `DocumentStorage` interface in `src/lib/documents/storage.ts`:
- **LocalDocumentStorage**: Managed development/local filesystem storage located outside PostgreSQL.
- **Server-Controlled Storage Keys**: Keys follow the pattern `projects/${projectId}/${timestamp}_${uuid}_${sanitizedBasename}`.
- **Security & Path Traversal Prevention**: Absolute paths, `..` traversals, drive letters, and null bytes are rejected.
- **Content Hash & Duplicate Detection**: Computes SHA-256 hashes on upload to identify duplicate files.
- **File Validation**: Enforces MIME validation (`application/pdf`, `image/jpeg`, `image/png`, `image/webp`) and size limits (`MAX_DOCUMENT_UPLOAD_BYTES = 15 MB`).

---

## 3. Quotation Normalization & Indian Standards

Quotation parsing and normalization (`src/lib/documents/quotation/normalization.ts`) handles Indian currency conventions:
- Strips `₹`, `Rs.`, `INR`, trailing `/-`, and commas without losing decimal precision.
- Itemized GST computation (`5%`, `12%`, `18%`, `28%`) with CGST/SGST/IGST breakdown.
- Canonical decimal strings via `ProjectSetuDecimal` (`Decimal.js`). Zero IEEE-754 floating point arithmetic.

---

## 4. Quotation Extraction & Manual Fallback

- **Provider-Independent Extractor Interface**: `QuotationExtractionProvider` in `src/lib/documents/quotation/extractor.ts`.
- **Manual Quotation Entry**: Complete manual entry workflow allowing users to input vendor particulars, line items, taxes, freight, and installation charges without requiring AI or OCR keys.
- **Rule-Based Local Extraction**: Local rule-based parser that handles standard text/table quotation formats and flags unparseable documents as `MANUAL_REVIEW_REQUIRED`.

---

## 5. Review, Approval & Project Cost Mapping

- **Review & Verification Workflow**: Users can inspect extracted line items, correct rates, quantities, and GST rates, and save review drafts before approving.
- **Project Cost Mapping**:
  - `NEW_ITEM`: Creates new categorized cost item (e.g. `PLANT_AND_MACHINERY`, `BUILDING`).
  - `EXISTING_ITEM`: Updates existing cost item amount and appends quotation provenance.
  - `PARTIAL_ALLOCATION`: Maps designated portion of a quotation line.
- **Double-Counting Protection Engine**: Tracks `remainingMappableAmount = lineTotal - sum(activeAllocations)`. Prevents mapping more than the approved quotation amount.
- **Traceable Provenance**: Automatically attaches `Source: Quotation <Ref> | Vendor: <Name> | Item: <Description>` to project cost item notes.

---

## 6. Multi-Supplier Quotation Comparison

- Users can compare 2 or more quotations side-by-side across taxable base amounts, taxes, freight, installation, grand totals, and commercial terms.
- Does not automatically enforce the lowest price; user choice remains authoritative.

---

## 7. Deferred Task 020 Work

Task 019 implements source document management, retrieval, viewing, and cost mapping.
It does **NOT** generate final DPR narrative chapters, PDF bank appraisal reports, DOCX files, or Excel exports (scheduled for Task 020).
