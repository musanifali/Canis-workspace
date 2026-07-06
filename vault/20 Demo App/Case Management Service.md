---
tags: [demo, data]
created: 2026-07-04
---

# Case Management Service

`demo/src/services/case-management.ts` — the demo's entire data layer (Phase 0 ticket #2, card `i6a8yAHt`).

## Dataset

**240 deterministic seeded cases** — same data every run, so eval results are comparable across runs and machines.

## Tools (registered in [[Component Registration|tambo.ts]])

| Tool | Purpose |
|---|---|
| `searchCases` | Filtered case lookup (status, risk, analyst, due dates, limit) |
| `aggregateCases` | Grouped counts/aggregations for KPI and board views |
| `listAnalysts` | Enumerate assignable analysts |

All inputs/outputs are **Zod-typed**. The exported case/filter schemas are the working **prototype for `defineEntity` data contracts** ([[Architecture Decisions]] ADR-3) — treat changes here as contract changes.

## Behavioral invariants #gotcha

These were hard-won during eval and are guarded by `scripts/check-tools.mts` (15 checks — run before every eval):

- **Empty arrays = no filter.** Models send `[]` for unused array filters; `applyFilter` must treat that as "no constraint", not "match nothing".
- **`limit` is schema-constrained and parsed at entry** (review fix).
- **Date logic uses a single `todayIso()`** (review fix) — and the model only gets dates right when `additionalContext.userTime` is sent with the request.

See [[Scripts and Eval Harness]] for how these are exercised and [[Phase 0 Status]] for the review trail.
