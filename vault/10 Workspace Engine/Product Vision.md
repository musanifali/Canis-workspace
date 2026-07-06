---
tags: [product, moc]
created: 2026-07-04
---

# Product Vision

A **workspace engine for B2B SaaS** — a devtool that vendors embed in their product so *their* end customers can describe a view in natural language and get a real screen back.

> "high-risk cases due this month, grouped by analyst" → a safe, saved, shareable **native screen** inside the vendor's product.

**Explicitly not a chat product.** Chat is only the intake; the output is a durable workspace.

## The three pillars

1. **Everything is data** — the LLM emits a versioned JSON **WorkspaceSpec**, never code and never live UI. See [[Architecture Decisions]].
2. **Safety by construction** — a pure validator gates every spec with a BUILD / CLARIFY / REJECT verdict before anything renders.
3. **Deterministic at read time** — a renderer materializes saved specs with **no LLM involved**. Opening a saved workspace is fast, cheap, and reproducible.

## Data posture

- Vendors declare their domain with **`defineEntity` data contracts** — the single source of truth, compiled into LLM tools + validator rules + query executor.
- **Customer data never rests in our system** — the vendor's `fetch()` runs with the end-user's own token.

## Build order (agreed July 2026)

1. Spec + validator core
2. Deterministic renderer
3. LLM generation

Tracked on the Trello board — see [[External Links]]. Current progress: [[Phase 0 Status]].
