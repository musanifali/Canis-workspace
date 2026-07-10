---
tags: [log]
created: 2026-07-10
---

# 2026-07-10 — Phase 2 complete: query engine, default blocks, devMode, gates

**Session**: implementer · **Phase**: 2 (Renderer & SDK) — **COMPLETE**
**Tickets**: #38, #41, #42, #39, #40, #43 (+ reviews #66/#67/#68) · [[Review Workflow]]

## Done

- **#38 in-memory query engine** — `executeQuery` (pure: filter/sort/group/
  aggregate, output per bindingShape); `execution: client|server` per
  capability; `maxClientRows` cap + RowCapExceededError; 100k rows <500ms.
  `compileToExecutor` runs it after fetch → vendor "just returns rows". Demo
  contract dropped its ~120-line executor. Commit `c3581d3`.
- **[review][P2] #68** — `sortRows` never returned 0 → a null/undefined sort
  field made the comparator self-contradictory and V8 corrupted the ordering of
  the *valid* values too. Null-aware comparator (nulls last, both dirs). Commit
  `129c7ce`.
- **#41 chaos suite** — 9 hostile-fetch scenarios (500/timeout/garbage/malformed/
  null-in-sort/100k-over-cap/100k-raised/50-block/no-waterfall). Injected fetch
  functions (ADR-4 seam), not MSW. `executeQuery` guards non-array responses.
  Commit `48697d2`.
- **#42 CI quality gates** — size-limit (full 32KB < 40KB budget, documented in
  README), tree-shaking guard (resolver-only 705B proves react-query+zod drop),
  SSR+hydration smoke test. Wired into CI. Commit `f793528`.
- **#39 default block set** — new `@workspace-engine/ui`: six themeable a11y
  blocks (Table/KpiCards/Queue/Board/Graph/FilterBar) via `--we-*` tokens,
  native controls only. FilterBar runtime bus in react (merges filters into
  target queries, never mutates the spec). THE test: demo deleted its
  ~130-line blocks.tsx, kit = `blocks = defaultBlocks`; specs/snapshots/e2e
  still green. Swap-path doc in the ui README. Commit `189af2d`.
- **#40 devMode sandbox** — WorkspaceProvider `devMode` (optional
  apiKey/contracts/blocks + console next-step banner); ui bundles a
  self-contained sample contract + 24 seeded rows + sampleSpec; `<WorkspaceSandbox/>`
  is the zero-config live screen. Demo `/sandbox` route. Commit `b1c8982`.
- **#43 type-level tests** — `define-entity.test-d.ts` (vitest --typecheck):
  `@ts-expect-error` proves a typo in filterable/sortable/groupable/aggregations/
  fieldKinds is a compile error; CI matrix TS 5.6–5.9. Commit `256aa9b`.

## State

- **Phase 2 FEATURE-COMPLETE.** Packages: core, react, **ui** (new). Tests:
  core 117 + 7 type, react 61, ui 9, demo 4 + Playwright 1. Root turbo pipeline
  12/12; size gate 32KB; all packages load require()+import(); CI green on the
  remote including the TS-version matrix.
- The product stands up end to end: JSON spec → live, data-backed,
  degradation-hardened screen; vendor integrates by returning rows; day-1 zero
  component work (ui defaults); `<WorkspaceSandbox/>` = live screen, zero
  contracts.

## Found / decided

- **Git push fix** (see [[phase2-renderer-sdk]] memory): keychain handed back a
  no-write account; fixed with a REPO-LOCAL credential helper minting the owner
  account's token via `gh auth token --user`. Global config untouched.
- Query engine surfaced 3 self-caught/reviewer-caught edges (null-sort #68,
  non-array guard, malformed rows) — the "generate ugly inputs" reviewer
  heuristic keeps paying; the chaos suite (#41) now homes them permanently.
- Kept react's prod bundle lean: the devMode sample lives in ui, not react.

## Open / next

- **User**: rotate the four exposed keys (hygiene).
- **Next: Phase 3 (Generation Pipeline)** — LLM emits WorkspaceSpecs, the
  validator gates, the devMode sandbox is the zero-contract on-ramp. Awaiting
  reviewer sweep of #38–#43 (all in In Progress).
