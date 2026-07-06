---
tags: [moc]
created: 2026-07-04
---

# 🏠 Workspace Engine Vault

Knowledge base for the `~/tambo` repo — the **Workspace Engine** product monorepo, its Phase 0 demo, and the vendored Tambo framework it builds on.

## Sections

- **[[Operating Model]]** — where truth lives (Trello vs vault vs agent memory vs repo) — read this first
- **[[Repo Map]]** — how the repo is laid out and what lives where
- **[[Getting Started]]** — run the stack + demo from a cold start
- **[[Glossary]]** — project-specific terms

### 10 · Workspace Engine (the product)
- [[Product Vision]] — what we're building and why
- [[Architecture Decisions]] — the load-bearing choices
- [[Phase 0 Status]] — current state of the vertical-slice demo
- [[Review Workflow]] — implementer/reviewer two-session process

### 20 · Demo App (`demo/`)
- [[Demo App Overview]] — Next.js app, pinned SDK, layout
- [[Component Registration]] — how blocks + tools get registered
- [[Case Management Service]] — the seeded demo dataset + tools
- [[Workspace Blocks]] — the 6 AI-renderable components
- [[Scripts and Eval Harness]] — seed, configure-llm, eval, check-tools
- [[Self-Hosted Stack]] — docker services, ports, provisioning

### 30 · Tambo Monorepo (`tambo/`, vendored)
- [[Tambo Monorepo Overview]] — Turborepo layout
- [[React SDK]] · [[Client Package]] · [[CLI and Showcase]]
- [[Cloud Platform]] — web dashboard + NestJS API
- [[Shared Packages]] — core, backend, db
- [[Tambo Coding Standards]] — condensed AGENTS.md rules

### 40 · Operations
- [[Commands Cheatsheet]] — every command you actually run
- [[Ports and Services]] — who listens where
- [[Known Issues]] — warts, gotchas, pending items

### 50 · Logs
- One note per working session from the [[Session Log]] template

### 90 · Reference
- [[External Links]] — docs, board, dashboards
- Templates: [[Decision Note]] · [[Session Log]]

> [!tip] Conventions
> Notes use `#moc` for maps-of-content, `#decision` for architecture decisions, `#gotcha` for traps. New notes go in the numbered folder matching their topic; link them from the section MOC.
