---
tags: [decision]
created: 2026-07-06
---

# ADR-6 · patch-package on @tambo-ai/client for the stream id mismatch

**Status:** accepted (temporary — remove on Tambo pin upgrade)

## Context

The pinned backend (commit 6861a3f2) can emit `TEXT_MESSAGE_START` with the LLM
client's temporary id (`message-<nanoid>`) and `TEXT_MESSAGE_END` with the
persisted DB id (`msg_*`) for the same message: `transformEventMessageIds`
(apps/api `v1.service.ts` ~L1537) early-returns when the persisted id isn't
known yet, so no temp→real mapping is recorded for the START. The pinned client
SDK (`@tambo-ai/client` 1.1.3, `event-accumulator` `handleTextMessageEnd`)
hard-throws on the mismatch and crashes the chat UI. ADR-1 ([[Architecture Decisions]])
says we never fork Tambo, but the crash blocked the Phase 0 demo entirely.

## Decision

Patch the **client check** at the consumption layer via patch-package
(`demo/patches/@tambo-ai+client+1.1.3.patch`, applied by `postinstall`):
tolerate **exactly** the `message-*` → `msg_*` handoff (warn + reconcile);
any other mismatch still throws. The tambo clone stays pristine.

## Consequences

- Chat UI survives the pinned backend's id handoff; demo works.
- The patch is narrow: genuine stream corruption still fails fast.
- Upstream issue filed with root cause + repro:
  https://github.com/tambo-ai/tambo/issues/2974
- **Every Tambo pin upgrade must re-evaluate this patch** (tracked by Trello
  card `mOMsEeE7`, referenced from the demo README upgrade procedure).
  Upstream fixed → drop the patch; not fixed → re-verify against the new
  client version (patch-package fails loudly on version bumps).
- The Phase 2 renderer must NOT inherit this tolerance silently — if we build
  on the client SDK there, reconciliation must be a deliberate, tested design
  decision, not this stopgap.

## Links

[[Architecture Decisions]] · [[Known Issues]] · [[2026-07-06 — Phase 0 endgame]]
