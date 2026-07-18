---
tags: [log, implementer, phase5]
created: 2026-07-18
---

# Implementer session — Phase 5: vendor dashboard + dogfooding (#31, #53)

Continues the Phase 5 run (prior session: #87 fix, D1–D5 decisions note,
#29 contracts-diff, #49 contracts lint — that session ended before its log;
this one covers the board sync it owed).

## Board access restored

Trello token rotated (user action, done live this session). New token in
`~/.claude.json` + repo `.env.mcp` (gitignored). Synced the debt: #87/#29/#49
moved to In Progress with commit refs; D1–D5 mirrored as comments onto
#29/#30/#31/#33/#51/#52/#53. MCP tools still need a fresh session; this one
drove the Trello REST API directly.

## Commit 485c9b2 — contracts + audit surface (#31 groundwork)

- **/v1/contracts** GET/GET:one/PUT/DELETE — vendor self-service registry.
  *Posture change flagged for review:* registration was owner-db-only
  (e2e-support called it an admin op); it's now tenant-key self-service.
  Argument: it's the key-holder's own power domain (gates only their specs),
  RLS-scoped, audit-logged (`contract.registered/updated/removed` already
  existed in the ops layer, unused), and storage is gated by core's
  `reviveContract` + a name↔path pin — the registry can't hold what the gate
  can't enforce.
- **/v1/audit** GET — pager over the append-only trail (workspaceId / action /
  limit); bigserial ids as strings (JSON.stringify throws on bigint).
- **workspace.spec_rejected**: a refused save now writes the validator's
  structured errors to the audit trail *in its own transaction after the save
  tx rolls back* (an entry inside the aborted tx would vanish) — this is the
  data source for the rejected-capabilities report. Best-effort: audit failure
  never masks the 422.
- db: `AuditAction` + action filter on `listAuditEntries` (+ tests);
  client: `listContracts/getContract/upsertContract/removeContract/listAudit`;
  openapi.json + generated types regenerated. 55 db + 32 api tests green.

## Commit e01bbf7 — apps/dashboard (#31 + #53 as one)

Next 15 app on :3002 per D3, public SDK surface only:

- `src/canis/contracts.ts` — Canis as its own vendor: `defineEntity` for
  `audit_event`, `spec_rejection` (audit entries flattened one-row-per-
  violation so "top requested but rejected" is a groupBy), `usage_row`.
- `src/canis/specs.ts` — the analytics views ARE WorkspaceSpecs; the test
  suite holds each to a BUILD verdict under the standard `validateSpec`
  (plus a REJECT control). 9 tests.
- Key handling done right: GET-only proxy route injects the tenant key
  server-side and pins the acting user; the browser never sees either. (The
  demo's NEXT_PUBLIC_ pattern is PAPERCUTS.md #1.)
- Registry UI (SSR), saved-views home, `/w/[id]` renderer page.
- Seeding split by trust boundary: `scripts/seed-dashboard-tenant.mjs`
  (admin: tenant + key) → `npm run seed -w @workspace-engine/dashboard`
  (vendor-side, /v1 only: contracts PUT, server-gated saves, two deliberate
  422s to feed the rejections view, usage events).
- `PAPERCUTS.md` — 5 real cuts, each tagged to the card it feeds (#50 proxy
  recipe; #33 error-naming + timestamp inconsistency; #30 fetch-contract
  semantics; backlog: vendor provisioning surface).

**Live verification:** service on :8270 → tenant provisioned → seed clean
(3 contracts via /v1, 3 views saved server-gated, 2×422 audit-logged, usage
recorded) → `/v1/audit?action=workspace.spec_rejected` returns both refusals
with structured errors → SSR `/contracts` renders all three entities → proxy
serves workspace list, 404s non-whitelisted paths. Full repo `turbo build
check-types test lint`: 36/36. **Residual for reviewer:** client-side
WorkspaceRenderer mount not browser-driven (same class as Phase 4 pass 13).

## Gotchas logged

- `blockIdSchema` is `blk_[a-z0-9]+` — no underscores after the prefix.
- tsx runs `.ts` as CJS when the package isn't `"type": "module"` → seed is
  `.mts`.
- Next typed routes: `check-types` races `next build` rewriting `.next/types`
  under parallel turbo — dashboard `turbo.json` serializes them.
- eslint/gitignore now ignore `.next/` + `next-env.d.ts` repo-wide.

## Next

Track A remainder: none — #29/#49/#31/#53 all awaiting review. Track B next:
**#33 release engineering** (changesets/semver per D4), then #51/#30/#50,
#52 last. Demo Polish #83–#86 untouched (separate track).

Relates to [[2026-07-18 — Phase 5 implementer kickoff]],
[[Phase 5 tooling decisions (proposed)]], [[Review Workflow]].
