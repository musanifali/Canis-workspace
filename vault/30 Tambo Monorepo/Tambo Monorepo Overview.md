---
tags: [tambo, moc]
created: 2026-07-04
---

# Tambo Monorepo Overview

`tambo/` — vendored, **gitignored** clone of the upstream Tambo repo, pinned at `6861a3f2` (2026-06-16). Turborepo monorepo containing two distinct things:

1. **The framework** — SDK, client, CLI, showcase, docs (what `demo/` consumes)
2. **The cloud platform** — the web dashboard + API we self-host ([[Self-Hosted Stack]])

> [!warning] We don't modify this clone
> Per [[Architecture Decisions]] ADR-1 we consume, never fork. Changes here would be lost on the next deliberate upgrade. It's in the vault for **understanding**, not editing.

## Map

| Path | Package | See |
|---|---|---|
| `react-sdk/` | `@tambo-ai/react` | [[React SDK]] |
| `packages/client/` | `@tambo-ai/client` (framework-agnostic engine) | [[Client Package]] |
| `cli/`, `showcase/`, `docs/`, `create-tambo-app/` | tooling + demo + docs | [[CLI and Showcase]] |
| `apps/web` (:8260), `apps/api` (:8261) | cloud platform | [[Cloud Platform]] |
| `packages/{core,backend,db}` | shared platform packages | [[Shared Packages]] |
| `packages/{eslint-config,typescript-config,vite-config}` | shared tooling configs | — |
| `apps/{docs-mcp,mcp-everything,test-mcp-server}` | MCP servers | — |

## Toolchain

- Node ≥22, **npm ≥11** (enforced via `devEngines` — this machine has 10.9.7, see [[Known Issues]])
- Versions managed by mise (`mise.toml`, `.node-version`)
- Turborepo orchestrates builds/caching; hot reload via `transpilePackages` (Next.js apps) and `turbo watch` (API)
- `@tambo-ai/typescript-sdk` is **external** — generated from the API's OpenAPI spec by Stainless in upstream CI

Coding rules condensed in [[Tambo Coding Standards]]; full source of truth is `tambo/AGENTS.md`.
