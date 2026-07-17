---
tags: [handoff, phase5]
created: 2026-07-18
---

# Phase 5 implementer kickoff — Platform & DX (Canis)

Canonical copy of the brief handed to the Phase 5 implementer session.

## Role & sources
Implementer per [[Review Workflow]]. Read: MEMORY recall, [[Operating Model]],
[[Architecture Decisions]], `devdocs/workspace-spec-v1.md`,
`devdocs/security-review.md`, and the 🚀 Phase 5 Trello list. Cards → In
Progress when done; reviewer closes. File decisions in vault, log in 50 Logs/.

## State
Phases 0–4 complete + reviewer-signed-off (pass 13). The runtime is done: spec
→ validator → renderer → generation pipeline → durable multi-tenant versioned
service (`apps/api` :8270, `packages/db`, RLS-proven, ADR-4 exercised). Phase 5
is different in kind: no new runtime seam. It makes Canis **adoptable** —
vendor-facing tooling, docs, release discipline, and dogfooding.

## Gate first: review debt #87 (P2)
`apps/api` workspaces.service stamps a hardcoded client-asserted
`{verdict:"BUILD"}` on every create/update — spec *shape* is checked, contract
*semantics* are not (card #87 has full blast-radius analysis: bounded, render
path still re-gates, but the stored audit verdict is server-unverified). Fix
before #31, because the vendor dashboard's audit view must display verdicts
the server can back: wire tenant `data_contracts` into create/update, run real
`validateSpec`, store the actual verdict, reject non-BUILD writes, then update
security-review.md §4/§audit claims.

## Cards (suggested order, two tracks)

**Track A — vendor trust tooling (core value):**
1. **#87** `[review][P2]` server-side contract validation (above) — the gate.
2. **#29 contracts-diff CLI** — runs in the VENDOR'S CI: "this change breaks
   14 saved workspaces referencing sla_deadline" BEFORE they ship. Needs the
   Phase 4 service (saved specs per tenant) + core validator. Biggest
   developer-trust feature on the board.
3. **#49 contracts lint** — static contract-quality checks (vague
   descriptions, declared-but-unimplemented capabilities, missing enum
   descriptions). Same CLI home as #29; makes generation quality legible
   instead of letting vendors blame the model.
4. **#31 vendor dashboard** + **#53 dogfooding** — build them AS ONE: the
   dashboard's analytics views are themselves validated workspaces rendered by
   our own SDK against our own contracts, persisted by the Phase 4 service.
   #53's point is that every integration paper-cut hits us first.

**Track B — release & docs discipline:**
5. **#33 release engineering** — changesets, strict semver on core/react/ui,
   canary channel, documented support window.
6. **#51 public-API compat suite** — previous minor's example apps compile +
   pass against each new release in CI; semver enforced mechanically, not
   promised.
7. **#30 docs site + <10-min quickstart** — stopwatch-timed against a cold
   clone; includes spec-format + error-taxonomy reference.
8. **#50 adapter recipes + framework examples** — copy-paste fetch() for
   REST/GraphQL/Prisma/Supabase; Next App Router guide with RSC/client
   boundaries drawn explicitly; Vite SPA example. These example apps feed #51.
9. **#52 opt-in SDK telemetry** — anonymous, documented: integration-step
   funnel, error-taxonomy frequencies, degraded-render events. Last: it
   observes everything the other cards build.

## Hard constraints (reviewer-reject)
- `packages/core` stays pure (purity guard). CLI tooling → its own package
  (e.g. `packages/cli`); docs site → its own app; nothing new imports IO into
  core.
- Frozen Spec v1 unchanged. contracts-diff/lint consume the existing validator
  + contract types — no forked validation logic that can drift from `gatePlan`.
- Tambo consumed not forked (ADR-1). `tambo/` and `tambo-landing/` are
  separate git repos at the workspace root — NEVER run git from inside them.
- Dashboard must consume the public SDK surface (WorkspaceProvider/renderer/
  client store port) like a real vendor would — no reaching into package
  internals, or #53 proves nothing.
- Follow existing Tambo backend discipline in `apps/api`/`packages/db`
  (operations layer, DTOs, drizzle-kit migrations only).

## Early decisions to surface (flag on the card, don't guess)
1. CLI shape: one `canis` binary with `contracts diff|lint` subcommands vs
   separate packages. State a choice + trade-off on #29.
2. Docs stack: Nextra/Fumadocs in-monorepo vs external (Mintlify). Bias
   in-repo so the quickstart is testable in CI.
3. Dashboard placement: new `apps/dashboard` vs a section of the demo app.
   Dogfooding argues for a separate real consumer.
4. Semver baseline: are packages actually published (npm/private registry) or
   version-only via changesets? #51 needs a "previous minor" to exist —
   define what that means before building the suite.
5. Telemetry sink: apps/api endpoint vs separate collector; and the opt-in
   mechanic (explicit config flag, default OFF).

## Conventions & gotchas
Per-ticket commits pushed to remote Canis; build+test green before commit.
Product repo = `/Users/thamacstore/tambo`; npm 10.9.7 (tambo clone demands
≥11 — run tsx from demo/). Docker stack (:8261) only needed for live
generation; service tests use the dedicated PG on :5443. Session log per
session in 50 Logs/. Repo-level `.mcp.json` exists — your own `.env.mcp` per
[[Getting Started]] §6.

## Definition of done
A cold-clone vendor reaches a working validated contract in <10 stopwatch
minutes via the docs; `contracts diff` in CI catches a seeded breaking change
against real saved workspaces (with the "breaks N workspaces" message);
`contracts lint` catches seeded contract smells; the vendor dashboard renders
its own analytics as validated workspaces served by the Phase 4 service; a
deliberately breaking change is mechanically blocked by changesets + the
compat suite; #87 is closed with server-stored real verdicts and
security-review.md updated.

## Not gating
Demo Polish findings #83–#86 remain a separate presentation track (walkthrough
asserts + 3 polish items) — pick up only if a live demo is scheduled.

Relates to [[2026-07-17 — Phase 4 implementer kickoff]],
[[trello-workspace-engine-board]].
