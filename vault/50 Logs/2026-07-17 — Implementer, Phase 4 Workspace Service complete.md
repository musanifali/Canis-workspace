---
tags: [log, implementer, phase4]
created: 2026-07-17
---

# Implementer session — Phase 4 Workspace Service, full implementation

**Scope:** all six Phase 4 cards (#24 #27 #25 #26 #28 #48) + the ADR-4
demo-cutover deliverable, one ticket at a time per the user's instruction.
Commits `935940d → 0d33668`, all pushed; cards → In Progress for the
reviewer.

## Decisions (surfaced to the user before building, logged on #24)
1. **Standalone NestJS `apps/api`** — user: "we are making our standalone
   product, why build around the demo." Operations stay in `packages/db`.
2. **Dedicated Docker Postgres** (`packages/db/docker-compose.yml`, port
   **5443** — 5433 is the Tambo stack's).
3. **Demo cutover this phase** — done; carries ADR-4.

## What exists now
- **`@workspace-engine/db`** — Drizzle schema (tenants, api_keys,
  workspaces, workspace_versions, workspace_shares, data_contracts,
  audit_log, usage_events), 7 migrations (all via drizzle-kit; 0000/0002 are
  authored `--custom` for role + append-only REVOKEs), operations layer, 52
  integration tests against real Postgres.
- **RLS by construction**: non-owner `workspace_service` role via
  `withTenant` (`SET LOCAL ROLE` + transaction-local `app.tenant_id` —
  pool-leak-safe, answering security-review §5's open question for our own
  service). Append-only tables have SELECT+INSERT policies only **plus**
  REVOKEd UPDATE/DELETE (loud `permission denied`). Composite FKs
  `(workspace_id, tenant_id)` close the FK-bypasses-RLS forgery path.
  Cross-tenant must-fail suite in `rls.test.ts`.
- **Versioning/audit (#27)**: edits append versions, head repoints,
  rollback = repoint, every version records prompt/spec/verdict/author;
  audit covers created/updated/viewed/rolled_back/deleted/shared/…
- **`/v1` API (#26)**: NestJS on :8270, TenantGuard (x-api-key sha256 →
  tenant; x-user-id; optional x-user-teams), zod pipes reusing core's spec
  schema, OpenAPI generated from controllers → committed `openapi.json`
  (drift-checked in e2e), swagger at /v1/docs, `API_VERSIONING.md`
  deprecation policy. 18 e2e contract tests in CI (postgres service added
  to the verify job).
- **`@workspace-engine/client`**: types generated from openapi.json;
  `createHttpWorkspaceStore` = the port swap, held to the SDK's exact
  `WorkspaceStore` type by a compile-time test.
- **Sharing (#28)**: owner/editor/viewer + org visibility + team shares in
  the ops layer; no-view = 404 (no existence leak), no-right = 403;
  duplicate-and-modify.
- **Cost controls (#48)**: usage_events ledger, monthly budget + per-user
  rate limit, machine-readable 429s, /v1/usage endpoints; reads never
  metered (two-phase design → zero read cost).
- **ADR-4 exercised**: demo vendor backend
  (`/api/vendor/cases/query` + `/api/vendor/session` HMAC tokens) checks
  the end-user session that `WorkspaceProvider.userToken` threads
  unchanged; 401 without. Demo store cutover behind
  `NEXT_PUBLIC_WORKSPACE_API_URL/_API_KEY` (seed via
  `scripts/seed-demo-tenant.mjs`). `security-review.md` §4 rewritten.
  Cross-process persistence proven in `persistence.e2e.test.ts`.

## Gotchas worth remembering
- drizzle-kit can emit an FK before the unique constraint it references in
  one migration (Postgres rejects); fix by two-step generation, never by
  hand-editing.
- RLS policy absence ≠ error: UPDATE with no policy is a silent 0-row
  no-op — REVOKE the privilege when you want a loud denial.
- A custom GUC's reset value after a transaction-local set_config is `''`
  (not "unset") on that connection — still fail-closed (matches no tenant),
  but tests must expect empty results, not errors, on reused connections.
- Nest without emitDecoratorMetadata (for vitest/esbuild): explicit
  `@Inject`, explicit `@ApiProperty({type})`, zod pipes instead of
  class-validator.
- Drizzle wraps pg errors; assert on `error.cause` chains.

## Open / for the reviewer
- All 7 items await independent verification (review-workflow).
- Live browser drive of the demo in service mode was NOT done headlessly
  this session (unit/e2e coverage instead); a reviewer live pass of
  save → reload via /v1 with the seeded key would close the loop visually.
- Server-side contract-level validation (validateSpec with registered
  data_contracts at the API) is a flagged follow-up; the service asserts
  shape (parseSpec) and trusts the client-side save gate for contract
  semantics today.

Relates to [[2026-07-17 — Phase 4 implementer kickoff]], [[Architecture Decisions]].
