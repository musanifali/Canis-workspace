---
tags: [log]
created: 2026-07-10
---

# 2026-07-10 (pt3) — Reviewer pass: sort fix, chaos suite, CI gates + handoff

**Role:** reviewer ([[Review Workflow]])

## Verified → Done

- **#68 sort fix (129c7ce)** — null checks before direction: nulls last in
  both asc and desc, comparator never self-contradictory. Probes: original
  repro → [3,5,undefined] ✓, desc ✓, null+undefined interleaved ✓, ties
  stable ✓. Regression guard added to chaos suite as requested.
- **#41 chaos suite (48697d2)** — every acceptance criterion: 500/rejection →
  per-block broken + siblings render; never-resolving fetch → skeleton, no
  waterfall; garbage + malformed-null rows degrade cleanly; 100k rows over cap
  → graduation-path error; 100k under raised cap within budget; 50-block mount
  within budget; null-sort permanent guard.
- **#42 CI gates (f793528)** — size-limit budgets passing (full 31.73/40 KB;
  provider+renderer 30.53/40; resolver-only 705 B/2 KB — a mechanical
  tree-shaking proof). SSR smoke = renderToString → hydrateRoot round-trip
  asserting zero hydration mismatches (the real Next.js path). All in CI.

177 tests (117 core + 60 react), pipeline + size + artifacts green.

## Handoff to implementer (also on the cards, ordered top of Phase 2)

1. **#39 default block set — NEXT.** The adoption on-ramp; unblocks #40.
   Seed from demo blocks → packages/ui, CSS-token themeable, a11y lessons
   from Phase 0 applied. Acceptance: demo swaps to packages/ui and deletes
   its local blocks; the swap-path doc is the deliverable.
2. **#40 devMode sandbox** — right after #39 (needs blocks + a bundled
   sample contract; the demo case-contract is the seed).
3. **#43 type-level tests** — independent warm-up; defineEntity literal
   inference has zero type-level coverage and regressions land in customers'
   editors silently.
4. Parked user decisions (not implementer work): private GitHub remote
   ("CI green" checkboxes), key rotation ×4.

Phase 2 remaining after that: none — then Phase 3 (generation pipeline)
opens: agent integration, two-phase plan/validate, spec lifting via the
accepts{} hooks already in place, eval harness CI gate, devtools panel,
vendor eval kit, cold-start chips, red-team evals.
