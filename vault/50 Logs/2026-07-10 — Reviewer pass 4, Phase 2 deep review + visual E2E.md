---
tags: [log]
created: 2026-07-10
---

# 2026-07-10 (pt4) — Deep review: Phase 2 completion + first visual E2E

**Role:** reviewer ([[Review Workflow]])

## Verified → Done (#39, #40, #43)

- **#39 default blocks (189af2d)** — the swap test passed for real: demo
  deleted its local blocks, `blocks = defaultBlocks`, everything green, and I
  **visually confirmed** live data on the ui blocks. a11y native controls,
  --we-* theming tested. Runtime filter bus cannot bypass contracts (probe:
  executor re-validates merged queries → loud typed rejection).
- **#40 devMode (b1c8982)** — `<WorkspaceSandbox/>` visually confirmed: 3-block
  live screen (KPIs/table/board, 24 seeded rows), zero config, zero network,
  zero console errors.
- **#43 type tests (256aa9b)** — 124 typecheck assertions, TS 5.6–5.9 matrix
  green on the remote. Remote itself now real (Canis-workspace), CI green.

187 runtime tests + type suite + size budgets + artifact smoke: all green.

## Filed → [review][P2] FilterBar kind-blind `contains`

Probe: `validateSpec` BUILDs a FilterBar with `fields:["risk"]` (enum,
filterable) — but the ui FilterBar emits `contains` unconditionally, and
`contains` is string-only → first keystroke degrades the target block.
Approved spec + normal user action = broken block. Fix: tighten Q2 rule
(filterable AND string-kind) now; kind-aware controls later. Safety net held:
no bypass, loud typed error.

## Ops lesson (in the same card): visual E2E caught a stale-server trap

First screenshots showed BOTH routes stuck on skeletons with 191 tests green —
client bundle 404'd (dev server predating packages/ui), page never hydrated,
SSR skeleton HTML looked "rendered" to weak assertions. Restarted server →
everything live. Lesson: **the demo e2e must assert visible data, not element
counts** (added to the P2 card). Fourth runtime-reality gap class: tests
green ≠ browser working.

## Phase 2 verdict

**COMPLETE** (pending the one P2). The product read path is real and visible:
`/workspaces` renders 3 hand-written specs with live KPIs/tables/boards;
`/sandbox` is the zero-config on-ramp. Screenshots: /tmp/review2-*.png
(session-local). Next: Phase 3 — generation.
