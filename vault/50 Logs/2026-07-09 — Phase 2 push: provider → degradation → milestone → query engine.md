---
tags: [log]
created: 2026-07-09
---

# 2026-07-09 — Phase 2 push: provider → degradation → milestone → query engine

**Session**: implementer · **Phase**: 2 (Renderer & SDK)
**Tickets**: #66, #16, #17, #67, #18, #38 (+ #14/#15 sign-off, remote/CI) · [[Review Workflow]]
**Continues**: `2026-07-09 — Phase 2 kickoff` (which covered #12–#15 + #65).

## Done

- **[review][P3] #66 (xGlaJ4iE)** — useBlockQuery: moved `resolveQueryDates`
  inside the queryFn try so an invalid pinned zone surfaces as a typed
  BindingFetchError (A4), not a raw RangeError; decided `BlockDataState.error`
  is terminal-only (`status==="error" ⇔ error!==null`), stale-refetch failure
  stays success/null (that signal is #17's). Spec §6 doc clarification: tokens
  resolve to a `[start,end]` range, single-sided ops anchor on/before→start,
  after→end. Commit `b6c6303`.
- **Card #16 (XC8MwQxR)** — WorkspaceProvider + block registration. `defineBlock`
  with `accepts{shape,entities}` validated at registration (BlockRegistrationError
  on shape mismatch / unknown type / unknown entity / dupes); provider composes
  query client + store + config so `<WorkspaceRenderer spec/>` needs no
  per-render props; typed error taxonomy barrel (`src/errors.ts`). Commit `5168a4c`.
- **Card #17 (kNh5aYTx)** — graceful degradation. Read-time contract-drift
  detection via `validateSpec` at the grid → a block referencing a dropped field
  (e.g. `sla_deadline`) degrades with the field named, before any fetch, healthy
  siblings render. Unified `onBlockDegraded` telemetry (unknown-type /
  missing-contract / contract-drift / fetch-error / render-error). Commit `41a1ac8`.
- **[review][P3] #67 (3CQ3pkSw)** — read-time drift map drops non-block-scoped
  REJECTs. Decided **option (b)**: policy tightening (lowered maxBlocks) is NOT
  enforced retroactively on a saved spec — render as authored, don't blank
  end-users for an admin's cap change; admin-facing signal deferred to Phase 4.
  Documented + regression test. Commit `f6311b7`.
- **Card #18 (XTp93PAT)** — MILESTONE: hand-written specs render live in the demo.
  Wired the SDK into the demo (file: deps); `case` contract + Tambo-free block
  adapters + 3 hand-authored specs + `/workspaces` page. `next build` compiles;
  vitest snapshots 4/4; **Playwright e2e passes** on the built app (port 3100).
  Commit `93e556a`.
- **Card #38 (YdaFwlGx)** — in-memory query engine. `executeQuery` (pure:
  filter/sort/group/aggregate, output shaped per bindingShape); `execution:
  client|server` per capability; `maxClientRows` cap + RowCapExceededError; 100k
  rows filter+group <500ms. `compileToExecutor` now runs it after fetch — the
  demo contract dropped its ~120-line executor for `fetch: () => ALL_CASES`.
  Commit `c3581d3`.

## State

- **Phase 2 core arc done**: spec → live screen, end-to-end, proven in the demo.
  Remaining: #39 default blocks, #40 devMode, #41 chaos suite, #42 CI gates,
  #43 type tests.
- **Trello**: #12–#15 + #65/#66/#67 in Done; #16/#17/#18/#38 in In Progress for
  the reviewer.
- Tests: core 113, react 49, demo 4 + Playwright 1; root turbo pipeline 8/8;
  both packages load require()+import().

## Found / decided

- **Remote wired + CI green** (was the parked Phase 1 decision): user gave
  `github.com/musanifali/Canis-workspace`; pushed `main`, GitHub Actions CI
  (lint·types·test·build·verify:artifacts) green → #12's last box checked, #12
  → Done. Key rotation still the user's open hygiene item.
- **Core robustness fix surfaced by the demo (#18)**: `defineEntity` used
  `instanceof z.ZodString`, which fails across zod copies — a vendor building
  their schema with THEIR zod (exactly the demo) hit ContractDefinitionError.
  Switched to zod's stable `_def.typeName` tag. Every real integration would
  have hit this. Reviewer should eyeball it.
- Also: file:-linked-package dual-React needs `resolve.dedupe` in the demo's
  vitest (Next dedupes react itself, so the build was fine).

## Open

- **Reviewer**: sweep #16/#17/#18/#38 — especially the core zod `_def.typeName`
  change and the executor now running the engine (behavior change, existing
  tests stayed green).
- **User**: rotate the four exposed keys (Trello/OpenRouter/Gemini/DeepSeek).
