# 2026-07-08 — Overlap fix + migration framework

**Session**: implementer · **Phase**: 1 (Spec & Validator)

## Done

- **[review][P1] #64 (3cmo88eZ) fixed** — validator BUILT overlapping frames.
  Pairwise rect-intersection in validateSpec + `LayoutOverlapError
  {blockIds}`; reviewer's probe as unit test; new fast-check layout property
  (BUILD ⇔ all frame pairs disjoint, 300 runs). Root cause: both schema
  files said "validator-level", the validator implemented nothing — and the
  property suite only generated single-block specs so geometry was never
  exercised. Commit d827f10.
- **Card #11 (EiPvOm0i) done** — spec migration framework
  (`src/spec/migrate.ts`): createMigrationRunner with eager chain
  validation (gaps/duplicates throw at construction), deep-clone before
  chain (stored customer data never mutated), runner stamps specVersion,
  finalize through parseSpec; `migrateSpec` = v1 baseline w/ empty chain;
  future versions fail fast ("upgrade the engine; never downgrade the
  spec"). Commit 6bf2e0c.

## State

- **Phase 1 implementation cards #6–#11 all Done.** packages/core:
  95/95 tests, tsc + build clean, runtime deps zod-only.
- Per-ticket commit habit holding (review card #63 criteria 1+2 ticked;
  optional private remote still awaiting user decision).

## Open

- Reviewer: card #7 "DX reviewed" criterion; card #10 "green in CI"
  (needs a CI card); verify #64 fix + #11.
- User: key rotation (Trello/OpenRouter/Gemini/DeepSeek), private remote
  yes/no.
