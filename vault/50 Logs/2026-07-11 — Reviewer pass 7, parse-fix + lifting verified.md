---
tags: [log, phase3]
created: 2026-07-11
---

# 2026-07-11 — Reviewer pass: #70 parse-fix (15/15) + #21 lifting round-trip

**Role:** reviewer ([[Review Workflow]])

## Verified → Done

- **#70 parse-failure fix (bf8cc0c)** — independent **5/5 first-attempt**
  (zero dead turns, zero console errors, stable output) on top of the
  implementer's 10/10 → **15/15 since the fix vs 1/3 before**. Architecture
  pivot verified sound: spec streams as component props via incremental JSON
  Patch (no final JSON.parse to fail); structured explicit-key propsSchema
  constrains generation (measured 33→40→70→100% progression); grounding
  restored via contractContextHelper.
- **#21 spec lifting (b576a86)** — re-scope SIGNED OFF (props→spec reversal
  was for the abandoned per-block path; lift = snapshot → re-gate is correct
  and simpler; save-gate ≡ render-gate). LIVE round-trip verified: generate →
  Save → full reload of /saved → **live data** (13 case ids incl. the
  specific case from the original render — bindings re-fetched, not
  snapshot), 0 errors. localStorage store = clean Phase 4 port.

214 package tests + 26 demo tests green.

## Filed → [review][P3]

`specPropSchema` (the #70 fix's structured mirror) is untied to core: new
registry block types / config keys / spec versions would drift silently.
Consistency test specified on the card (registry ⊆ enum, config keys ⊆
union, core-valid fixture parses).

## Notes

- `stripSpecRoot` (root-key projection pre-gate): acceptable LLM-boundary
  repair — nested strictness intact, honestly documented, applied uniformly
  to render + save gates. Watch it never grows beyond the root.
- The 33→100% measured progression is the eval-driven loop working before
  #22 even exists — #22 formalizes it.

## State

Phase 3 core loop is now **reliable** end-to-end: sentence → streamed spec →
gate → deterministic render → save → reload with live data. Next: #22 eval
harness (headline metrics: first-attempt validity + parse-failure rate),
then #23 clarify/reject UX, #44–#47, #32 threat model.
