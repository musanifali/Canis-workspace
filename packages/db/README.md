# @workspace-engine/db

Persistence for the Workspace Service (Phase 4). Drizzle ORM + Postgres:
schema, migrations, and the operations layer. Services call operations —
nothing above this package writes SQL.

## Design

- **Specs are documents.** A saved workspace stores its validated Spec v1 as
  whole `jsonb` snapshots in `workspace_versions`; blocks are not shredded
  into rows. Stored specs are never rewritten — core's migrations run lazily
  at read time.
- **Versions are immutable.** Edits append a new version and repoint
  `workspaces.head_version`; rollback repoints it back. `workspace_versions`
  and `audit_log` have SELECT+INSERT RLS policies only, so UPDATE/DELETE are
  denied by Postgres itself for the service role.
- **Tenant isolation is enforced by the database.** Every row carries
  `tenant_id`; every operation runs inside `withTenant`, which does
  `SET LOCAL ROLE workspace_service` (non-owner, so RLS applies) plus a
  transaction-local `app.tenant_id` setting the policies compare against.
  Both reset at COMMIT/ROLLBACK — pooled connections cannot leak a tenant.

## Dev database

A dedicated Postgres container, separate from the vendored Tambo stack
(port **5443**; Tambo's own Postgres owns 5433):

```bash
npm run db:up -w @workspace-engine/db       # start Postgres (dev + test DBs)
npm run db:migrate -w @workspace-engine/db  # apply migrations to dev DB
npm run db:down -w @workspace-engine/db     # stop it
```

Default URLs (override with `DATABASE_URL` / `TEST_DATABASE_URL`):

- dev: `postgres://postgres:postgres@localhost:5443/workspace_engine`
- test: `postgres://postgres:postgres@localhost:5443/workspace_engine_test`

## Migrations

Schema source of truth is `src/schema.ts`. Never hand-edit generated SQL.

```bash
npm run db:generate -w @workspace-engine/db   # generate from schema changes
npm run db:generate -w @workspace-engine/db -- --custom --name <n>  # authored SQL (roles/grants)
```

## Tests

`npm test -w @workspace-engine/db` runs the integration suite against the
test database and **fails loudly when Postgres is down** (a silently-skipped
DB suite is a vacuous pass — see review card HYVbv9k5). Start the container
first. Tests migrate the test DB themselves and isolate via unique tenants.
