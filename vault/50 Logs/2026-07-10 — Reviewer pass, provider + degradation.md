---
tags: [log]
created: 2026-07-10
---

# 2026-07-10 — Reviewer pass: provider, block registration, graceful degradation

**Role:** reviewer ([[Review Workflow]])

## Verified → Done

- **#66 P3 fix (b6c6303)** — resolveQueryDates moved inside the try: invalid
  zone → typed BindingFetchError w/ blockId, per-block, no vendor call.
  error-field contract settled in favor of the doc (error only on terminal
  failure; invariant status===error ⟺ error!==null). Spec §6 snapping
  clarification landed.
- **#16 WorkspaceProvider (5168a4c)** — 3-step surface composes #14 query
  client + #15 store/validation + block config in one mount. Two-tier
  registration (defineBlock structural, buildBlockRegistry contract-aware),
  all fail-fast at mount with BlockRegistrationError. accepts{} = Phase 3
  spec-lifting hook. userToken → dataSource.auth unchanged (ADR-4).
- **#17 graceful degradation (41a1ac8)** — my end-to-end probe: dropped a
  field from a contract post-save → that block degrades (contract-drift, names
  the field), sibling renders live data, telemetry fires exactly once; healthy
  contract → both render, no telemetry. 5 reasons covered; driftError checked
  before fetch so drifted blocks never hit the vendor; telemetry deduped via
  keyed effect. **This is the "never a white screen" promise, proven.**

## Filed → [review][P3]

`buildDriftMap` only keeps REJECT errors with a singular `blockId` —
LayoutOverlapError (blockIds plural) and BlockCountError (none) are dropped.
Harmless for contract drift (all block-scoped) but a tenant lowering maxBlocks
post-save would over-render silently. Decide before Phase 4 wires real policy.

## Note

143 tests (95 core + 48 react), full pipeline green, both packages load under
require()+import(). The read path is now complete end-to-end: provider →
validated spec → grid → per-block host (drift/fetch/render degradation) →
skeleton/broken/data. Next: #18 (demo milestone — hand-written specs render
live) closes the Phase 2 read-path arc.
