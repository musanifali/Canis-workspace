---
tags: [log, phase3, implementer]
created: 2026-07-11
---

# Phase 3 — #71 drift test + #22 eval harness (implementer)

Implementer session after the reviewer verified #70/#21. Cleared the P3 gate,
then built the eval harness. Both In Progress.

## #71 [review][P3] — specPropSchema drift test (commit `9354888`)

`spec-prop-schema.test.ts`: every DEFAULT_REGISTRY type ∈ `BLOCK_TYPES`, every
registry `configSchema` key ∈ the config union, every core-valid demo spec parses
under `specPropSchema`. Exposed `BLOCK_TYPES` + `configSchema` for the comparison.
Fails the moment the hand-mirror drifts from core.

Bonus: the render snapshots had gone red overnight — relative-date filters
("overdue"/"this month") resolve against the real clock, so they drift daily.
Pinned only `Date` (`vi.useFakeTimers({ toFake: ["Date"] })` + fixed system time,
timers stay real for `waitFor`) and regenerated. 29/29.

## #22 — generation eval harness (commit `e61c2c4`)

Framework in `demo/src/eval/` (unit-tested, CI-safe); live run gated behind
`EVAL_LIVE`.

- **assert.ts** — STRUCTURAL spec-assertion DSL: block types present + some single
  block's binding query matches (entity / filters / groupBy / aggregations / sort).
  Never string matching, so the model's legitimate variation passes.
- **dataset.ts** — golden corpus: Phase 0's scored 20 re-expressed as spec
  assertions + reject (out-of-contract) / clarify (under-determined) / adversarial
  (injection) cases (~30). Well-formedness test keeps it honest (types ⊆ registry,
  fields ⊆ contract). Structured to grow toward ≥100.
- **metrics.ts** — valid-spec / false-build / parse-failure / clarify rates +
  thresholds (valid ≥90%, **false-build = 0**, parse ≤10%; anchored to P1 #70).
- **report.ts** — writes a JSON report, appends `eval/trend.jsonl`, regenerates
  the committed `eval/trend.md` dashboard (diffs in PRs).
- **live.eval.test.ts** — `npm run eval` drives every golden prompt headlessly,
  classifies build/no_build/parse_failure, asserts, computes metrics, gates.
  `EVAL_LIMIT` / `EVAL_IDS` select subsets. GeneratedWorkspace exposes
  `window.__weLastSpec` for capture.

Verified live (mixed subset p0-01/p0-05/rj-01/ad-01, self-hosted stack): builds
asserted valid, reject + adversarial correctly refused (no_build → 0 false-builds),
thresholds **PASS**, dashboard baseline recorded. Demo 47 pass / 1 skipped.

### Gotchas

- The `rate(num, denom)` "empty = 1" convention is right for higher-is-better
  rates (valid-spec, clarify) but WRONG for lower-is-better (false-build, parse):
  0 refuse-cases made false-build read 100% and fail the gate. Added `badRate`
  (empty = 0) + a regression test. The live subset caught this.
- A normal `npm test` picks up `live.eval.test.ts` but `describe.skipIf(!EVAL_LIVE)`
  skips it; playwright is dynamic-imported inside the test so it isn't loaded.
- Real signal the harness surfaced: the flagship (GroupedBoard) builds 100%, but
  some KpiCards/CaseQueue prompts timed out / didn't build — the corpus-wide
  valid-spec rate is below the flagship's. That's the tuning loop's job now.

## Next

- **#23 clarify/reject UX** — validator verdicts as product surfaces (one
  question; explain what the data model doesn't support; never partial-render).
- Grow the eval corpus to ≥100 and wire `npm run eval` into a CI stage where the
  stack is available; then #44–#47, #32.

Relates to [[trello-workspace-engine-board]], [[Review Workflow]].
