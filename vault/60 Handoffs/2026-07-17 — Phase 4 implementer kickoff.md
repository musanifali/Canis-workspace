---
tags: [handoff, phase4]
created: 2026-07-17
---

# Phase 4 implementer kickoff — Workspace Service (Canis)

Canonical copy of the brief handed to the Phase 4 implementer session.

## Role & sources
Implementer per [[Review Workflow]]. Read: MEMORY recall, [[Operating Model]],
[[Architecture Decisions]] (ADR-1, ADR-4), `devdocs/workspace-spec-v1.md`,
`devdocs/security-review.md` §4 (names the first job), and the 🗄️ Phase 4
Trello list. Cards → In Progress when done; reviewer closes.

## State
Phases 0–3 complete + fully reviewer-signed-off (pass 12, #74+#32). Saved
workspaces persist to **localStorage** via a `WorkspaceStore` port. Phase 4 =
make persistence real: durable, multi-tenant, versioned, audited service
behind that same port.

## The seam
`packages/react/src/workspace/store.ts` — `WorkspaceStore` (list/get/create/
update/remove → WorkspaceRecord/Summary). Phase 4 = a real backend impl behind
this EXACT interface; SDK swaps localStorage → service transparently. Don't
change the port shape without a reviewer-flagged reason.

## Cards (suggested order)
1. **#24 DB schema** — workspaces (head pointer, tenant_id), workspace_versions
   (immutable spec jsonb + prompt + verdict + author), workspace_shares,
   data_contracts, audit_log. Drizzle + Postgres. Store spec as jsonb; don't
   shred blocks to rows in v1.
2. **#27 Immutable versions + audit** — edit → new version; head pointer;
   rollback = repoint; append-only. (Same schema design as #24.)
3. **#25 RLS multi-tenancy** — tenant_id everywhere + Postgres RLS (Tambo's
   pgRole/current_setting pattern). Failing cross-tenant test = acceptance.
4. **#26 /v1 API + OpenAPI + typed client** — versioned day one; OpenAPI source
   of truth; the WorkspaceStore port's real HTTP impl lives here.
5. **#28 Sharing & permissions** — private/team/org + roles; duplicate-and-
   modify; checks in the operations layer.
6. **#48 Per-tenant cost controls** — budgets, per-user rate limits, cost
   visibility. Saved workspaces cost zero at read time — reflect it.

## The ADR-4 job (security doc §4)
Demo `fetch(query, auth)` ignores auth + hits an in-memory array → ADR-4
auth-passthrough is "enforced, not exercised." Phase 4 deliverable: first real
auth-checked vendor backend so a query runs under the end-user's session.
Then UPDATE security-review.md §4 (it asks to be revisited).

## Hard constraints (reviewer-reject)
- `packages/core` stays pure (purity-guard test). DB → new `packages/db`;
  service → new `apps/api` or route handlers.
- Frozen Spec v1 is the stored contract: persist validated specs, migrate
  lazily at read (core migrations), never rewrite in place.
- Tambo consumed not forked (ADR-1); `tambo/` = pinned read-only, own git repo,
  NEVER run git from inside it.
- Tambo backend discipline: operations layer in packages/db, services call
  operations, DTOs, no inline SQL, migrations via drizzle-kit only.

## Early decisions to surface (flag on #24, don't guess)
1. Backend stack: NestJS apps/api (mirror Tambo, heavier) vs Next route
   handlers (lighter, faster solo). State a choice + trade-off.
2. Dev Postgres: reuse Tambo's local Docker PG vs a separate managed instance.
3. Demo cutover timing: migrate demo off localStorage this phase (proves the
   port swap end-to-end — highest-value) or later.

## Conventions & gotchas
Per-ticket commits, pushed (repo `/Users/thamacstore/tambo`, remote Canis).
build+test green before commit. Migrations via drizzle-kit (never hand-edit
SQL) + operation tests + cross-tenant RLS test. Session log in 50 Logs/.
**Product repo = /Users/thamacstore/tambo; `tambo/` is the vendored clone with
its own git+husky+npm≥11 — never run git after cd-ing into it.** Stack (Docker
+ tambo-start.sh, :8261) only needed for live generation, not the service's own
tests. npm 10.9.7.

## Definition of done
A saved workspace persists in Postgres across processes, is versioned +
audited, is RLS-isolated (proven by a failing cross-tenant test), is reachable
via a versioned /v1 API the SDK consumes through the same WorkspaceStore port,
and at least one contract fetch runs under a real end-user auth check — ADR-4
exercised, not just enforced.

## Not gating
Demo Polish findings #83–#86 are a separate presentation track.

Relates to [[Phase 3 implementer kickoff]], [[trello-workspace-engine-board]].
