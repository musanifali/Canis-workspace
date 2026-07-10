---
tags: [log, phase3, implementer]
created: 2026-07-10
---

# Phase 3 [review][P1] #70 — tool-args parse dead-turn fixed, flagship 100%

Implementer session. Cleared the P1 gate the reviewer filed against #20
([[2026-07-10 — Reviewer pass 6, two-phase verified on video + P1]]) before
starting #21. Commit `bf8cc0c`, In Progress. All in `demo/`.

## Diagnosis (criterion 1) → (a) truncated streamed tool-args

Reproduced headlessly: `Failed to parse tool call arguments`, ~1/6 baseline.
Captured accumulated JSON ends mid-token (`…"value":[{"`). Both pinned-client
accumulators concatenate deltas by simple ordered append
(event-accumulator.js:729, tool-call-tracker.js:82) → NOT mis-accumulation (b);
the model/transport produced malformed JSON. First repro failure was a
`query_case` call, which the declarative spec flow never needs.

## Fix — spec off the tool-args path (mitigation 3, reviewer-endorsed)

Tool-args = string-accumulate → one fail-fast `JSON.parse` → truncation crashes
the turn. **Component props = incremental JSON Patch** (event-accumulator.js:973
`applyJsonPatch`), no final parse → truncation degrades to "composing…", never a
crash. So `/create` renders **GeneratedWorkspace directly**; the component
re-gates with validateSpec (validation still gates every pixel). proposeWorkspace
+ query tools left the loop (kept exported for non-streaming callers).

Dropping the tools removed grounding, so I recovered it without the fragile
transport, and this is where the real reliability came from:
- **contractContextHelper** — `compileToTools` capability description (exact
  entity/field names, kinds, ops) as AdditionalContext. Fixed the model guessing
  `cases`/`risk_level`/`due_date`.
- **spec-prop-schema.ts** — Tambo-safe (explicit-key, no z.record) spec schema as
  GeneratedWorkspace's propsSchema → schema-constrained generation. This was the
  single biggest lever (permissive `any` → structured: 40% → 70%).
- **stripSpecRoot** — drops stray top-level keys (root is `.strict()`).
- **Prompt v2026-07-10.7** — render-directly protocol, full spec/query grammar,
  and the two rules specs died on: block id must be `blk_[a-z0-9]+` (NO internal
  underscores — `blk_cases_by_analyst` FAILS the regex), and `op` not `operator`.

## Result (criteria 2 & 4)

Measured each fix by 10-run headless drives (fresh browser context per run — new
anonymous userKey so threads don't collide):
- ~33% (reviewer baseline) → 40% (prose grounding) → 70% (structured schema) →
  **100% (10/10) after the id + root-strip fixes.**
- **0 hard errors / dead turns across ~40 runs** — the crash is structurally
  impossible now (JSON-Patch prop streaming has no fail-fast parse).

Criterion 3 (parse-failure rate tracked in #22) is a forward requirement for the
eval harness; the scratchpad tiptap-drive measurement rig is the basis.

## Method notes (for #22)

- Node buffers stdout to a redirected file → background runs looked "stuck".
  Log each run synchronously with `fs.appendFileSync` to poll progress.
- A `data-diag` attribute on the pending block (gate codes + first block + spec
  keys) made the failing specs inspectable headlessly — that's how the id-regex
  and `.strict()`-root classes were found. Removed before commit.
- Every prompt/schema change needs a full `next build` (production `start`), not
  dev — stale bundle trap.

## Next

- **#21 spec lifting** — interactables snapshot → WorkspaceSpec on Save.
- **#22 eval harness** — must absorb the tiptap-drive rig + first-attempt
  validity / parse-failure-rate headline metrics.

Relates to [[trello-workspace-engine-board]], [[Review Workflow]].
