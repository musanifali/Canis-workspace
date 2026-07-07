---
tags: [product, decision]
created: 2026-07-04
---

# Architecture Decisions

The load-bearing choices, agreed July 2026. Each is a small ADR; add new ones as `## ADR-N` sections.

## ADR-1 · Consume Tambo, never fork it #decision

We depend on `@tambo-ai/react` (exact-pinned) plus a **self-hosted Tambo backend** built from a pinned clone. Our product is a separate monorepo; the clone in `tambo/` is gitignored.

- **Why:** upstream moves fast; a fork rots. Pinning + deliberate upgrades keeps us honest about the integration surface.
- **Consequence:** SDK and backend must move in **lockstep** (the SDK talks to the API that backend serves). Upgrade procedure lives in `demo/README.md`.

## ADR-2 · Everything is data (spec → validate → render) #decision

The LLM's only output is a **versioned JSON WorkspaceSpec**. Pipeline:

```
NL request → LLM → WorkspaceSpec (JSON)
                     ↓
             pure validator → BUILD | CLARIFY | REJECT
                     ↓ (BUILD)
             deterministic renderer → native screen (no LLM at read time)
```

- **Why:** saved workspaces must be safe, reproducible, diffable, and cheap to open.

## ADR-3 · `defineEntity` data contracts #decision

Vendors describe entities once; that contract compiles into the LLM tool surface, validator constraints, and the query executor. The Zod schemas exported from [[Case Management Service]] are the working prototype.

- **Why:** one source of truth prevents drift between what the model can ask for, what validates, and what executes.

## ADR-4 · Customer data never rests with us #decision

Vendor `fetch()` executes with the end-user's token; we store specs, not data.

- **Why:** B2B procurement/security. Also keeps our read path stateless.

## ADR-5 · Build order: spec/validator → renderer → LLM generation #decision

Phase 0 ([[Phase 0 Status]]) is the vertical-slice spike de-risking the Tambo integration before the spec core is built.

## ADR-6 · patch-package on @tambo-ai/client (temporary) #decision

Narrow consumption-layer patch for the pinned backend's stream id handoff bug —
full write-up in [[ADR-6 SDK patch for stream id mismatch]]. Upstream:
https://github.com/tambo-ai/tambo/issues/2974. Re-evaluate on every pin upgrade
(Trello card mOMsEeE7).
