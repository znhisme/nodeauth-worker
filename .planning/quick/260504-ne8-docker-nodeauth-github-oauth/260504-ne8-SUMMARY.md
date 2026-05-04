---
status: complete
quick_id: 260504-ne8
slug: docker-nodeauth-github-oauth
completed_at: "2026-05-04T08:58:00.000Z"
---

# Quick Task 260504-ne8 Summary

## Outcome

NodeAuth is running locally in Docker with SQLite storage and GitHub OAuth configured.

## Local Runtime Files

- `.env.docker.local` contains the local runtime environment and secrets. It is ignored by git.
- `.env.docker.local.compose.yml` overlays `docker-compose.yml` so placeholder environment values are replaced by `.env.docker.local`. It is ignored by git.
- `data/` stores the local SQLite database and is ignored by git.

## Verification

- `docker ps` shows `nodeauth` up on `0.0.0.0:3000->3000/tcp`.
- `GET http://2fa.eggai.icu:3000/` returned `200 OK` when resolved to `127.0.0.1`.
- `GET /api/health/health-check` returned `passed: true` with `license_passed`, key checks, whitelist, and OAuth provider checks passing.
- `GET /api/oauth/providers` returned GitHub as the configured provider.

## Notes

- The provided license is bound to `2fa.eggai.icu`, not `localhost`.
- Browser access should use `http://2fa.eggai.icu:3000`, with local hosts/DNS resolving `2fa.eggai.icu` to `127.0.0.1`.
- GitHub OAuth callback must match `http://2fa.eggai.icu:3000/oauth/callback`.
