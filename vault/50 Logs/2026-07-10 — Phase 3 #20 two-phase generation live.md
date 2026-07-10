---
tags: [log, phase3, implementer]
created: 2026-07-10
---

# Phase 3 #20 — two-phase generation, sentence→screen live (implementer)

Implementer session, continuing after the reviewer verified the gate + #19
([[2026-07-10 — Reviewer pass 5, Phase 3 kickoff verified live]]). Built #20:
the model now **authors a validated WorkspaceSpec** instead of picking
components. Commit `6c9fbdb`, In Progress for reviewer. All in `demo/`.

## What shipped

**Phase A — validate before any UI streams**
- `workspace-engine/plan-gate.ts` — `gatePlan(candidate, ctx)` wraps core's
  `validateSpec` into a product verdict: BUILD (normalized spec) / CLARIFY (one
  targeted question + opaque draft, never rendered) / REJECT (`explainRejection`
  composes each error's message + fix, so it names the bad field AND the
  contract's allowed alternatives). Pure + sync → <50ms/call (latency budget).
- `proposeWorkspaceTool(ctx)` — exposes the gate as a Tambo tool the model calls
  first; clarify/reject come back as a tool result answered in words.

**Phase B — render only a gated spec**
- `components/workspace/generated-workspace.tsx` — `GeneratedWorkspace`, the
  ONLY registered component on /create. Re-gates the spec prop (partial/streamed
  props never flash a broken tree; a direct render is still safe) and mounts the
  real WorkspaceProvider + WorkspaceRenderer.

**Wiring**
- /create: grounded `query_*` tools (#19) kept for data exploration, but
  GeneratedWorkspace is the only renderable → LLM emits spec JSON only.
- `system-prompt.ts` → v2026-07-10.2, the two-phase protocol + spec grammar.
- `kit.ts` exports shared `validationContext` (gate ≡ renderer, one source).
- Tests: plan-gate 5/5, generated-workspace 3/3, agent-tools 4/4; demo 16/16.

## Verified LIVE (headless, reviewer's tiptap-drive technique)

`document.querySelector('.tiptap[contenteditable="true"]').focus()` →
`keyboard.type(...)` → Enter, drive+read in one browser context. Prompt *"Show
high-risk cases due this month, grouped by analyst"* → model authored a spec →
proposeWorkspace **BUILD** → GeneratedWorkspace rendered **3 ui blocks
(ui-kpis/ui-board/ui-table), 30 real CASE ids, 0 broken blocks, 0 console
errors**. The DoD sentence→screen loop, through the real pipeline. Screenshot
`scratchpad/create20.png` (session-local).

## Two findings worth carrying forward

1. **Tambo forbids dynamic-key `z.record`** in BOTH component propsSchema AND
   tool inputSchema — surfaced as a page error at `spec.blocks[].config`. Fix:
   `GeneratedWorkspace.spec` and `proposeWorkspace.spec` are a described `z.any()`
   (skeleton in prose); `validateSpec` stays the precise authority. This cost two
   rebuild/redrive cycles to find — the first two live drives failed with exactly
   this error before the loop went green. Note it for #21/#22 schemas.
2. **`demo/src/components/tambo/` is entirely gitignored** by the broad `tambo/`
   pattern (line 1 of .gitignore, meant for the top-level clone, matches any
   nested `tambo/` dir). So the reviewer-requested Placeholder-chip cosmetic fix
   (show skeletons only while generating) is live in the local build but
   **uncommitted**. Anchoring the pattern to `/tambo/` would make the vendored
   template trackable — a repo-hygiene decision left open for the user/reviewer.

## Next

- **#21 spec lifting** — interactables snapshot → WorkspaceSpec on Save via
  `accepts{}`; save → reload → identical live screen. Builds on #20's renderer.
- **#22 eval harness** — seed from `demo/eval/phase0-quality-log.json`; the
  tiptap-drive + `gatePlan` verdicts are the scoring rig.

Relates to [[trello-workspace-engine-board]], [[Review Workflow]].
