---
tags: [log]
created: 2026-07-09
---

# 2026-07-09 — Phase 2 kickoff: scaffold, renderer, data layer, hooks

**Session**: implementer · **Phase**: 2 (Renderer & SDK)
**Tickets**: #12, #13, #14, #15, [review][P2] #65 · [[Review Workflow]]

## Done

- **Card #12 (vbXSLiAU) — monorepo scaffold.** Turborepo pipeline
  (lint/check-types/test/build), shared `tsconfig.base.json`, flat ESLint
  config, `.github/workflows/ci.yml`, and `packages/react`
  (`@workspace-engine/react`) built with tsup: dual CJS/ESM + `.d.ts`/`.d.cts`,
  React 18‖19 sole peer (no react-dom), SSR-safe. Commit `0485704`. Stays In
  Progress: the "CI green" box waits on a real GitHub remote (still the open
  Phase 1 decision).
- **Card #13 (J3IEt8JZ) — deterministic renderer.** `WorkspaceRenderer` /
  `WorkspaceGrid` map a validated spec onto CSS Grid (12-col, frame→grid-line,
  no layout lib). Consumer-supplied `BlockComponentRegistry`; unknown type OR a
  throwing component degrades to a `BrokenBlock` via a per-block error boundary
  while siblings survive. Headless (concrete block UIs = #39). Commit `c0c40bb`.
- **[review][P2] #65 (1OsN5VGh) — react CJS artifact was dead on arrival.**
  Reviewer caught it: react's CJS `require('@workspace-engine/core')` threw
  `ERR_PACKAGE_PATH_NOT_EXPORTED` because core was ESM-only. Reproduced, then
  **dual-built core with tsup** (added `require` condition + `.d.cts`) — chose
  dual over ESM-only to protect the drop-in adoption thesis; #12 already
  promised dual. Added `scripts/smoke-artifacts.mjs` (loads every entry through
  both `require()` and `import()`), wired into CI + `npm run verify:artifacts`.
  The gap existed because vitest only runs ESM. Commit `a04d440`.
- **Card #14 (90D2JFZK) — query executor + React Query.** `resolveQueryDates`
  (pure, tz-aware) rewrites symbolic tokens (`{rel:"this_month"}`) to absolute
  dates *inside the queryFn* → resolves at fetch time, proven
  save-time-independent. `useBlockQuery` runs core's `compileToExecutor`
  (validate → bound → vendor fetch with end-user auth) through an **internal**
  QueryClient (`WorkspaceQueryClientProvider`, never collides with the host).
  Workspace-level refresh → interval/manual. Failures → `BindingFetchError`
  per block; loading → shaped `BlockSkeleton` (never a spinner). Commit
  `76dc146`.
- **Card #15 (i5WVURcu) — headless hooks.** `WorkspaceStore` port
  (list/get/create/update/remove) + in-memory impl + `createBlankSpec`;
  `useWorkspaceList` / `useWorkspace` (load+refetch) / `useWorkspaceEditor`
  (reducer draft, typed mutations, dirty/reset, `validate()` via core, `save()`
  → persist → invalidate caches). No styling imports. SSR test runs in the Node
  environment. Commit `dc3e789`.

## State

- **`packages/react` is the read path end-to-end**: spec → grid → per-block
  fetch (auth passthrough, query-time dates) → skeleton/broken/data, plus a
  headless list/load/edit API over a swappable store.
- 53 tests (32 react + 21 core), full turbo pipeline green, both packages load
  under `require()` + `import()`. Per-ticket commits on `main`.
- #12/#14/#15 sit in **In Progress** awaiting the reviewer; #13 + #65 in Done.

## Found / decided

- **Self-caught OOM in #15** — the editor reseeded from `initialSpec` by
  *identity*, so a consumer passing a freshly-built spec each render (the common
  case) infinite-looped. Fixed with a value-compare guard + regression test.
  Exactly the class of bug the independent reviewer exists to catch — worth a
  second look.
- **`moduleResolution: Bundler`** for `packages/react` (tsup/esbuild-built),
  vs core's `NodeNext`. Added a jsdom + Testing Library harness for the
  React-heavy cards ahead.
- **Two judgment calls flagged on cards** for reviewer/user sign-off: date
  resolver lives in `react` (needs runtime clock + viewer tz) not core, though
  it's pure and movable; `refresh` implemented workspace-level per frozen spec
  v1 (card desc said "per-block").
- No ADR file for the dual-build decision — repo has no `devdocs/adr/`
  convention yet; captured in card #65 + commit body. Offered to start an ADR
  log.

## Open

- **Reviewer**: verify #14 + #15 before #16 composes them (WorkspaceProvider
  wraps #14's query client + #15's store provider). Re-check the #15 editor
  reseed guard.
- **User**: private GitHub remote yes/no (unblocks "CI green" on #12/#42); key
  rotation (Trello/OpenRouter/Gemini/DeepSeek).
- **Next cards**: #16 provider/registration, #17 graceful degradation, #18 demo
  milestone, then #38–#43 (query engine, default blocks, devMode, chaos suite,
  CI gates, type tests).
