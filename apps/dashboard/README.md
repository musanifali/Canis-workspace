# Canis vendor dashboard

Cards **#31** (contract registry, audit viewer, rejected-capabilities report,
usage analytics) and **#53** (dogfooding): the analytics views are themselves
validated Workspace Specs, saved in the Phase 4 service, rendered by the
public SDK surface only — `@workspace-engine/react` + `ui` blocks +
`client` store. If integrating hurts, it hurts us first: see
[PAPERCUTS.md](PAPERCUTS.md).

## Run it

```bash
npm run db:up -w @workspace-engine/db        # dedicated PG :5443
npm run dev -w @workspace-engine/api         # service :8270
node scripts/seed-dashboard-tenant.mjs       # tenant + key (repo root)
# → paste printed values into apps/dashboard/.env.local
npm run seed -w @workspace-engine/dashboard  # contracts + views via /v1 only
npm run dev -w @workspace-engine/dashboard   # http://localhost:3002
```

## Shape

- [src/canis/contracts.ts](src/canis/contracts.ts) — Canis's own
  `defineEntity` contracts (`audit_event`, `spec_rejection`, `usage_row`)
  over the service's public read endpoints.
- [src/canis/specs.ts](src/canis/specs.ts) — the three views as Workspace
  Specs; `canis.test.ts` holds them to a BUILD verdict.
- [src/app/api/canis/v1/[...path]/route.ts](src/app/api/canis/v1/%5B...path%5D/route.ts)
  — GET-only proxy; the tenant key stays server-side.
- [scripts/seed.ts](scripts/seed.ts) — vendor-side seeding through /v1,
  including two deliberate 422s that feed the rejected-capabilities view.
