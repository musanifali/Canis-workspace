---
tags: [log, phase3, security]
created: 2026-07-16
---

# 2026-07-16 — Reviewer pass 12: #74 + #32 verified → Phase 3 fully signed off

**Role:** reviewer ([[Review Workflow]]). These two were the last Phase 3
cards In Progress; they gate the Phase 4 kickoff.

## #74 — eval vacuous-pass fix (commit c686f0b) → Done

The vacuous-green I filed (all-timeout → 695ms PASS, 0 measured) is dead.
Independent probe of `checkThresholds`:
- all-timeout → pass=false, **inconclusive=true** ("infrastructure unavailable")
- empty run → inconclusive
- a real false-build → pass=false, **inconclusive=false** (distinct from infra)
- all-measured-good → real PASS
`minMeasuredFraction=0.5` floor; drift check excludes inconclusive as a
baseline AND regresses when the latest full attempt is inconclusive, so the
weekly gate can't go green on a dead endpoint. 103 demo tests green.

## #32 — threat model / security review (commit 5ca027d) → Done

`devdocs/security-review.md` is strong, sales-grade collateral. Verified:
- 55/55 red-team still catches (re-ran redteam.test.ts).
- **§5 inherited-code claim is ACCURATE** — `bearer-token.guard.ts` really
  does `return true` on a missing Authorization header unless
  `project.isTokenRequired`; the doc cites the platform faithfully.
- §4 is the doc's best quality: separates the *pitched* auth-passthrough
  architecture from *current demo reality* ("enforced interface, not yet
  exercised" — demo ignores auth, in-memory array, anon key). No overselling.
- §3 scopes the 100% honestly (data-access attacks, not a jailbreak audit;
  gate only as strong as the vendor's contract).
- §5 flags the connection-pool RLS session-leak as an OPEN QUESTION needing a
  live test — responsible, not a hand-wave.
Citable to a pilot's security team as-is.

## State

**Phase 3 is fully implemented AND fully reviewer-signed-off** (#19→#32, all
reviews, all findings resolved). The Demo Polish epic is also done + reviewed
(pass 11) with four open follow-up findings (#83–#86, presentation nits).
**Phase 4 (Workspace Service) is unblocked** — and §4/§5 of the security doc
name its first jobs: wire a real auth-checked vendor backend so ADR-4's
auth-passthrough becomes exercised, not just enforced.
