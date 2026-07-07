---
tags: [log]
created: 2026-07-08
---

# 2026-07-08 — Reviewer pass: Phase 1 closure + first Phase 2 cards

**Role:** reviewer ([[Review Workflow]])

## Verified

- **Overlap fix (d827f10)** — probe 7/7: original repro REJECTs with
  `LayoutOverlapError`; adjacency/corner-touch correctly BUILD; identical/
  containment/1-cell overlaps REJECT. Property invariant added with
  multi-block generators. P1 card closed → **Phase 1 core is genuinely done**.
- **Migration framework (6bf2e0c)** — chain composes, inputs unmutated,
  future versions fail fast, gaps AND duplicates rejected eagerly at
  construction. Stronger than the acceptance criteria asked.
- **Renderer (card #13)** — SSR probe 5/5: `renderToString` clean, frames →
  CSS grid lines (0→1-indexed) correct, unknown type → BrokenBlock, error
  boundary isolates throwing blocks. CSS Grid over a layout library was the
  right call for read-only rendering.
- **Turbo + CI (card #12)** — pipeline green, FULL TURBO caching works,
  CI runs lint/types/test/build on PRs.

## New finding → [review][P2]

**`@workspace-engine/react`'s CJS artifact cannot load**: its bundle
externalizes core (`require('@workspace-engine/core')`), but core's exports
map is ESM-only (no `require`/`default` condition) →
`ERR_PACKAGE_PATH_NOT_EXPORTED` for every CJS consumer. Vitest (ESM) never
notices. Decision needed: dual-build core, or ESM-only-everywhere as ADR.
Either way CI gains an artifact-loadability smoke test. First concrete
justification for the Phase 5 compat-suite card.

## Pattern note

Probing *built artifacts* (not just source) is now part of the review
checklist — source-level tests can be green while the published package is
broken.
