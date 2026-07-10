---
tags: [log, phase3, implementer]
created: 2026-07-10
---

# Phase 3 kickoff — gate #69 cleared + #19 grounded tools (implementer)

Implementer session. Followed the [[2026-07-10 — Phase 3 implementer kickoff]]
task order: clear the Phase 2 review gate first, then start the generation
pipeline.

## 1. Gate: [review][P2] #69 — FilterBar kind-blind `contains` (commit `aa3e1bb`)

Chose fix **(a)** — v1-tighten the Q2 rule; kind-aware controls (b) deferred.

- `validateSpec`/`validateTargets` (core): a FilterBar field must now be
  filterable **AND** `contains`-compatible, i.e.
  `OPS_BY_KIND[kind].includes("contains")` — only `string`. Coupled to the
  grammar, not a hardcoded "string", so it can't drift from what the bar emits.
  Error names the offending kind + the entity's text-filterable fields.
- Probe locked as a regression test: `FilterBar(fields:["risk"])` (enum) →
  REJECT. The prior BUILD case switched to `analyst` (string). Property tests
  unaffected. Core 118 green.
- Spec §7 (`devdocs/workspace-spec-v1.md`): target rule = "filterable **and
  string-kind**", with the self-destructing-approved-spec rationale.
- Demo e2e now asserts rendered DATA (`/CASE-\d{4}/` on every tab + live KPI
  number), not element counts. Ran against a **fresh** build with
  `reuseExistingServer:false` to dodge the stale-bundle trap that fooled the
  Phase 2 review. 1 passed.

Moved to In Progress for reviewer verification.

## 2. #19 — Tambo agent integration: grounded tools + versioned prompt (`fd90b48`)

All in `demo/` — no package changes, so core stays free of `@tambo-ai`.

- **Grounded tools** (`workspace-engine/agent-tools.ts`): `toGroundedTools(contracts)`
  → one Tambo `query_<entity>` tool per contract. Schema from `compileToTools`
  (only contract-legal queries representable), execution from `compileToExecutor`
  (re-validate → default limit → vendor fetch w/ user auth → client engine).
  Grounded by construction. Test 4/4 incl. illegal-query-throws.
- **Versioned prompt** (`workspace-engine/system-prompt.ts`): `SYSTEM_PROMPT_VERSION`
  + text, delivered via a **context helper** (`workspaceGuideContextHelper`) —
  same channel as `userTime`. Context-helper (not backend agent-settings)
  because the `tambo/` clone is pinned read-only. Field-agnostic on purpose;
  fields/ops ride on the tool descriptions.
- **Creation surface** (`app/create/page.tsx`): the proven `MessageThreadFull`
  shell wired with grounded tools + guide + userTime.

Verified: demo build (all routes incl `/create`), tsc, lint (0 err), tests 8/8;
`/create` serves 200 and mounts against the live self-hosted stack (:8261).

**Open for reviewer:** the live "streams interactables" moment (criterion 3,
left unchecked). Couldn't auto-verify — the message input isn't reachable via
Playwright on `/chat` either (harness limit, not a page defect); `/create` is
structurally identical to `/chat` (0 textareas / 10 buttons on both), differing
only by grounded tools + prompt. Needs a human/live drive.

## Traps re-confirmed / notes

- Stale Next `start` server → skeletons pass element-count checks. Always rebuild
  + no-reuse for e2e.
- Self-hosted stack (`tambo_api`/`tambo_web`/`postgres`/`minio`) was up 6 days,
  healthy. `ts-back-end-postgresql-1` container is crash-looping but unrelated.
- Cosmetic follow-up: `lib/tambo.ts` component descriptions still name the old
  `searchCases`/`aggregateCases` tools in prose — tidy when specs land (#20).

## Next

- **#20 two-phase generation (plan → validate → stream)** builds directly on
  #19's generative loop — best started *after* the reviewer confirms #19's live
  streaming, so we're not stacking on an unverified foundation.
- Then #21 spec lifting, #22 eval harness. Exposed keys in `demo/.env.local`
  still want rotation (hygiene).

Relates to [[trello-workspace-engine-board]], [[Review Workflow]].
