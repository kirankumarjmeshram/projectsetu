# Security guidelines

ProjectSetu will handle confidential business documents and personally identifiable and financial information. The current foundation does not implement authentication, authorization, uploads, storage, or audit logging.

## Non-negotiable rules

1. Never commit uploaded user documents, customer quotations, generated customer reports, database dumps, API keys, or authentication secrets.
2. Never log Aadhaar, PAN, bank details, complete request payloads containing customer/project data, credentials, or document contents.
3. Use synthetic or sanitized values in tests, fixtures, screenshots, and resources.
4. Load production secrets from environment variables or a secure secret manager; rotate exposed secrets immediately.
5. Apply least-privilege authorization to every project and document operation.

## Future file handling

Validate content using allowlisted types and content inspection rather than filename alone. Enforce file-size limits, sanitize display filenames, generate storage keys, prevent path traversal, and evaluate malware scanning. Store confidential objects privately, use short-lived signed access, and avoid public object URLs. Define retention and secure deletion policies before production.

Add structured, privacy-aware audit logging for sensitive actions without recording protected payloads. Complete threat modelling and security review before accepting real customer documents.
