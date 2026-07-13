# Model version pinning & drift policy (card #47)

The generation quality of this product is a property of a *specific* model
version. Models drift under us — a hosted endpoint gets re-tuned, a version bump
silently changes behaviour — even when our code doesn't change. This document is
the policy that keeps that drift visible and blocking.

## What is pinned, and where

| Thing | Pinned value | Where |
| --- | --- | --- |
| Generation model | `deepseek-v4-flash` (self-hosted, exact image tag) | demo stack compose / `NEXT_PUBLIC_TAMBO_URL` endpoint |
| System prompt | `SYSTEM_PROMPT_VERSION` (e.g. `2026-07-11.6`) | `src/workspace-engine/system-prompt.ts`, recorded on every trend row |
| Eval thresholds | `DEFAULT_THRESHOLDS` (valid ≥ 90%, false-build = 0, parse ≤ 10%) | `src/eval/metrics.ts` |

Every eval run stamps `promptVersion` into `eval/trend.jsonl`, so a metrics
change is always attributable to *either* a prompt edit (ours) or model drift
(theirs) — the two are never confused on the dashboard.

## Promotion policy (new model or endpoint change)

A model/endpoint version is **never** rolled out on vibes. To promote a new
version:

1. Point `EVAL_BASE` at the candidate endpoint.
2. Run the full gate: `npm run eval` **and** `npm run eval:redteam` (the
   deterministic red-team runs in normal CI too).
3. Compare against the current trend: `npm run eval:drift`.
4. Promote **only if** the candidate meets `DEFAULT_THRESHOLDS` **and** shows no
   regression vs. the incumbent (valid-spec drop ≤ 5%, no new false-builds, no
   parse-failure rise). Otherwise the prompt is re-tuned against the new model
   first, and the loop repeats.

The pinned version is bumped in one commit that also carries the passing trend
row, so the promotion is auditable.

## Drift detection (scheduled)

`.github/workflows/eval-weekly.yml` runs weekly (and on demand):

- **Always, blocking:** the deterministic red-team (`npm test` includes it) — the
  100%-caught guarantee can regress from a prompt/validator change with no model
  involved, so it gates every run.
- **When the endpoint is reachable:** the full live eval, appending a trend row,
  followed by `npm run eval:drift`.
- **`eval:drift` exits non-zero on regression** → the scheduled build goes red.
  Drift is therefore a *blocking alert*, surfaced the week it happens, not a
  surprise discovered when a customer hits it.

## The red-team catch-rate number

The red-team suite (`src/eval/redteam/`) asserts the validator rejects **100%**
of ≥ 50 adversarial specs. Because that number is deterministic (no model in the
loop), it is safe to cite verbatim in the threat model (#32) and security
collateral: *prompt injection cannot exceed the contract's declared surface —
100% of the corpus is blocked at the gate.*
