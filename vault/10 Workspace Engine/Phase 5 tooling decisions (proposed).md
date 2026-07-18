---
tags: [product, decision, phase5]
created: 2026-07-18
status: proposed — pending reviewer/user push-back; mirrored onto cards #29/#30/#31/#33/#51/#52/#53 on 2026-07-18 (token rotated, board access restored)
---

# Phase 5 tooling decisions (proposed)

The five decisions the kickoff brief says to surface on cards before building.
Trello MCP is returning 401 (token rotation is an open user action), so they
are recorded here first; each will be copied as a comment onto its card when
board access is back. Implementation proceeds on these defaults — all five are
reversible before reviewer sign-off.

## D1 · CLI shape (card #29)
**One `canis` binary** in a new `packages/cli`, subcommands
`canis contracts diff` and `canis contracts lint`.
Trade-off: a single install/one `npx canis` line in vendor CI and shared
contract-loading code, at the cost of coarser versioning than per-tool
packages — acceptable pre-1.0, and subcommands leave room for `canis dev`,
`canis telemetry` later. Diff/lint consume `@workspace-engine/core`'s
`validateSpec`/contract compiler directly — no forked validation logic.

## D2 · Docs stack (card #30)
**In-repo `apps/docs` on Nextra** (Next-based static docs). Bias from the
brief: the <10-min quickstart must be CI-testable — quickstart code blocks
live as real files compiled and executed in CI, embedded into the docs, so
the stopwatch claim can't rot.

## D3 · Dashboard placement (cards #31/#53)
**New `apps/dashboard`**, a genuinely separate consumer that imports only the
public SDK surface (`@workspace-engine/react`, `@workspace-engine/client`,
WorkspaceStore port) — no package internals. Dogfooding (#53) is the point:
a section of the demo app would inherit demo plumbing and prove nothing.

## D4 · Semver baseline / "previous minor" (cards #33/#51)
Packages are **changeset-versioned in-repo, not npm-published**. "Previous
minor" = the most recent `vX.Y.0` git tag cut by changesets. The compat suite
checks out that tag's example apps (from #50) and runs them against the
current packages via `npm pack` tarballs — semver enforced mechanically
without requiring a registry. If/when packages publish to npm, the suite
switches to the published previous minor with no structural change.

## D5 · Telemetry sink + opt-in (card #52)
Sink = **`POST /v1/telemetry` on the existing `apps/api`** (no separate
collector to operate). Opt-in is an **explicit config flag, default OFF**
(`telemetry: { enabled: true }` in the SDK provider config), anonymous
payloads with a documented schema: integration-step funnel, error-taxonomy
frequencies, degraded-render events. Nothing fires when unset.

Relates to [[Architecture Decisions]],
[[2026-07-18 — Phase 5 implementer kickoff]].
