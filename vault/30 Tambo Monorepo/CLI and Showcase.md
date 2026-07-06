---
tags: [tambo, package]
created: 2026-07-04
---

# CLI, Showcase, Docs, create-tambo-app

The framework's tooling ring. Mostly relevant to us at scaffold/upgrade time.

## `cli/` — the `tambo` CLI

- Project scaffolding, component generation (`npx tambo` adds UI components to an app)
- **Component registry** lives in `cli/src/registry/` and **auto-syncs to** `showcase/src/components/tambo/` — upstream rule: edit the registry, never showcase components directly
- The chat UI components in `demo/src/components/tambo/` came from this registry via the scaffold

## `showcase/` — `@tambo-ai/showcase` (port 8262)

Upstream's own Next.js demo of every Tambo component/pattern. Useful as a **reference implementation** when building [[Workspace Blocks]] — but it's their app, not ours.

## `docs/` — `@tambo-ai/docs` (port 8263)

Fumadocs site; MDX guides + API reference. Public version at docs.tambo.co ([[External Links]]). Contains duplicated UI components that originate in `cli/` (upstream keeps them in sync manually).

## `create-tambo-app/`

The bootstrapper that generated `demo/` (version **0.3.5** at scaffold time). Handles git setup, deps, config. Template leftovers it shipped (interactables page, unused components) were partially cleaned in the Phase 0 review — see [[Phase 0 Status]].
