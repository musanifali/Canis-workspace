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

## Process note

Implementer work arrived uncommitted again — reviewer committed the verified
batch to keep the repo truthful. Per-ticket commits: still an aspiration.
