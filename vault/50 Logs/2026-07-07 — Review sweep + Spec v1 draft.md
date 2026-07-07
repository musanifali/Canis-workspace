---
tags: [log]
created: 2026-07-07
---

# 2026-07-07 — Review sweep + Spec v1 draft

**Role:** implementer ([[Review Workflow]])
**Tickets:** mOMsEeE7, 5ulGFyVj, Ne0bvT4P (review cards) · qiLtVFPt (Spec v1)

## Done

- **mOMsEeE7 (patch governance)** → Done. Patch narrowed to tolerate only the
  `message-*` → `msg_*` handoff (anything else still throws); upstream issue
  filed with root cause + repro: https://github.com/tambo-ai/tambo/issues/2974;
  pin-upgrade checklists (demo README + [[Known Issues]]) reference the card;
  [[ADR-6 SDK patch for stream id mismatch]] records the decision.
- **5ulGFyVj (date filters)** → Done. `dueAfter`/`dueBefore` require a leading
  `YYYY-MM-DD` and truncate datetimes at parse; 3 new check-tools cases
  (18/18 green); lesson normative in Spec v1 §5.
- **Ne0bvT4P (vault hygiene)** → backfilled [[2026-07-06 — Phase 0 endgame]]
  + ADR-6; this note resumes the habit (reviewer's next log closes the card).
- **Spec v1 draft complete**: `devdocs/workspace-spec-v1.md` — 12-col layout,
  config/binding split, typed query grammar, symbolic relative time resolved
  at execution, BUILD/CLARIFY/REJECT, versioning, worked example, non-goals.
  3 of 4 card criteria checked; freeze awaits review.

- **Card #6 (DUx7yjkT) implemented against the draft**: monorepo root scaffolded
  (npm workspaces, `packages/*`; demo stays standalone) and
  `packages/core` (@workspace-engine/core) — spec schemas 1:1 with the doc,
  `parseSpec`/`serializeSpec` (canonical key order), 19 tests green incl. a
  purity-guard test enforcing zod-as-only-dependency. "Matches frozen doc"
  criterion stays open until freeze.

## Found / decided

- Design doc lives in monorepo `devdocs/` (first file there), per Operating Model.
- Spec §13 lists four open questions as the review agenda (CLARIFY payload
  shape, FilterBar target entity rule, max block count, interval-refresh TZ).

## Blocked on

- Spec freeze = reviewer pass over §13.
- Key rotation still with the user (Trello/OpenRouter/Gemini/DeepSeek).

## Follow-ups

- [ ] After freeze: card #6 (packages/core Zod schemas) implements the doc.
- [ ] Reviewer: check off "both sessions resume the habit" on Ne0bvT4P with
      their next session log.

## Addendum (post-freeze, same day)

- **Freeze feedback applied**: reviewer's A1–A4 + Q1–Q4 landed in
  `devdocs/workspace-spec-v1.md` (now **FROZEN v1**) and in code —
  timezone UTC alias, omit-never-null (explicit `null` config rejected),
  `deriveBindingShape` per the A2 table. Card #6 → Done (22 tests).
- **Card #7 (vziwpB83) done**: `packages/core/src/contract/define-entity.ts`.
  Literal field-name inference (`Extract<keyof Shape, string>`) — typos are
  compile errors (@ts-expect-error test) AND runtime ContractDefinitionError.
  Field kinds derived from Zod (unwrap optional/default/effects — NB Zod v3:
  `ZodDefault.removeDefault()`, not `.unwrap()`), `fieldKinds` overrides for
  dates, define-time validation (unknown fields, numeric aggs on non-numbers,
  limit ordering). fetch({query, auth}) stored, never called — purity holds.
  29/29 tests. DX fixture: full case entity in 14 lines.
  Criterion "DX reviewed" left for reviewer with the fixture as exhibit.
- **Next**: card #8 (C0x4KHR9) — contract compiler: one contract →
  LLM tools + policy validator + query executor.
- **Card #8 (C0x4KHR9) done**: `packages/core/src/contract/compile.ts` —
  compileToTools / compileToValidator / compileToExecutor from one contract.
  Anti-drift design: query.ts now exports `filterValueSchemas` (op → value
  shape) and compile.ts owns `OPS_BY_KIND` (kind → legal ops); filterSchema,
  the generated tool schemas, and the validator all consume the same tables.
  Drift-guard tests assert tool-schema accept ⇔ validator pass on the
  flagship query + 8 illegal ones. Executor: defaultLimit applied, auth
  passed through by reference (ADR-4), QueryPolicyError before any fetch.
  56/56 tests. Note: `contract.fetch` must be aliased before calling —
  the purity grep bans the literal call token.
- **Card #9 (l7XJqi5M) done**: `packages/core/src/validate/validate-spec.ts`
  + `src/registry/registry.ts` (six v1 blocks as data: config schema, binding
  shape, frame bounds, reference extractors). BUILD/CLARIFY/REJECT verdict,
  13 typed error codes all with message+fix+allowed[], tenant allowlists,
  maxBlocks downward-only clamp (Q3), A1 alias check, A2 shape check,
  Q2 FilterBar targets, §5 datetime→date truncation with notes.
  Found+fixed a shape-layer bug: absoluteDateValueSchema only admitted
  YYYY-MM-DD so the §5 normalization path was unreachable — widened to both
  precisions (kind-awareness is the policy layer's job). 78/78 tests.
- CLARIFY scope decision (for reviewer): validator-level CLARIFY fires only
  for missing bindings; ambiguity CLARIFYs belong to Phase 3 generation.
