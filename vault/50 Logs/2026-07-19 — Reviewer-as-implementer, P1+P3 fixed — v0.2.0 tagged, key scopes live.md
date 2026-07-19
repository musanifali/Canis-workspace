---
tags: [log, implementer, reviewer, phase5]
created: 2026-07-19
---

# P1 + P3 fixed (reviewer session, on user instruction)

User asked the reviewer session to implement the two cards pass 14 filed.
Role deviation noted on both cards.

## P1 — release flow (Done)

- `@changesets/cli@2.31.1` pinned at root (a2b4568); `changeset status`
  plans the fixed-group minor.
- Release run **29670772098 GREEN**: version+tag job, canary tarballs,
  `chore(release): v0.2.0` pushed (e6394e5), changesets consumed.
- **Second latent bug found during verification:** `git tag` (lightweight) +
  `git push --follow-tags` silently drops the tag — remote had ZERO tags
  after a green run. Fixed in release.yml (annotated tag + explicit ref
  push, ba7e8fd); **v0.2.0 re-cut manually on e6394e5** and verified on the
  remote. The compat suite (#51) now has its first real baseline.

## P3 — API key scopes (Done)

Commit ba7e8fd:
- `api_keys.scope` — `'runtime' | 'admin'`, migration 0008; pre-scope keys
  default admin (nothing existing breaks; e2e asserts it).
- `TenantGuard` resolves scope + enforces `@RequireScope` metadata (explicit
  `@Inject(Reflector)` — the no-emitDecoratorMetadata gotcha again).
  Admin-only: contracts registry (controller), /v1/audit (controller),
  /v1/usage/summary, /v1/telemetry/summary. Runtime keeps: workspaces,
  telemetry ingest, usage allowance/generation. Refusal = 403
  `insufficient_key_scope`.
- Seeds: demo mints **runtime** (its key ships in NEXT_PUBLIC — can no
  longer touch the registry), dashboard mints **admin** (server-side only).
- Verification: 9-case `key-scopes.e2e.test.ts`; all 8 route/scope
  combinations probed live (401→201/202/200 runtime paths, 403×4 admin
  surfaces, legacy key still admin); full turbo 54/54 (one flaky api#test
  fail traced to my own live probe server running during the suite — green
  on clean re-run); docs reference gains "API key scopes".

## Board

P1 (dgqQufju), P3 (7w09R4gY), and #33 → Done with evidence comments — #33's
acceptance ("release flow works") is now demonstrated by a real green run +
remote tag, not asserted.

## Phase 5: fully closed

All 10 cards + both review findings Done. First release **v0.2.0** exists.
Remaining open review debt anywhere: Demo Polish #83–#86 (presentation
track). Next: launch track (deploy, onboarding/auth, npm publish decision).

Relates to [[2026-07-19 — Reviewer pass 14, Phase 5 verified — 1×P1 filed (release flow), 1×P3 (key scopes)]].
