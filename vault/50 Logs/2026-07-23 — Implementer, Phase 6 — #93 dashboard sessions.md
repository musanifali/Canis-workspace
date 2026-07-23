---
tags: [log, implementer]
created: 2026-07-23
---

# 2026-07-23 · Implementer — Phase 6 #93 real dashboard auth (sessions)

Third Phase 6 ticket. Replaces the dashboard's pinned `canis_ops` x-user-id
header with real, revocable GitHub-login sessions. Branch
`phase6/93-dashboard-auth` (stacked on the #91 branch — needs its `users`
table), PR musanifali/Canis-workspace#3. Three commits (backend, dashboard,
seed/env).

## Architecture decision

Sessions are **server-side rows** (new `sessions` table, owned by the API
since the API owns the DB) behind a small **/v1/auth** module; the dashboard
stays a pure API client (its "like any vendor" design), holding only an
opaque http-only cookie.
- Server-side rows → logout is a real revocation; a fresh token minted every
  login is the structural session-fixation defense.
- Login reuses #91's GitHub OAuth. **GitHub allows one callback URL**, so the
  signup and login flows SHARE `/api/auth/github/callback`, which branches on
  which signed state cookie is present (`login_state` → login; else signup).
- The dashboard serves ONE tenant (`WORKSPACE_TENANT_ID`); only that tenant's
  members may log in, else a user from another tenant would act under this
  dashboard's tenant key. Multi-tenant per-user key routing is a filed
  follow-up, not this card.

## Shipped

- **DB:** `sessions` table (token sha256 only; owner-connection; service role
  `REVOKE`d — migration 0010). Ops: create/resolve (expiry in-query)/delete/
  deleteUserSessions/getUserByExternalId/listTenantMembers. 71/71 db tests.
- **API:** `/v1/auth` (no TenantGuard) — login (provision-secret gated),
  session (bearer), logout (bearer → revoke), members (bearer, owner-only).
  Extracted the shared `verifyProvisionSecret` (signup + auth reuse it).
  59/59 api tests; openapi.json regenerated.
- **Dashboard:** `/login` + login OAuth start; shared callback branch;
  `middleware.ts` auth-gate (pages only — `/api` self-gates); proxy +
  contracts/telemetry pages derive x-user-id from the session; logout (POST,
  SameSite=Lax); owner-only `/members`; layout shows the user + logout.
- **Seed/env:** seed-dashboard-tenant.mjs creates a login owner user
  (`GITHUB_OWNER_ID`) + prints `WORKSPACE_TENANT_ID`; `.env.example`
  documents the tenant binding and marks `WORKSPACE_DASHBOARD_USER`
  superseded.

## Live verification (all 5 ACs)

Sessions minted via the API to drive everything but the browser-only GitHub
click:
1. protected pages 307 → /login; /login + /signup 200; authed pages 200.
2. proxy with NO session + forged `x-user-id` → **401**; session + forged
   header → 200 (forged ignored).
3. owner + member each `workspace.created` → two distinct audit actor ids.
4. fresh token each login; logout POST-only (GET → 405); SameSite=Lax.
5. same token 200 before logout, 401/redirect immediately after.

## New env vars

- Dashboard: `WORKSPACE_TENANT_ID` (the tenant it serves). Reuses #91's
  `GITHUB_CLIENT_ID/SECRET`, `WORKSPACE_PROVISION_SECRET`, `WORKSPACE_API_URL`.

Card left In Progress for a reviewer pass. Relates to [[phase6-launch]],
the #91 self-signup log, [[review-workflow]].
