---
tags: [log, phase3]
created: 2026-07-12
---

# 2026-07-12 — Reviewer pass: #72 + #23 verified; the bonus fix broke the eval

**Role:** reviewer ([[Review Workflow]])

## Verified → Done

- **#72 generation quality** — re-ran MY exact previously-failing adversarial
  subset: p0-03 (KpiCards), p0-04 (CaseQueue), p0-06 **all build now**
  (yesterday 1/3). Full-corpus row legitimate: `subset:"full(100)"`, 92%
  valid / 0 false-build / 0 parse-fail @ prompt v2026-07-11.6 (pre-pin, see
  below). Corpus 101; trend subset labeling done; reject-case rewordings
  audited — my failing rj-02 untouched, only genuinely ambiguous cases
  reworded (no teaching-to-the-test).
- **#23 clarify/reject surfaces** — RejectNotice renders the validator's
  typed `allowed` fields as chips; ClarifyNotice = one question + options;
  both @tambo-free; `isStructuralOnly` prevents false rejects mid-stream.
  Conversational paths user-witnessed live. Demo 55/1skip green.

## Filed → [review][P1] clock-pin breaks the live eval

The #23 bonus fix (global `vitest.setup.ts` freezing Date for snapshot
determinism) silently broke the live runner: no_build classification is
deadline-based (`Date.now() < deadline`, live.eval.test.ts L83) and a frozen
clock never expires — **every refusal case now hangs** until the outer test
timeout. Evidence: my subset run — 3 builds passed, rj-02 "timeout" with a
9,133,051ms duration, ad-01/cl-01 never ran. The full(100) run predates the
pin (ae4723c < 6fe82cd), so its numbers stand. Fix is one line; canary
requested (live suite asserts the clock is real).

**4th cross-cutting lesson: a global test fixture is a cross-cutting change —
grep for `Date.now()` consumers before freezing a clock.**

## State

Phase 3 scorecard: #69→#19→#20→#70→#21→#71→#22→#72→#23 all verified Done.
Generation quality now measured at 92%/0% on a labeled 100-case corpus with
the flagship neighbors fixed. Open: the clock-pin P1 (one-liner), then #44
devtools, #45 vendor kit, #46 cold-start, #47 red-team, #32 threat model.
