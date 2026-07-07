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
