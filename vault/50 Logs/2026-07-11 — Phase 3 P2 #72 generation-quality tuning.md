---
tags: [log, phase3, implementer]
created: 2026-07-11
---

# Phase 3 [review][P2] #72 — generation-quality tuning (implementer)

Cleared the active P2 gate the reviewer filed from the #22 verification run
(their adversarial 6-case subset failed at valid 33% / false-build 50%, correctly).
3/5 criteria done with measured evidence; commit `755f35c`, In Progress. All `demo/`.

## Method

Added `window.__weLastGate` (status + error codes/paths + raw spec) to
GeneratedWorkspace so the headless harness can capture WHY a prompt no-builds,
not just that it did. Then: capture failing spec → identify the grammar/behavior
class → one prompt rule → rebuild → re-measure (2 runs/prompt). Prompt walked
v2026-07-10.7 → v2026-07-11.5.

## Fixes (each measured)

- **p0-03 "overdue KPI" 0/2 → 2/2** — the failing spec used a bare date string
  `"2026-07-11"`; a date value must be `{"abs":"YYYY-MM-DD"}` or `{"rel":token}`.
  Also `count` is field-less; a KpiCards binding is aggregate-only (no groupBy/
  sort); frame sizes must fit each block's bounds.
- **p0-04 "what should I work on today?" 0/2 → 2/2** — it was over-building a
  FilterBar/board that failed (FrameSize, then FilterTarget). Rule: for a broad/
  vague ask, prefer 1–2 simple blocks over an elaborate dashboard — every extra
  block is another chance to fail validation.
- **rj-02 "group by assigned lawyer" FALSE-BUILD → clean refusal** — the
  intent-substitution rule: when the CORE of a request needs a missing field,
  REFUSE and offer the nearest supported field as a *suggestion*, never silently
  substitute. Live: *"the cases don't have a 'lawyer' field… group by analyst
  instead?"*. Prompt + dataset reject-section now state the same rule.
- **Trend subset labeling** — `subsetLabel` → `full(N)` / `ids:… (k/N)` + a
  dashboard column, so a smoke and a full run aren't confused (the reviewer's
  33%/50% row and the fixed v.5 100%/0% row are now distinct). + tests.

## Verified

Eval runner at v2026-07-11.5, subset p0-01/p0-03/p0-04/rj-02/ad-01 (the exact
prompt types + intent-sub case the reviewer's run failed): valid-spec 100%,
false-build 0%, PASS — recorded to `eval/trend.md`. Demo 49 pass / 1 skipped,
tsc + lint clean.

## Open (the ongoing loop, not blocking these fixes)

- Corpus 29 → ≥100 (well-formedness test already keeps it honest; mechanical).
- Full-corpus gate run (~2h live). The per-class fixes here should generalize,
  but the corpus-wide number is unmeasured until that run.

## Lesson

The tuning loop is real whack-a-mole: each fix reveals the next class (bare-date →
count-field → aggregate-shape → frame-size → over-building). But they're all
*systematic* grammar rules that generalize across the corpus, and the harness +
`__weLastGate` make each one a ~4-minute capture-fix-measure cycle.

## Next

- **#23 clarify/reject UX** — validator verdicts as product surfaces; designed
  with the rj-02 refuse-vs-substitute finding in hand.

Relates to [[trello-workspace-engine-board]], [[Review Workflow]].
