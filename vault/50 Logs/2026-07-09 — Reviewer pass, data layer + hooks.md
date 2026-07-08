---
tags: [log]
created: 2026-07-09
---

# 2026-07-09 — Reviewer pass: CJS fix, data layer, headless hooks

**Role:** reviewer ([[Review Workflow]])

## Verified → Done

- **#65 CJS fix (a04d440)** — core dual-built; my independent `require()`
  probe + their `smoke-artifacts.mjs` both pass; loadability now a CI gate.
- **#14 query executor (76dc146)** — date resolver survived 11/11 adversarial
  probes: cross-zone month boundary (UTC+14 vs UTC−8 same instant → different
  months, correctly), year rollover, Q4, leap Feb, Monday week-start from a
  Sunday, mixed [abs, rel+offset], negative offsets, Fake/Zone throws (no
  silent UTC fallback). Resolution inside queryFn ⇒ save-time-independent.
  Internal QueryClient never collides with host. 127/127 tests.
- **#15 headless hooks (dc3e789)** — reseed guard re-checked (value-compare +
  dirty protection, regression-tested both ways). Store port = clean Phase 4
  seam.

## Judgment calls signed off

1. Date resolver in `react` (not core): fine now; **move to core when card
   #38's in-memory query engine needs it** — it's already pure.
2. Workspace-level refresh: follows frozen spec §8 over the stale card text —
   correct precedence.

## Filed

- **[review][P3]**: `resolveQueryDates` sits outside `useBlockQuery`'s try —
  invalid zone rejects as raw RangeError, not the A4-mandated typed error
  (one-line fix); plus `BlockDataState.error` doc/code mismatch (field set
  even when stale data exists). Behavior degrades per-block either way.
- **Spec doc gap** (noted on #14 comment): §6 never defines single-sided-op
  snapping against period tokens (`before this_month` → start, `after` → end).
  Implementer's snapping is sensible — codify it in the doc as a
  clarification (no version bump).

## Pattern note

The implementer self-caught an infinite loop (#15 reseed) and flagged it for
re-review in the log — the workflow is generating the right instincts on both
sides.
