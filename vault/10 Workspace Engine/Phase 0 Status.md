---
tags: [product, status]
created: 2026-07-04
updated: 2026-07-04
---

# Phase 0 Status

> [!note] Dated snapshot (per [[Operating Model]])
> Accurate as of the `updated:` date above. Live task state is always the [[External Links|Trello board]] — bump the date if you revise this note.

Vertical-slice demo: prove **sentence → screen** on seeded data through a self-hosted Tambo stack. Executed 2026-07-04. Board: [[External Links|Trello]].

## Ticket ledger

| # | Card | What | State |
|---|---|---|---|
| 1 | `Tx1hwGT1` | Repo layout, self-hosted stack, seed script | ✅ Done |
| 2 | `i6a8yAHt` | [[Case Management Service]] — 240 seeded cases + 3 tools | ✅ Done |
| 3 | `x5iutZNk` | [[Workspace Blocks]] — 6 registered components | ✅ Done |
| 4 | — | Eval baseline via [[Scripts and Eval Harness]] | ⏳ Blocked on OpenRouter budget decision |

## Independent review (2026-07-04)

Reviewed per [[Review Workflow]] — verdict **ship-quality**; 6 `[review]` cards filed, **5 fixed and re-verified same day** (adversarial re-runs + lint/tsc/check-tools):

1. limit schema constrained + parse-at-entry
2. template leftovers deregistered/deleted
3. `todayIso()` unified
4. lint restored via native flat configs (eslint-config-next v16), React-compiler rules quarantined to template dirs
5. CasesTable selection → native radio

**Open:** `[review][P3] OpenRouter budget` — a user decision, and the **only** thing blocking the ticket-#4 eval baseline. Residual non-blockers in [[Known Issues]].

## Environment snapshot

- Demo project id `p_tRC6ocZc.8737be`, user `demo@workspace-engine.local`
- Model: `nvidia/nemotron-3-ultra-550b-a55b:free` via OpenRouter (see [[Known Issues]] for model selection notes)
- Regression gate: `demo/scripts/check-tools.mts` (15 checks) before any eval run
