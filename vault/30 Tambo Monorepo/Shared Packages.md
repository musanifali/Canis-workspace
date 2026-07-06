---
tags: [tambo, package]
created: 2026-07-04
---

# Shared Packages

`tambo/packages/` — the platform's shared layer. Upstream's separation-of-concerns rules:

| Package | Contains | Must not |
|---|---|---|
| **core** | Pure utilities: validation, JSON, crypto, threading, tool utilities | Touch the database |
| **backend** | LLM/agent-side helpers, streaming utilities | — |
| **db** | Drizzle schema (`src/schema.ts`), migrations, **operations** (`src/operations/`) | Hand-edited SQL |

Placement rule: cross-package utility → `core`; LLM-specific → `backend`; DB access → `db`.

## db specifics (relevant to our scripts)

- `apps/api` services call **operation functions**, not inline queries — our `seed-tambo-project.mts` reuses these same operations ([[Scripts and Eval Harness]])
- Migration commands need the workspace flag: `npm run db:generate|db:migrate|db:check|db:studio -w packages/db`
- No denormalized FKs derivable from relationships

## Also in `packages/`

`react-ui-base`, `ui-registry` (UI foundations for the registry), `testing`, and shared tooling configs (`eslint-config`, `typescript-config`, `vite-config`).
