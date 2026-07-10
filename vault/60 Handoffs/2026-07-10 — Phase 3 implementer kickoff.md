---
tags: [handoff, phase3]
created: 2026-07-10
---

# Phase 3 implementer kickoff (from reviewer, 2026-07-10)

Canonical copy of the brief handed to the Phase 3 implementer session.

## Role & sources of truth

Implementer per [[Review Workflow]]. Trello = task state; this vault =
decisions/logs; agent memory = operational pointers. Reviewer verifies and
closes cards — move finished work to **In Progress**, not Done.

## State

Phases 0–2 complete and reviewer-verified. Packages: core (frozen Spec v1,
contracts, validator, query engine, migrations), react (renderer, data layer,
hooks, provider, degradation), ui (default blocks, devMode sandbox). Demo
proves the read path visually (`/workspaces`, `/sandbox`). Remote + CI green.
**Phase 3 = the LLM authors specs.**

## Task order

1. **Gate:** `[review][P2] FilterBar kind-blind contains` (top of Phase 2
   list): Q2 rule → filterable AND string-kind; probe locked as test; spec §7
   note; demo e2e asserts visible DATA not element counts.
2. Tambo agent integration — `compileToTools()` into the agent loop
   (self-hosted stack; deepseek-v4-flash; versioned system prompt).
3. Two-phase generation — plan → `validateSpec` (BUILD/CLARIFY/REJECT) →
   stream. CLARIFY = questions + opaque draft (never rendered).
4. Spec lifting — interactables snapshot → spec via `accepts{}`;
   save → reload → identical live screen.
5. Eval harness as blocking CI stage — seeded from Phase 0's scored 20
   (`demo/eval/phase0-quality-log.json`), spec-assertion based; metrics:
   valid-spec / clarify / false-build rates.
6. Then: clarify/reject UX, devtools panel, vendor eval kit, cold-start
   chips, red-team + drift eval hygiene, threat-model doc.

## Hard constraints (review-reject if violated)

- LLM emits **spec JSON only** — never components/code/render instructions.
- Everything reaches the renderer through `validateSpec`.
- The deterministic read path stays LLM-free; core stays pure (guard test).
- `tambo/` clone is pinned read-only infra; patches only via patch-package +
  upstream issue + ADR (see [[ADR-6 SDK patch for stream id mismatch]]).

## Conventions & traps

Per-ticket conventional commits, pushed (repo-local credential helper; see
phase2 memory if push fails). Gates before each commit: build, test, size,
verify:artifacts. Judgment calls → card comments for the reviewer. Session log
in `50 Logs/` at the end. Traps: restart Next dev server after package
changes (stale bundle = convincing skeletons); Tambo auth header `x-api-key`;
demo on :3001; use `deepseek-v4-flash` not the deprecated `deepseek-chat`;
models send `[]` for unused array filters; always send `userTime` context.

## Phase 3 definition of done

*"Show high-risk cases due this month, grouped by analyst"* typed in the demo
→ validated WorkspaceSpec → streams into the real renderer → saves → reloads
live. The sentence→screen loop, through the real pipeline.
