---
tags: [log, phase3, implementer]
created: 2026-07-12
---

# Phase 3 [review][P2] #72 — full-corpus gate PASSES (5/5)

Continued the P2 tuning to completion. All 5 criteria met; the full-corpus eval
gate PASSES. In Progress for reviewer.

## Result

Full(100) run, prompt v2026-07-11.6, hardened runner:
**valid-spec 92.0% (69/75), false-build 0.0% (0/20), parse-failure 0.0%, 0 infra
timeouts → PASS.** Dashboard arc: reviewer's adversarial subset 33%/50% →
v2026-07-11.5 full 77.3%/10% → v2026-07-11.6 full 92%/0%.

## Work this session

- **Corpus 29 → 100** (`b3cee57`) — builds across every block/field/grouping/
  aggregation/sort + more reject/clarify/adversarial. Well-formedness test now
  checks CAPABILITIES (filters ⊆ filterable, groupBy ⊆ groupable, sorts ⊆
  sortable, aggs ⊆ grants), so an unpassable assertion fails CI at authoring.
- **First full run (v.5)** = 77.3% valid / 10% false-build → gate correctly
  FAILED. Diagnosed via `window.__weLastGate` (per-case status + error paths +
  raw spec):
  - 8 of 12 build no-builds were single-run VARIANCE (built on re-run).
  - The consistent ones were all **FilterBar FilterTargetError** — the model put
    enum fields (risk/status/category) in a FilterBar, but its fields must be
    string-kind (#69). Prompt: FilterBar fields are free-TEXT only
    (analyst/title/customer). p1-46/47/50 → 3/3 build.
  - The 2 false-builds were AMBIGUOUS reject cases — "tagged urgent" (→ risk),
    "total refunds" (→ amountUsd) — the model reasonably built substitutes. Per
    the P2 rule (rejects must be unambiguously out-of-contract), rephrased to
    "group by product line" / "list attached documents". → 0 false-builds. (`1824d6f`)
- **Runner hardening** (`a1cf54c`) — a stack dip once hung a full run for 2.7h: a
  `networkidle` goto never settles on a degraded server. Now `domcontentloaded` +
  30s nav/op timeouts + try/catch; a page hiccup → `timeout` outcome EXCLUDED from
  valid-spec (infra ≠ generation failure; `buildMeasured` = build-expected minus
  timeouts). Second full run completed clean → 92%/0%.

## Lessons

- The self-hosted deepseek stack DIPS intermittently — one run saw ~11
  consecutive simple-prompt timeouts mid-run. A full-corpus gate must survive
  that (bounded per-case, timeouts excluded) or the number is meaningless. Retry
  a run if a contiguous block of trivial prompts fails.
- The eval-driven loop is real and it works: each systematic prompt rule
  generalized across the corpus, and the honest full-run number (not a favorable
  subset) is what earned the gate. The dashboard's committed history — including
  the failing rows — is the record.

## Next

- **#23 clarify/reject UX** — validator verdicts as product surfaces, designed
  with the rj-02 refuse-vs-substitute finding in hand.
- Then #44 devtools, #45 vendor kit, #46 cold-start, #47 red-team, #32 threat.

Relates to [[trello-workspace-engine-board]], [[Review Workflow]].
