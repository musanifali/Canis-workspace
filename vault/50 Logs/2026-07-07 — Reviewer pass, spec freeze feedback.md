---
tags: [log]
created: 2026-07-07
---

# 2026-07-07 — Reviewer pass: review-sweep verification + Spec v1 freeze feedback

**Role:** reviewer ([[Review Workflow]])

## Verified (independently, not from claims)

- **Patch governance** — narrowed patch confirmed in patch file *and* applied
  `node_modules` code (only `message-*` → `msg_*` tolerated; else throws).
  Upstream [tambo#2974](https://github.com/tambo-ai/tambo/issues/2974) fetched
  live: correct title, root cause, repro. README pin-upgrade checklist,
  [[Known Issues]], [[ADR-6 SDK patch for stream id mismatch]] all cross-link.
  → card Done.
- **Date normalization** — regex + truncate at parse; 3 new check-tools cases
  incl. the eval-#15 inclusive-boundary scenario; 18/18 green; tsc clean.
  → card Done.
- **Vault hygiene** — logs backfilled + both sessions now logging (this note
  completes the criterion). → card Done.

## Spec v1 review → freeze APPROVED pending 3 amendments

Posted in full on card `qiLtVFPt`. Summary: A1 alias↔config contract
(aggregations referenced from config by alias, validator-checked); A2 explicit
output-shape derivation rule (aggregate / groups / grouped-aggregate); A3 null
handling (omit, never null — fix worked example). §13 answers: CLARIFY carries
questions + opaque draft spec; FilterBar targets must exist + share entity +
fields filterable (typed error); 24-block cap stays (policy-overridable down;
renderer chaos-tested at ~2×); no forced pinned TZ for interval — cache on
resolved range, not token.

## Second pass same day — card #6 (packages/core)

Verified independently: 19/19 tests + purity guard re-run, tsc clean,
adversarial probe 13/13 (unknown keys, frame math, empty in-arrays, bounded
limit, canonical byte-identical serde, round-trip). Findings: timezone regex
rejects `UTC` → **A4** added to spec amendments; `config: null` correctly
pending A3; `dist/` wasn't gitignored → reviewer fixed. Card stays open until
freeze. Committed as `ac9d7ca`.

## Third pass — cards #7–#10 (contracts, compiler, validator, property tests)

Spec FROZEN with A1–A4 ✓. 82/82 tests re-run ✓. Adversarial probe **8/9**:
alias contract (A1), FilterBar targets (Q2), datetime truncation w/ note,
CLARIFY (questions+options+draft), REJECT>CLARIFY precedence — all correct.
**1 confirmed P1: overlapping frames → BUILD.** §3 LayoutOverlapError never
implemented; both schema files defer overlap to the validator, validator
never picked it up — seam bug. The property suite (good arbitraries
otherwise) never asserts layout geometry, so 82 green tests sailed over it.
Filed [review][P1] with repro + the missing property ("BUILD ⇒ pairwise
disjoint"). Implementer committed their own work this time (3 commits) ✓.

## Process note

Implementer work arrived uncommitted again (twice today) — reviewer committed
both verified batches to keep the repo truthful. Per-ticket commits: still an
aspiration.
