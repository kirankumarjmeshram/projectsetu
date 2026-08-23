# Document engine

## Status

Not implemented. Uploads, private storage, OCR, quotation extraction, conversion, and malware scanning are deferred.

The future engine should separate secure ingestion, validation, storage, extraction, human review, and domain mapping. Provider adapters belong in `lib`; document concepts belong in `domain`; workflow orchestration belongs in `features`.

Uploads must enforce allowlisted content types using content inspection, size limits, filename sanitization, generated storage keys, authorization, and private/signed access. Malware scanning and audit logging must be evaluated before production use. OCR and AI extraction outputs are untrusted inputs and require schema validation and human confirmation before affecting calculations.
