---
tags: [log, implementer]
created: 2026-07-23
---

# 2026-07-23 · Implementer — Phase 6 #94 plan tiers

Fifth Phase 6 ticket this session (after Track A: #106/#91/#93 merged, #92
PR#4). Wires free/pro/internal tiers to the existing #48 usage ledger. Branch
`phase6/94-plan-tiers` (off main), PR musanifali/Canis-workspace#5.

## Design (the load-bearing choice)

The plan drives the effective monthly generation cap at **READ time** — 
`getGenerationAllowance` resolves `tenant.monthlyGenerationBudget ??
PLAN_CAPS[plan].generationsPerMonth`. So:
- A plan change (even a raw SQL `UPDATE tenants SET plan='pro'`) takes effect
  on the very next allowance check — no restart, no cap columns to restamp
  (AC: "plan change takes effect without deploy/restart").
- The per-tenant override column still wins (design-partner one-offs).
- Enforcement is UNCHANGED — the same ledger + 429 path as #48. No second path.

`PLAN_CAPS` lives in **core** (pure data) so the db (enforcement), the
dashboard, and the docs sync test all read one source.

## Data-migration care

Adding `tenants.plan` with DB default 'free' would have silently dropped every
existing tenant (internal dashboard, demo, all e2e fixtures) onto the free cap.
Migration 0012 backfills all pre-existing tenants to **internal** (unlimited);
new rows still default to 'free'. Fixtures updated to be explicit:
`createTestTenant` and both seed scripts → internal; `provisionTenant` → free;
all 8 API e2e direct tenant inserts → internal (so suites that predate tiers
keep their "unlimited by default" assumption, e.g. usage.e2e's "starts open
with an unlimited budget").

## Shipped

- core `PLAN_CAPS` (free 25/mo·3 ws·7d retention; pro 2000·100·90d; internal
  unlimited) + `isPlan`/`PLAN_LABELS`.
- db: plan column, read-time cap resolution, `setTenantPlan`, allowance now
  returns `plan`/`monthlyCap`/`usedThisMonth`. plans.test (5) + updated usage.
- api: `/v1/usage/allowance` DTO gains plan fields; plans.e2e (3): free hits
  cap → 429 budget_exceeded, pro passes same load, SQL change reopens live.
  (Fill helper backdates events 5 min so the monthly fill doesn't trip the
  per-user 1-minute RATE window — the test is about the plan cap, not rate.)
- docs: `reference/plans.md` + `plans-sync.test` asserting each cell against
  PLAN_CAPS (added @workspace-engine/core as a docs devDep).
- dashboard: `/plan` page — plan badge, used-vs-cap meter, contact CTA.

## Verification

db 80/80, api 66/66, docs 11/11; `turbo check-types lint` 36/36 green (ran
the [[run-check-types-last]] gate); `/plan` rendered live for a fresh free
tenant (Free badge, "of 25 generations", CTA) and the allowance API returned
plan=free/cap=25.

Relates to [[phase6-launch]]. Note: #94 was labelled "Next" cycle but was the
most completable card (no LLM/hosting/founder-account dependency, unlike the
remaining Now-cycle deploys/npm/site/playground), so it closes Track A cleanly.
