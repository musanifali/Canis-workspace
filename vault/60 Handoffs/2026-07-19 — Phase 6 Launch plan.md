---
tags: [handoff, phase6, launch]
created: 2026-07-19
---

# Phase 6 — Launch plan (Canis to market)

Canonical copy of the launch plan behind the 🌍 Phase 6 Trello list
(epic + 17 tickets, all ≤ 8 SP, ~90 SP total). Product-engineering framing:
runtime is complete and released (v0.2.0); what remains is **adoption
surface**, not capability.

## The three gaps

1. **Nobody can sign up** — tenants exist only via seed scripts.
2. **Nothing is on the internet** — no deploys, no npm packages, no domain.
3. **Nothing to be attracted to** — no landing page, playground, video, or
   launch story. Plus the B2B gap: no published trust/legal surfaces.

## Tracks

- **A — Product completeness:** self-signup (8), key-management UI (5),
  dashboard session auth (5), plan tiers on existing cost controls (5).
- **B — Production infra:** service+PG deploy (8), dashboard+docs deploy
  (5), observability+status page (5), backups+restore drill (3),
  npm publish from release.yml (5).
- **C — Market attention:** marketing site (8), zero-signup playground (5),
  launch video incl. closing #83–#86 (3), deep-dive post + launch-day plan
  (3), design-partner beta program (3).
- **D — Trust & compliance:** public security page (3), legal/license/
  trademark (5), edge hardening + external auth review (5).

## Cycle

**Now (launch-gating):** legal/name freeze FIRST (gates npm scope, domains,
site) → signup + key UI + dashboard auth ∥ service deploy → dashboard/docs
deploy, observability, backups, npm publish ∥ marketing site + playground.
**Next (launch-week):** plan tiers, video (#83–#86), content, beta program,
security page, edge hardening.
**Later (fast-follow, filed as follow-ups on cards):** team invites, SSO,
Stripe self-serve, SOC2 track.

## Positioning notes (what grabs attention)

- The hook is the **safety architecture with receipts**: BUILD/CLARIFY/
  REJECT, 55/55 red-team catches, RLS-proven tenancy, append-only
  server-verified audit. Lead launch content with engineering, not adjectives.
- The **refusal is a feature**: the playground deliberately showcases a
  grounded refusal — competitors demo happy paths; we demo the LLM being
  *contained*.
- The playground turns attacks into sales demos: gate rejections render
  with their reason.
- Design language: the mined Tambo system ([[Tambo design system extract]]),
  Canis indigo accent, green reserved for status semantics.

## Standards for these tickets

Every ticket: user story, context, scope + out-of-scope, dependencies,
cycle stage, SP (≤8), acceptance-criteria checklist. Decisions surfaced on
cards before building (host choice, auth provider, npm scope, license).
Review workflow unchanged: implementer → In Progress, reviewer closes.

Relates to [[phase5-platform-dx]], [[2026-07-18 — Phase 5 implementer kickoff]],
[[trello-workspace-engine-board]].
