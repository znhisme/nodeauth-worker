# Share Link Security Contract

This contract defines the security rules for single-account share links before any durable share state or route behavior depends on them.

## Token and Access-Code Handling

- Share URL tokens use 32 random bytes encoded as base64url.
- Access codes use 16 random bytes encoded as base64url.
- Access codes are independent from owner passwords, session secrets, and any vault secret.
- Raw share tokens and raw access codes are returned only from create-share behavior.
- Only HMAC-SHA-256 derived values are stored after creation.

## Expiration Policy

- The default TTL is 86400 seconds.
- The maximum TTL is 604800 seconds.
- Expiration is enforced on read and on any access decision that resolves a share.
- Expired shares are treated as inactive and must not reveal shared item content.

## Revocation Semantics

- A share can be revoked by the owner at any time.
- Revocation wins over any remaining TTL.
- Revoked shares must not be usable for access, token lookup, or code verification.
- Revocation state is authoritative even if derived secrets remain present in storage.

## TOTP Disclosure

- `SharedItemView` may expose the current OTP code and countdown metadata only when that information is already part of the item response contract.
- `SharedItemView` never includes raw TOTP seed, otpauth URI, raw internal IDs, session cookies, backup data, owner email, raw share token, or access-code hash.
- Recipient responses must use an explicit allowlist, not a copied vault record.

## Audit and Logging Allowlist

- Audit and log records must never include raw share tokens, raw access codes, full share URLs, passwords, TOTP seeds, otpauth URIs, session cookies, backup payloads, or owner email.
- Audit events may record status transitions such as created, access granted, access denied due to threshold, expired, and revoked.
- Derived identifiers may be logged only when they cannot be reversed into raw secrets.

## Public Response Protections

- Public responses use `Cache-Control: no-store`.
- Public responses use `Pragma: no-cache`.
- Public responses use `Referrer-Policy: no-referrer`.
- Recipient-facing responses must not leak unrelated vault entries, owner session data, or internal administrative metadata.

## Canonical Public Origin

- `NODEAUTH_PUBLIC_ORIGIN` is the canonical public origin when set.
- If `NODEAUTH_PUBLIC_ORIGIN` is not set, the request origin may be used only when it is `https://` or localhost over HTTP.
- Unsafe origins must be rejected before a public share URL is constructed.
- Public share URLs must be canonicalized to the share route path rather than preserving arbitrary input paths.

## Fail-Closed Rate Limiting

- Share access attempts must be rate limited per share and per access code.
- The limiter must fail closed on storage, parsing, or lookup errors.
- Failed threshold checks are security events and must not expose the underlying share content.
- The limiter window is 15 minutes with a maximum of 5 attempts before lockout.

## API-Only UI Scope

- This checkout documents the share-link API and security contract only.
- Editable frontend source is not required for this phase, so no generated frontend assets are modified.
- Owner and recipient UI surfaces are identified at the contract level, but implementation may remain API-first until editable UI source is available.
- Client requests for recipient access code submission must send the code in the request body, not in a URL query.
