---
tags: [tambo, platform]
created: 2026-07-04
---

# Cloud Platform (apps/web + apps/api)

The part of the monorepo we actually **run** — self-hosted via docker ([[Self-Hosted Stack]]).

## `apps/api` — NestJS OpenAPI server (:8261)

- The demo app and eval harness talk to this; auth header `x-api-key`
- Modular NestJS: one module per domain, DTOs via class-validator, services hold business logic
- Serves the OpenAPI spec from which the external `@tambo-ai/typescript-sdk` is generated (Stainless, upstream CI)
- Handles threads, streaming (`advancestream`), tool orchestration, and the server-side `show_component_<Name>` calls ([[Component Registration]])
- Restarts automatically under `turbo watch` when workspace packages change

## `apps/web` — Next.js dashboard (:8260)

- Project management UI (projects, API keys, provider config)
- **Unusable locally** — login needs GitHub/Google OAuth or Resend, none configured. Everything it would do, we do via `demo/scripts/*.mts` against the DB directly ([[Scripts and Eval Harness]])
- Upstream rule: no new `/api` endpoints; uses private tRPC + server utilities

## Data layer

Drizzle ORM via `packages/db` — schema at `packages/db/src/schema.ts`, DB operations factored into `packages/db/src/operations/` (the seed script calls these directly). Migrations are generated (`npm run db:generate -w packages/db`), never hand-edited. See [[Shared Packages]].

PostgreSQL on **:5433**, MinIO on :9000 — [[Ports and Services]].
