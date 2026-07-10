---
tags: [log, phase3]
created: 2026-07-10
---

# 2026-07-10 (pt6) — Reviewer pass: #20 verified on video; parse-failure P1; gitignore rescue

**Role:** reviewer ([[Review Workflow]])

## #20 two-phase generation → Done (verified incl. live, on video)

- **Code**: gatePlan = pure sync wrapper over validateSpec (one-question
  CLARIFY, teaching REJECT: message+fix, deduped, cap 4). GeneratedWorkspace
  re-gates the streamed prop every change, mounts the real provider+renderer
  only on BUILD — the z.any() Tambo workaround is harmless because validateSpec
  is the only door, even for a direct render. 16 demo tests green.
- **Live, recorded**: flagship prompt → model AUTHORED a spec → BUILD → real
  ui GroupedBoard (5 analyst columns), 0 console errors.
  Video: `demo/eval/videos/two-phase-sentence-to-screen-2026-07-10.webm`.
- **Grounded refusal, live**: "customer sentiment score" → model cites the
  contract's actual fields, declines, builds what it can. (Screenshot in
  /tmp during session; behavior also visible at the end of the failure video.)

## [review][P1] filed: proposeWorkspace tool-args parse failures

2/3 first attempts today died with `Failed to parse tool call arguments` →
dead turn. Mechanism suspect: whole spec as one tool-args JSON blob; DeepSeek
emits it malformed sometimes (or the pinned client mis-accumulates — ADR-6
precedent; diagnose via raw thread args). Mitigations on the card. #22 must
track first-attempt parse-failure rate as a headline metric.
Evidence video: `two-phase-parse-failure-then-recovery-2026-07-10.webm`.

## Repo rescue (found during review)

The unanchored `tambo/` gitignore had NEVER tracked
`demo/src/components/tambo/` — 18 files (incl. all Phase 0 browser-bug fixes)
existed only on this disk; a fresh clone wouldn't build. Anchored to
`/tambo/`, 18 files committed. Lesson: `git ls-files | wc -l` per directory
belongs in the review checklist after any gitignore edit.

## State

The core Phase 3 loop is proven end-to-end and on video: sentence → grounded
tools → authored spec → validator gate → deterministic renderer. Reliability
(transport) is the open P1. Next: #21 spec lifting, #22 eval harness (must
absorb the tiptap-drive technique + parse-failure metric).
