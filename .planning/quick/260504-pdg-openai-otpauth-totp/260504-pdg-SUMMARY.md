---
quick_id: 260504-pdg
slug: openai-otpauth-totp
status: complete
completed: 2026-05-04
---

# Quick Task 260504-pdg Summary

Imported the two provided OpenAI `otpauth://` TOTP entries into the existing local NodeAuth test flow.

## What Changed

- Used the local debug runbook flow with `http://2fa.eggai.icu:3001`, `/tmp/nodeauth-local-test.db`, and `local-test@nodeauth.local`.
- Generated a temporary local authenticated session cookie and CSRF token.
- Called the existing `/api/vault/add-from-uri` endpoint for each provided URI.
- Verified two active `OpenAI` vault rows were created in the local test database.

## Imported Rows

Sensitive OTP secrets are intentionally omitted.

| Service | Account | Category | Type | Algorithm | Digits | Period | Owner |
|---------|---------|----------|------|-----------|--------|--------|-------|
| OpenAI | NortzRembert3878@hotmail.com \| RlGd6o8gBvEnv | 手机扫码 | totp | SHA1 | 6 | 30 | local-test@nodeauth.local |
| OpenAI | hwejc63wnx@feedpoly.asia \| hwejc63wnxfeedpoly.asia | 手机扫码 | totp | SHA1 | 6 | 30 | local-test@nodeauth.local |

## Verification

- `/api/oauth/me` returned HTTP 200 for the generated local test session.
- Both `/api/vault/add-from-uri` requests returned HTTP 200 with `success: true`.
- Direct SQLite verification found exactly two active OpenAI rows in `/tmp/nodeauth-local-test.db`.
- `npm --prefix backend test` passed: 11 test files, 116 tests.

## Notes

- This quick task changed local runtime test data, not source code.
- Tried targeted OTP/vault test filters first, but this checkout has no matching OTP or vault `.test.ts` files, so the full backend test suite was used as the quality gate.
