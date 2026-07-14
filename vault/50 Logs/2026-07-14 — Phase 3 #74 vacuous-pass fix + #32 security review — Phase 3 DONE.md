---
tags: [log, phase3, security, eval]
created: 2026-07-14
---

# 2026-07-14 — #74 vacuous-pass fix + #32 threat model — Phase 3 complete

**Role:** implementer ([[Review Workflow]])

## Picked up

Reviewer's 2026-07-12 pass ([[2026-07-12 — Reviewer pass 10, Phase 3
hardening + security number verified]]) left exactly two things open: the
[review][P2] vacuous-pass finding (Trello `HYVbv9k5`), and #32 (`slHC3nkA`) —
now mostly a writing task since the reviewer had independently reproduced the
red-team headline number. Did the P2 fix first since #32 cites the live
red-team scan whose trustworthiness the P2 bug undermined.

## #74 — eval no longer vacuously passes on a dead stack (commit `c686f0b`)

`checkThresholds` (`demo/src/eval/metrics.ts`) now computes
`measured = total - infraTimeouts`; below a `minMeasuredFraction` (default
0.5) — or on an empty run — it returns a distinct `inconclusive: true`
verdict instead of relying on the "empty denominator → vacuously 1" rate
convention that let 0-measured runs read as 100%. Threaded through:

- `report.ts`'s `TrendEntry` now carries `inconclusive` (computed once in
  `recordRun`, not duplicated at call sites); the dashboard marks the row
  `**INCONCLUSIVE (infra down)**` instead of printing a false percentage.
- `drift-check.ts`'s `isFull` excludes inconclusive entries — a dead stack's
  `full(100)`-labeled attempt (every id was selected, none were measured)
  can never become a drift baseline. Also: if the ONLY full-corpus attempt
  on file is inconclusive, `detectDrift` now returns `regressed: true`
  rather than the old "no full-corpus run yet" pass-through — so a
  standalone `eval:drift` invocation over a dead trend reds too, not just
  the live-eval step that produced it.
- `live.eval.test.ts` logs `INCONCLUSIVE`/`PASS`/`FAIL` as three distinct
  words, satisfying the "distinct exit/status from a threshold breach" AC.

Reproduced the reviewer's exact repro as a unit test first (3 timeouts →
old code: `validSpecRate: 1` → PASS; new code: `inconclusive: true` → FAIL).
7 new tests; 98 demo tests total (up from 91), tsc clean, no new lint.

## #32 — threat model + security review (commit `5ca027d`)

Published `devdocs/security-review.md`. Structure: (1) data-flow diagram +
the core invariant (a validated spec cannot exceed the contract's declared
surface — a schema property, not model behavior), (2) the 55/55 red-team
number with the exact per-family breakdown table and the reviewer's 9-attack
independent reproduction cited by name, (3) an explicit "what 100% does NOT
claim" section, (4) data flow / auth — cited ADR-4's design intent but
**flagged that the demo's `fetch()` is currently a stub** (in-memory,
ignores `auth` entirely) so the auth-passthrough is an enforced interface,
not yet an exercised one; revisit at Phase 4. (5) A genuine pen-test-style
static read of the pinned platform's `/v1` guards and RLS migrations (not
just a description) — checked guard ordering and per-project JWT scoping
sound, flagged one legitimate design property (per-user identity is opt-in
via `isTokenRequired`, not default) and one open question we couldn't verify
without a live target (pooled-connection RLS session-variable leakage),
stated honestly as unconfirmed rather than asserted either way.

**Key judgment call:** the card's own wording ("fetch() runs in the vendor's
frontend under the end-user's existing session") describes ADR-4's *design*,
not today's demo implementation. Wrote the doc to state the design AND the
gap plainly — a buyer-facing doc that overclaims current state is worse than
one that doesn't exist yet.

## State

Both cards moved to In Progress (not Done) with acceptance criteria checked
and evidence commented, per [[Review Workflow]] — reviewer verifies next.
**Phase 3 (Generation Pipeline) is now fully implemented** — every card from
#69 through #32 has a commit and a paper trail. Next up: reviewer pass on
these two, then Phase 4 (Workspace Service) kickoff, which is also where the
demo's stub `fetch()` gets replaced with something #32 §4's gap note can be
closed against.
