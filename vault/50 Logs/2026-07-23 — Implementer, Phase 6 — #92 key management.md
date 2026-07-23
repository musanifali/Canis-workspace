---
tags: [log, implementer]
created: 2026-07-23
---

# 2026-07-23 · Implementer — Phase 6 #92 API key management

Fourth Phase 6 ticket (same day as the #106/#91/#93 merges). Self-service key
hygiene from the dashboard. Branch `phase6/92-key-management` (off main, now
that #91/#93 are merged), PR musanifali/Canis-workspace#4. Two commits
(backend, dashboard).

## Shipped

- **DB:** `api_keys.last_used_at` (migration 0011, nullable). `resolveApiKey`
  now stamps it on the auth hot path but **throttled** — a SELECT then a
  conditional UPDATE only when `last_used_at` is null or older than 60s, so a
  key hammered 1000×/s writes at most once/60s (no write amplification).
  `listApiKeys` (metadata only, never the hash); `revokeApiKey` changed to
  tenant-scoped `{keyId, tenantId}` so a tenant can't revoke another's key by
  id. api-keys.test.ts covers throttle/list/cross-tenant-revoke. 75/75 db.
- **API:** `/v1/keys` (TenantGuard + `@RequireScope("admin")`): GET list,
  POST mint (raw key once), DELETE :id revoke (tenant-scoped, idempotent →
  404). keys.e2e.test.ts: mint→use→revoke→401 flow, raw-once, last_used,
  runtime→403. 63/63 api. openapi regenerated.
- **Dashboard:** owner-only `/keys` — list (name/scope/created/last-used/
  status), mint (scope select; raw key revealed once via single-use signed
  `minted_key` cookie + copy client component), revoke (client-component
  native confirm), rotate (guided: mint replacement `"<name> (rotated)"`
  BEFORE revoking the old — a failed mint never strands the tenant). Mutations
  are owner-gated POST route handlers using the server-held admin key + the
  session user id; the proxy stays GET-only. Nav gains "API keys" (owner).

## Live verification (all ACs)

Against running /v1 + dashboard: mint→use(200)→revoke(204)→use-again(**401
immediate**)→revoke-again(404); revocation instant (resolveApiKey filters
`revoked_at IS NULL` every request — no cache, well inside the 60s AC); raw
key only from mint, never in list; last_used_at null→timestamp after one
request; runtime key → 403 `insufficient_key_scope` on GET/POST/DELETE;
`/keys` renders for owner + gated for non-owners; mint sets the one-time
reveal cookie.

## Process note

Ran the **workspace-wide `check-types` as the final gate** this time (see
[[run-check-types-last]]) — the #93 reviewer caught a vitest-green-but-tsc-red
miss; didn't repeat it. All 36 check-types+lint tasks green, dashboard build
green.

Relates to [[phase6-launch]]. Follow-ups (out of scope): rotation reminders,
key naming policy, usage analytics beyond last-used.
