---
tags: [log, implementer]
created: 2026-07-19
---

# 2026-07-19 · Implementer — Phase 6 #91 tenant self-signup

Second Phase 6 ticket (after #106 legal). #91 is the launch-gating "single
biggest blocker": a cold visitor self-provisions a tenant + admin key, no
operator in the loop. Branch `phase6/91-self-signup`, PR
musanifali/Canis-workspace#2. Two commits (backend, dashboard).

## Auth provider decision

**GitHub OAuth** (confirmed with founder via AskUserQuestion). Devtools
audience already has GitHub; one-click; verified identity → audit names real
people (serves #93); no email infra. Trade-off: needs a GitHub OAuth app
(founder action); GitHub-only until a magic-link fast-follow. Identity model:
`users.external_id = "github:<numeric id>"` (survives handle renames).

## What shipped

- **DB (`@workspace-engine/db`):** new `users` table (owner-connection,
  tenant-scoped RLS SELECT, like tenants/api_keys) + unique `slug` on
  tenants. Migration `0009_phase6_signup_users.sql` — hand-edited to backfill
  existing tenants' slugs from their id before the NOT NULL (drizzle's
  generated ADD COLUMN NOT NULL would've failed on seeded rows).
  `provisionTenant` op: one owner-connection transaction → tenant + owner
  user + admin key + first `tenant.provisioned` audit entry. Idempotent on
  the owner's external id (double-OAuth-callback safe); typed
  `InvalidSlugError`/`TenantSlugTakenError`; slug validated +
  case/space-normalized. `createApiKey` widened to accept a tx (`OwnerWriter`)
  so provisioning is atomic. 64/64 db tests.
- **API (`@workspace-engine/api`):** `POST /v1/signup` — the ONLY /v1 route
  with no `TenantGuard` (runs before a tenant exists; guard is per-controller
  `@UseGuards`, so omitting it is the mechanism). Shared provisioning-secret
  gate (`WORKSPACE_PROVISION_SECRET`, constant-time compare, **fail-closed**
  when unset), disposable-email guard, per-IP in-process sliding-window rate
  limiter (10/10min → 429). Errors map 400/401/409/422/429. 51/51 api tests;
  `openapi.json` regenerated (v1.e2e snapshot guard).
- **Dashboard:** GitHub OAuth authorization-code flow implemented directly
  (no auth lib) — `src/lib/github-oauth.ts`, `oauth-state.ts` (HMAC-signed
  http-only cookies carry CSRF state + the org form across the round-trip;
  no session store yet), `provision.ts` (server-to-server call to
  /v1/signup). Routes: `/signup` (form), `/api/auth/github/start`,
  `/api/auth/github/callback`, `/welcome` (key shown ONCE via single-use
  cookie), `/api/signup/done` (clears it). Builds + typechecks + lints clean.
  NOTE: dashboard imports use the `@/` alias (bundler resolution), not
  relative `.js` — tsc accepts relative-.js but Next's webpack doesn't.

## Verification

Live smoke test over HTTP against the running service (`tsx src/main.ts`,
dev DB migrated): cold signup 201 → tenant + owner (role owner,
`github:99999`) + `tenant.provisioned` audit **confirmed in Postgres**;
minted admin key drives `/v1/contracts` 200; idempotent replay (same tenant,
null key); duplicate-slug 409; wrong-secret 401. The OAuth leg itself needs
the founder's GitHub app to run end-to-end.

## Left for the founder / other cards

- Register GitHub OAuth app → `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` +
  `WORKSPACE_PROVISION_SECRET` on the dashboard; then live OAuth is testable.
- Real login sessions + member list = **#93** (this ticket has no session
  store; the welcome flow is stateless cookies).
- Magic-link fallback for non-GitHub users; rate limiter → Redis on
  horizontal scale-out.

Card left In Progress for a reviewer pass + the live-OAuth check.

## New env vars introduced (dashboard + service)

- Service: `WORKSPACE_PROVISION_SECRET` (required for /v1/signup; fail-closed).
- Dashboard: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `DASHBOARD_BASE_URL`,
  `WORKSPACE_PROVISION_SECRET` (same value as the service),
  `WORKSPACE_API_URL`. Document in SELF-HOSTING when #96/#95 deploy work lands.

Relates to [[phase6-launch]], [[phase4-workspace-service]] (schema/RLS),
[[review-workflow]].
