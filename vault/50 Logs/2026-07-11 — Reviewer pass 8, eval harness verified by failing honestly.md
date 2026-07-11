---
tags: [log, phase3]
created: 2026-07-11
---

# 2026-07-11 (pt2) — Reviewer pass: #71 + #22; the harness earns trust by failing

**Role:** reviewer ([[Review Workflow]])

## Verified → Done

- **#71 drift test (9354888)** — registry types ⊆ enum, config keys ⊆ union,
  core-valid fixture parses; green. Snapshot date-pinning fix correct.
- **#22 eval harness (e61c2c4)** — framework verified BY FAILING HONESTLY.
  My independent adversarial 6-case subset (weak prompt types + refuse/
  clarify/injection): harness drove, classified, asserted, computed, and
  correctly FAILED the run — valid-spec 33%, false-build 50%. The DSL
  (structural, single-block query cohesion), metrics (principled
  rate/badRate empty-denominator split), thresholds (false-build = 0
  non-negotiable), trend dashboard, and runner all behaved exactly as
  designed. Re-scope signed off: ≥100 corpus is volume → moved to the new
  quality card. Demo suite 47/1-skip green.

## Filed → [review][P2] generation quality (the tuning-loop card)

My subset quantified what the implementer flagged: **p0-03 (KpiCards) and
p0-04 (CaseQueue) no_build; rj-02 FALSE-BUILT** ("group by assigned lawyer"
→ built a substitute — intent-substitution, worst class). Plus a product
rule to settle: refuse-then-build-what-you-can (good for partial asks) vs
strict no-build (required when the CORE intent is the missing field) — the
prompt and dataset must encode one consistent rule. Plus: trend rows don't
record subset identity — a smoke run and an adversarial run look comparable
on trend.md. All on the card.

## Notes

- My failing subset rows are committed to trend.jsonl deliberately — honest
  history; the labeling fix makes future rows comparable.
- The flagship being 100% while neighbors sit at 33% is the strongest
  argument yet for the corpus: single-prompt confidence is not pipeline
  confidence.

## State

Phase 3 main line (#19→#22) is done and verified. The work now shifts from
building the loop to *driving the numbers*: the new P2 quality card is the
active front. Then #23 clarify/reject UX (which the rj-02 finding feeds
directly), #44–#47, #32.
