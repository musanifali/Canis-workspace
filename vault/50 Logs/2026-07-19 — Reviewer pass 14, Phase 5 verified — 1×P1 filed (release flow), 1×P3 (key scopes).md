---
tags: [log, reviewer, phase5]
created: 2026-07-19
---

# Reviewer pass 14 — Phase 5 Platform & DX

Reviewed all 10 Phase 5 cards (#87, #29, #49, #31, #53, #33, #30, #50, #51,
#52). **9 of 10 verified. #33 fails on its central claim** — the release
workflow has never successfully run. One P1 + one P3 filed.

## Baseline
First `turbo build check-types test lint` came back 54/54 **all cached** —
verifies nothing. Forced re-run: `turbo test --force` → **19/19 tasks, 0
cached, green** (dedicated PG :5443 up).

## #87 — server-computed verdicts (VERIFIED)
Code: `gateSpec` loads RLS-scoped `data_contracts` → `reviveContract` → the
same `validateSpec` as the render path, inside the write tx; update
authorizes before gating (no spec-validity oracle); refusals audited in own
tx after rollback. Live probes (fresh key via seed): valid spec → 201;
out-of-contract field `ssn` → 422 `ContractViolationError/unknown_field` with
allowed-list; unknown entity → 422 `UnknownEntityError`; **smuggled
`verdict` key in body → strict-schema 400** (DTO has no verdict field at
all); refusals in `/v1/audit?action=workspace.spec_rejected` with structured
errors; nothing persisted on refusal. `reviveContract` fetch throws
(validation-only, ADR-4). security-review.md §4/§6 updated accurately.

## #29 / #49 — contracts diff + lint (VERIFIED)
End-to-end against the LIVE service: saved a riskScore-dependent workspace,
authored old/new contract modules with riskScore removed → `canis contracts
diff --old --new` (service mode) printed the contract delta, **"BREAKING —
this change breaks 1 of 2 saved workspace(s)"**, named the workspace,
BUILD→REJECT with per-block errors, **exit 1**; compatible workspace not
flagged. Lint: undescribed contract → 12 warnings exit 0 (warnings don't
gate). `--probe` with a contract declaring `execution:{sort:"server",
filter:"server"}` over a fetch that ignores both → **2 error findings
(server_sort_unimplemented, server_filter_unimplemented), exit 1**.

## #31 / #53 — dashboard + dogfooding (VERIFIED)
Posture change on /v1/contracts **accepted**: revive-gate + name↔path pin
verified in controller; contract.registered/updated/removed audit writes
verified in ops layer; RLS-scoped; widening a contract grants no data access
(fetch stays vendor-side, ADR-4). Registry exercised live via dashboard seed
(3 contracts through /v1, 2 deliberate 422s audit-logged). Dashboard consumes
public entry points only (`client`/`core`/`react`/`ui`); GET-only proxy
verified live (whitelist 404, POST 405, key+user pinned server-side, no
NEXT_PUBLIC anywhere). **Renderer browser-driven** (the residual from passes
13/14-implementer): Playwright at 1440 — home lists 3 views; Audit-activity
workspace mounts with real data (19 audit events KPI, events-by-action bars,
recent-activity table incl. `workspace.spec_rejected`); rejections view
surfaces the seeded refused `invoice` entity; /contracts SSR lists all 3
entities; no BrokenBlocks. Screenshots in session scratch. 6/6 assertions
pass. **Residual → P3 filed:** the tenant key is single-scope (same key
saves workspaces AND mutates contracts; demo ships its key NEXT_PUBLIC).

## #33 — release engineering (FAILED — P1 filed)
Policy doc + fixed-group config + workflow shape are sound, and the semver
gate half is real. But **`@changesets/cli` is not a devDependency anywhere**:
`npx changeset version` → "could not determine executable to run", locally
and in CI. **GitHub Release runs 29659556424 and 29659608237 (the only two
with a pending changeset) both FAILED** at "Version packages and tag" AND
"Stamp snapshot versions" — every earlier green Release run had zero pending
changesets, so version/canary steps were skipped (trivially green). v0.2.0
cannot be cut until fixed. Also: implementer log says "two changesets
pending" — only one exists (`canis-optin-telemetry.md`; minor on the fixed
group still yields v0.2.0, so the tag claim survives). Card stays In
Progress; **[review][P1] filed**.

## #51 — compat suite (VERIFIED)
`api-surface --check` clean (6 packages, 125 exports). Adversarial: removed
`serializeContract` from core's index, rebuilt → check names the removal,
**exit 1**; restored → exit 0. No-baseline case exits 0 **with an explicit
bootstrap notice** (not a vacuous pass). Full machinery exercised via
temporary local tag v0.0.1 (deleted after): worktree → 6 tarballs → dep
rewrite → install → tsc + tests → **4/4 examples OK**. CI + release.yml
wiring confirmed (gate runs before tagging).

## #30 / #50 — docs + examples (VERIFIED)
Docs live on :3003: /, /quickstart, /reference/{api,errors,spec-v1,
release-policy,telemetry}, /guides/{adapters,nextjs,vendor-ci} all 200 with
real content. content-sync test green in forced run (quickstart page ==
examples/quickstart files). Cold quickstart path exercised by the compat
run (tarball install + tsc + gate test). Examples 4/4 via compat suite.
Nit: /guides has no index (404) — child pages fine.

## #52 — telemetry (VERIFIED)
Reporter is `NOOP_TELEMETRY` unless `enabled && endpoint` — no config, no
network (code-verified). Live: off-enum event → 400 echoing the pinned
5-event enum; valid → 202; `telemetry_events` has **no tenant/user columns**
(id, event, props, sdk_version, created_at only); UPDATE as service role →
0 rows; summary endpoint returns aggregates only. Nits (comment-level):
`props` is unbounded `z.record(z.unknown())` — consider a size/key cap;
telemetry table lacks the loud REVOKE treatment the versions table has.

## Verdicts
- **→ Done:** #87, #29, #49, #31, #53, #30, #50, #51, #52 (+ Phase 4's
  #24/#25/#26/#27/#28/#48, verified pass 13, found parked back In Progress).
- **Stays In Progress:** #33 (P1).
- **Filed:** [review][P1] release flow broken (@changesets/cli missing);
  [review][P3] single-scope tenant key (scope split before pilots).
- Board writes pending user approval this session (bulk-move denied by
  permission policy; MCP token stale — REST script ready).

Relates to [[2026-07-18 — Phase 5 implementer kickoff]], [[Review Workflow]],
[[2026-07-19 — Implementer, Phase 5 complete — Track B (#33 #30 #50 #51 #52) + #49 gaps]].
