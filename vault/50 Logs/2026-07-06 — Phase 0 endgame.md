---
tags: [log]
created: 2026-07-06
---

# 2026-07-06 — Phase 0 endgame (consolidated backfill)

**Role:** implementer ([[Review Workflow]])
**Tickets:** NVwb9Acu (milestone #4), Tx1hwGT1 (#1 BYOK), GjKTCmfx (budget), plus the LLM saga
**Note:** backfilled log covering 2026-07-04 → 07-06 (baseline eval, LLM saga, browser-bug session) — filed late, flagged by review card Ne0bvT4P.

## Done

- **LLM saga resolved**: free tiers structurally can't fit the 20-prompt baseline
  (OpenRouter 50 req/day + flaky free-route tool calls; Gemini free =
  20 generations/day/model). Landed on **DeepSeek `deepseek-v4-flash`** (paid,
  ~$0.10/run, zero throttles). Gemini 3.x unusable with the pinned backend —
  thinking models need `thought_signature` round-trip that the backend drops.
- **Ticket #4 baseline COMPLETE**: 18 valid / 1 partial / 1 wrong (90%), scored
  log + **GO decision** in `demo/eval/phase0-quality-log.md`. Misses are both
  the "text/empty fallback" class the Phase 1 validator is designed to catch.
- **Browser bug session** (user's manual test caught what headless eval missed):
  1. Blocks crashed on progressively-streamed partial props → all 5 blocks
     normalize arrays + filter partial entries (pattern in demo README for Phase 2).
  2. Model reasoning contains raw `<user>`/`<additionalcontext>` tags → reasoning
     now renders as plain text, not markdown.
  3. Stream id mismatch crash → patch-package on @tambo-ai/client ([[ADR-6 SDK patch for stream id mismatch|ADR-6]]).
- Chat UI hardening: `userTime` context helper (model guessed June in July);
  thread-name + suggestion autogen disabled (DeepSeek thinking mode 400s on
  their tool_choice); Graph strips injected `_tambo_*` props.
- **Playwright demo recorder** (`demo/scripts/record-demo.mts`): video +
  screenshots + console capture. Final run: 3 prompts, 0 console / 0 page
  errors. Video: `demo/eval/videos/demo-sentence-to-screen-2026-07-06.webm`.
- **Phase 0 milestone card → Done. Phase 0 complete.**

## Found / decided

- Component decisions surface as server-handled `show_component_<Name>` tool
  calls; models send `[]` for unused array filters; props stream partially —
  all recorded in [[Known Issues]] and the demo README.
- Patch decision: [[ADR-6 SDK patch for stream id mismatch]].
- Upstream issue filed: https://github.com/tambo-ai/tambo/issues/2974

## Blocked on

- Key rotation (user): Trello token, OpenRouter, Gemini, DeepSeek — all pasted
  in chat at some point.

## Follow-ups

- [ ] Review cards mOMsEeE7 / 5ulGFyVj / Ne0bvT4P (picked up 2026-07-07)
- [ ] Workspace Spec v1 design doc (qiLtVFPt) — Phase 1 opener
