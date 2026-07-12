---
tags: [log, phase3, implementer]
created: 2026-07-12
---

# Phase 3 #45 — vendor eval kit (implementer)

Built #45, the vendor-facing form of the #22 harness. Commit `4039208`, In Progress.

## What shipped (demo/src/eval/vendor/)

- **generate.ts** — `generateEvalCases(contracts)`: the novel piece. Enumerates
  each contract's declared capabilities (groupable / sortable / aggregatable /
  string-filterable fields) and emits NL prompts whose expected spec is DERIVED
  from the same capability — so the assertions are correct by construction, never
  hand-authored. "Show cases grouped by analyst" exists only because the contract
  says `analyst` is groupable, and it asserts exactly that groupBy. Plus
  out-of-contract reject probes (a missing field IS the ask).
- **report.ts** — `vendorReport(runs)`: reuses the #22 metrics engine so the
  vendor number and our gate are the same computation. Prints "X% valid, N
  correctly refused, 0 false-build → PASS/FAIL".
- **fixtures.ts** — `collectFailures`: replayable failure records (prompt +
  expected + outcome + the built spec), so a fix is checkable without re-driving
  the model.
- **run.eval.test.ts** + `npm run eval:vendor`: generates from the demo contract,
  drives each prompt, scores, writes `eval/vendor-fixtures.json` (gitignored),
  and exits non-zero on a threshold breach → drops into vendor CI. Real-clock +
  canary (the P1 #73 lesson, applied from the start this time).
- **drive.ts** — extracted the per-prompt headless drive/classify from #22's
  runner so both runners share ONE code path. Refactored live.eval.test.ts onto
  it (behaviour identical; #22's 55/1-skip still green).

## Verified LIVE

Full generated suite, 18 prompts against the case contract:
```
valid workspaces   93.3%  (14/15)
correctly refused  3/3   (out-of-contract asks)
false-build        0.0%  (0)   ← must be 0
parse failures     0.0%
✓ PASS — ready to ship
↳ 1 failing case dumped to eval/vendor-fixtures.json for replay
```
The one miss ("List all cases" no_build, transient) became a replayable fixture
with its prompt + expected assertion. 8 vendor-kit unit tests; demo 63 pass / 2
skipped; tsc + lint clean.

## Design note

Located in demo/src/eval (not a package): the card lists no "separate package"
criterion (unlike #44), and `generateEvalCases` is already contract-generic, so
it's the reusable core wherever it lives. Lifting the whole eval framework
(assert/metrics/generate/drive) into an `@workspace-engine/eval-kit` package is a
clean future refactor if we want vendors to `npm install` it.

## Next

- **#46 cold-start UX** — suggestion chips seeded from contracts (what's
  queryable) + role/template. The contract-capability enumeration from #45's
  generator is directly reusable for seeding chips.
- Then #47 red-team/drift, #32 threat model.

Relates to [[trello-workspace-engine-board]], [[Review Workflow]].
