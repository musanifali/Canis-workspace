---
tags: [log, demo-polish, reviewer]
created: 2026-07-16
---

# Reviewer pass 11 — Demo Polish epic signed off (7/7 PASS, 4 findings filed)

Independent review of the 🎨 Demo Polish epic (#82, #76–#81), per
[[Review Workflow]]. Nothing was taken on the implementer's word: rebuilt,
re-tested, recomputed the contrast math, and drove the live stack end-to-end
with my own Playwright script (not the implementer's).

## Verification performed

- **Build + tests**: `npm run build` clean (11 routes), **103 tests pass**
  (matches the claimed 98→103; 4 live-eval suites correctly skipped).
- **#82 foundation**: recomputed WCAG contrast myself — 17 token pairs
  (superset of the claimed 11), **all ≥4.51:1** (tightest: risk-medium on its
  tint, 4.51). Font vars verified on `<html>`; DESIGN.md has all 7 required
  sections; ticked the last open checklist item ("landing/shell/QA reference
  this foundation") after verifying it in code.
- **Live drive at 1440 (+768 landing)**: 27/28 assertions passed. Landing has
  zero scaffold copy, real title/favicon; shell nav on all four surfaces with
  correct `aria-current`; /create hero + domain placeholder + zero attach/MCP/
  mic affordances; **/chat regression-checked untouched** (template
  placeholder, toolbar, suggestions footer intact — the new props default
  correctly). Flagship prompt rendered a **live board (16 CASE ids)** against
  backend :8261; save → /saved reload with live data; fresh-storage /saved
  empty state → "Load demo examples" seeds exactly 3, re-click is a UI-level
  no-op, survives reload. /workspaces live (12 ids); /sandbox renders 24 SMP
  items (my one FAIL was my own assertion vocabulary — sandbox uses SMP-####,
  not CASE-####).
- **Refusal beat, 3 attempts**: two completed ~11s with a textbook grounded
  refusal (names "customer sentiment score" as absent, lists contract fields,
  offers 4 alternative groupings); **one stalled >4 min** in "Generating
  response" (deepseek latency variance) — which fed two findings below.
- **Scope boundary**: confirmed the entire epic touches only `demo/` — zero
  `@workspace-engine/*` edits; #80 commit is DESIGN.md + globals.css tokens
  only.

## Verdict

**All 7 cards PASS → moved to Done** with sign-off comments. Findings filed
as cards at the top of the Demo Polish list (none blocking):

- **#83 [review][P2]** — `record-walkthrough.mts` has no data assertion on
  beats 3/6/8 and logs "beat 6: refusal shown" unconditionally (`.catch(() =>
  {})`); its pending-testid wait doesn't match how a refusal actually presents.
  Under the stall I reproduced, it records a broken beat and exits 0 — the #74
  vacuous-green failure mode inside the artifact meant to prevent it.
- **#84 [review][P3]** — /sandbox is the only nav surface not speaking Canis
  (`sandbox/page.tsx:13`: "Workspace Engine — devMode sandbox … check the
  console").
- **#85 [review][P3]** — RUNBOOK has no stall-recovery play (verified gap;
  observed the stall live).
- **#86 [review][P3]** — /create thread rail keeps Tambo template chrome
  (green `+` vs. the epic's own green-is-risk rule; "Tambo Conversations" at
  `thread-history.tsx:190`). Implementer had flagged it in their log; now
  tracked as a card.

## Notes for next session

- Epic is presentation-ready; the four `[review]` cards top the Demo Polish
  list and gate nothing except walkthrough re-recording hygiene.
- **#74 (vacuous-pass fix) and #32 (threat model) still sit In Progress
  awaiting their own reviewer sign-off** — deliberately out of this session's
  scope; they gate Phase 4 kickoff.
- Block-source residuals (Table hyphen wrap, KpiCards dead space, unseparated
  6-figure numbers) remain un-carded product work.
- Reviewer screenshots kept in the session scratchpad only; the committed
  `wt-*.png` set was re-verified as evidence of record.

Relates to [[2026-07-14 — Demo Polish epic — all 7 tickets implemented]],
[[Review Workflow]].
