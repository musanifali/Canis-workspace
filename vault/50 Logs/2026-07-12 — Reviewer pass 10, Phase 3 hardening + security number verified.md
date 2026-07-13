---
tags: [log, phase3, security]
created: 2026-07-12
---

# 2026-07-12 (pt2) — Reviewer pass: P1 #73 fix + #44–#47; the security number

**Role:** reviewer ([[Review Workflow]])

## Verified → Done (5 cards)

- **P1 #73 clock fix (303a513)** — vi.useRealTimers() + fast-fail canary.
  PROVEN: re-ran my exact three previously-hanging cases with the server up →
  rj-02/cl-01/ad-01 all no_build, control p0-01 build, 0 infraTimeouts, normal
  duration (was a 9,133,051ms hang).
- **#44 devtools (2eb058e)** — separate package, deps = core only + peers;
  out of the SDK bundle. Spec/verdict/query-timeline inspector.
- **#45 vendor kit (4039208)** — generateEvalCases derives assertions from the
  same capability declarations that ground the model → correct-by-construction
  vendor confidence suite. The 1-day-to-their-data on-ramp.
- **#46 cold-start (3622279)** — curated-per-role then contract-derived chips
  (can't suggest an impossible query); click-through analytics.
- **#47 red-team + drift (d9c1d86)** — **55/55 deterministic catch, plus my
  own 9 hand-crafted attacks (SSN exfil, __proto__, op-smuggle, limit abuse,
  non-permitted sort/group/agg) ALL caught; valid control builds.** Honestly
  framed as a VALIDATOR PROPERTY (deterministic, no model) with a separate
  live prompt-injection run — the exact distinction #32 needs. Drift gate on
  full-runs only; weekly cron; MODEL_PINNING.md.

## Filed → [review][P2] vacuous pass

infraTimeouts are (correctly) excluded, but a fully-down stack makes EVERY
case an infraTimeout → PASS with 0 measured. I hit it (695ms PASS, 0 cases).
Fix: minimum measured-case floor → else FAIL "inconclusive: infra
unavailable", distinct from a threshold breach. Critical for the scheduled
drift gate — it must not go green on a dead endpoint.

## The number for #32

**Prompt-injection blast radius = the contract's declared surface; 100% of
the red-team corpus blocked at the gate, deterministically.** Reviewer-
reproduced with independent attacks. This is citable verbatim in the threat
model.

## State

Phase 3 is DONE except #32 (threat model + security review) — which is now a
writing/collateral task with its headline number verified. Ops caveat noted:
Docker/stack must be up for any live eval; a down stack silently vacuous-
passes until the P2 lands.
