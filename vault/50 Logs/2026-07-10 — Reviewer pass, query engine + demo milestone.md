---
tags: [log]
created: 2026-07-10
---

# 2026-07-10 (pt2) — Reviewer pass: query engine, demo milestone, drift doc

**Role:** reviewer ([[Review Workflow]])

## Verified → Done

- **#67 (f6311b7)** — non-retroactive policy tightening documented in
  buildDriftMap + regression test. Right call (don't hide end-users' blocks
  because an admin lowered a cap); admin signal → Phase 4.
- **#18 demo milestone (93e556a)** — demo consumes the REAL packages
  (@workspace-engine/react + core) via the actual 3-step surface
  (WorkspaceProvider + defineBlock×4 + defineEntity), 3 hand-written JSON specs
  → parseSpec → live render, zero LLM. Genuine dogfooding. 4 render tests +
  Playwright e2e. **Phase 2 read-path arc complete: JSON → live screen.**

## #38 query engine — verified WITH one P2

The adoption-thesis piece (vendor returns rows, engine does the rest). Probe
confirmed 13 behaviors incl. inclusive `between`, exclusive `after`, grouped
sum, count+avg, empty-aggregate → zeros (Infinity guarded), input never
mutated, row cap on input, all-server bypass. Careful work.

**[review][P2] filed: sort corrupts on null/undefined.** `sortRows` comparator
`(l<r)?-1:1` never returns 0 → inconsistent when a field is undefined →
`[5,undefined,3]` asc returns unchanged (valid 3 and 5 come out reversed).
Real vendor rows have nullable fields; the OLD demo returned 0 on incomparable,
new engine regressed it. 162 tests never covered null-in-sort. Fix: null-aware
comparator, nulls-last, return 0 on incomparable.

P3 noted on the card: `limit` silently ignored for groups/aggregate shapes —
spec §5 undefined for grouped output; clarify then implement.

## Pattern

Third bug class the suite structurally missed (after overlap seam, CJS
artifact): **a happy-path-only test set is blind to degenerate data**. The
recurring reviewer edge is generating the ugly inputs (nulls, empties,
boundaries) the implementer's arbitraries don't.

Next: #17 done, read path done → remaining Phase 2 = #39 default blocks,
#40 devMode, #41 chaos suite, #42 CI gates, #43 type tests; #16-line still
awaits the private remote + key rotation user calls.
