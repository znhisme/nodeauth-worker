---
quick_id: 260504-pdg
slug: openai-otpauth-totp
status: complete
created: 2026-05-04
---

# Quick Task 260504-pdg: Import OpenAI OTPAuth TOTP Entries

## Goal

Use the existing local debug/import test flow to import two provided OpenAI `otpauth://` TOTP entries into the local NodeAuth test vault.

## Tasks

1. Locate the existing import flow and local debug assumptions.
   - Files: `.planning/session-reports/local-debug-runbook.md`, `src/features/vault/vaultRoutes.ts`
   - Action: Confirm the correct local test URL, database, user, and import endpoint.
   - Verify: Identify `/api/vault/add-from-uri` as the scanner/import endpoint and use the local debug hostname for license validation.
   - Done: Confirmed `http://2fa.eggai.icu:3001`, `/tmp/nodeauth-local-test.db`, and `local-test@nodeauth.local`.

2. Import both provided OTPAuth URIs through the authenticated local test flow.
   - Files: runtime local test database only
   - Action: Generate a local test session cookie/CSRF pair and POST each URI to `/api/vault/add-from-uri`.
   - Verify: Both requests return HTTP 200 with `success: true`.
   - Done: Both OpenAI entries imported with `type=totp`, `algorithm=SHA1`, `digits=6`, and `period=30`.

3. Verify the imported records and run backend tests.
   - Files: `/tmp/nodeauth-local-test.db`, backend test suite
   - Action: Query sanitized row metadata and run `npm --prefix backend test`.
   - Verify: Two active OpenAI vault rows exist and all backend tests pass.
   - Done: Verified two rows and 116 backend tests passing.
