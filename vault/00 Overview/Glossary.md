---
tags: [overview, reference]
created: 2026-07-04
---

# Glossary

| Term | Meaning |
|---|---|
| **Workspace Engine** | Our product: NL description → safe, saved, shareable native screen inside a B2B SaaS vendor's app. See [[Product Vision]]. |
| **WorkspaceSpec** | Versioned JSON document the LLM emits describing a screen. Validated, then rendered deterministically. See [[Architecture Decisions]]. |
| **BUILD / CLARIFY / REJECT** | The three verdicts of the pure spec validator that gates every WorkspaceSpec. |
| **`defineEntity`** | Data-contract primitive — single source of truth compiled into LLM tools, validator rules, and query executor. Prototyped by the Zod schemas in [[Case Management Service]]. |
| **Block** | An AI-renderable UI component registered with Tambo (e.g. CasesTable). See [[Workspace Blocks]]. |
| **Tambo** | Open-source framework for generative UI (`@tambo-ai/react` + cloud backend). We self-host it — see [[Tambo Monorepo Overview]]. |
| **Interactable** | Tambo pattern (`withInteractable`) letting the AI update an already-rendered component's props. |
| **Thread** | Tambo's conversation unit; messages can carry a rendered `component`. |
| **`show_component_<Name>`** | Server-handled tool call by which the model chooses a component to render — read it back from thread messages. See [[Scripts and Eval Harness]]. |
| **Phase 0** | The vertical-slice demo phase: prove sentence → screen on seeded data. See [[Phase 0 Status]]. |
| **`[review]` card** | Trello card filed by the reviewer session; gates later work. See [[Review Workflow]]. |
| **Showcase** | Tambo's own demo Next.js app (port 8262) — not ours; see [[CLI and Showcase]]. |
