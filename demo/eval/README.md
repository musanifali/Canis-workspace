# Generation eval harness (card #22)

Measures the sentence → WorkspaceSpec pipeline against a golden dataset and gates
on headline metrics. Framework code lives in `src/eval/`; run artifacts land here.

## Run

```bash
npm run build && npm run start -- -p 3100   # a fresh demo server (stale-bundle trap)
npm run eval                                 # EVAL_LIVE=1 vitest, drives every golden prompt
```

Requires the self-hosted Tambo stack (deepseek). Knobs:

- `EVAL_LIMIT=8` — only the first N prompts (quick smoke).
- `EVAL_IDS=p0-01,rj-01` — only these case ids.
- `EVAL_BASE=http://localhost:3100` — demo server URL.

## What it does

For each prompt it drives `/create` headlessly (tiptap technique), classifies the
outcome (`build` / `no_build` / `parse_failure`), and — for a build — asserts the
captured spec with the structural DSL (`src/eval/assert.ts`), never string
matching. Then it computes the metrics, writes `reports/last-report.json`, appends
to `trend.jsonl`, and regenerates `trend.md` (the committed dashboard).

## Metrics + CI gate (`src/eval/metrics.ts`)

- **valid-spec rate** — of build-expected prompts, how many built AND asserted.
- **false-build rate** — refuse-expected prompts that built anyway (the worst
  failure). Threshold **0**.
- **parse-failure rate** — hard dead turns (review P1 #70). Threshold ≤ 10%.
- **clarify rate** — under-determined prompts that didn't over-build (informational).

`npm run eval` exits non-zero if a threshold is breached. The DSL, metrics, and
dataset well-formedness are covered by ordinary unit tests (`src/eval/*.test.ts`)
that run in `npm test` — the live run is skipped there and gated behind `EVAL_LIVE`.

## Dataset (`src/eval/dataset.ts`)

Seeded from Phase 0's scored 20 (`phase0-quality-log.json`), re-expressed as spec
assertions, plus reject / clarify / adversarial cases. Grow it toward the ≥100
target by adding cases per category; the well-formedness test keeps assertions
honest (block types ⊆ registry, fields ⊆ contract).
