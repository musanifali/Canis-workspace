# Deployment runbook (#95 / #96)

The launch stack, all on **free tiers** (no card, commercial use allowed):

| Surface | Host | Free tier |
|---|---|---|
| Postgres | **Neon** | 0.5 GB, 100 CU-hrs/mo, native RLS, never expires |
| Workspace Service (`apps/api`) | **Render** (Docker web service) | free web service (sleeps after 15 min idle) |
| Dashboard / docs / playground (Next.js) | **Vercel** Hobby | free, per-PR preview deploys, TLS |

Custom domains (`api.ticora.tools`, `dashboard.…`) drop in later once the name's
domain is registered; until then everything runs on `*.onrender.com` /
`*.vercel.app` with automatic TLS.

Secrets live **only** in the host secret stores (Render / Vercel / GitHub
Actions). A leaked repo clone contains zero production credentials — the repo
carries `sync: false` placeholders and `.env.example` only.

---

## 1. Postgres — Neon

1. neon.tech → new project (region near Render's `oregon`, e.g. `us-west-2`).
2. Copy the **pooled** connection string; it already ends with
   `?sslmode=require` (the app + migrator rely on that for TLS).
3. Neon's default role can `CREATE ROLE`, which migration `0000` needs
   (`workspace_service`). No extra grants required.

## 2. Workspace Service — Render

The blueprint is [`render.yaml`](../render.yaml); the image is
[`apps/api/Dockerfile`](../apps/api/Dockerfile) (a `turbo prune` monorepo
build — verified to build and run locally).

1. Render Dashboard → **New → Blueprint** → connect this repo → it reads
   `render.yaml` and creates the `ticora-api` service.
2. Fill the `sync: false` env vars in the Render dashboard:
   - `WORKSPACE_DATABASE_URL` = the Neon string from step 1.
   - `WORKSPACE_PROVISION_SECRET` = `openssl rand -base64 32` — **use the same
     value** in the dashboard + playground (Vercel).
   - `WORKSPACE_CORS_ORIGIN` = the dashboard + playground origins, comma-sep
     (e.g. `https://ticora-dashboard.vercel.app,https://ticora-play.vercel.app`).
3. Service → Settings → **Deploy Hook**: copy the URL.
4. In GitHub → repo → Settings:
   - Secret `RENDER_DEPLOY_HOOK_URL` = that hook.
   - Variable `API_BASE_URL` = the service URL (e.g.
     `https://ticora-api.onrender.com`).

### The deploy pipeline (no manual steps)

`render.yaml` sets `autoDeploy: false`, so Render never deploys on its own.
The only path to prod is [`.github/workflows/deploy-api.yml`](../.github/workflows/deploy-api.yml):

```
push to main → CI ("lint · types · test · build") → on success:
  → POST Render deploy hook
  → Render runs preDeployCommand (node packages/db/scripts/migrate-prod.mjs)
  → Render rolls out the new image (health-gated on /health)
  → workflow smoke test: /health/ready == db:ok, and /v1 returns 401 (guard live)
```

Migrations therefore always run **before** the new release takes traffic, and a
red CI never reaches prod.

## 3. Post-deploy validation

- **TLS + redirect:** Render serves HTTPS and redirects HTTP automatically;
  confirm `https://<api>/v1/docs` loads and `http://` 301s.
- **RLS holds in prod:** point the adversarial cross-tenant suite at Neon
  (creates a few ephemeral test tenants; safe on a fresh DB):
  ```
  TEST_DATABASE_URL='<neon-url>' npx vitest run -w @workspace-engine/db src/rls.test.ts
  ```
  All cross-tenant reads/writes must be **denied by Postgres** (not the service
  layer). This is the pass-13 adversarial probe re-run against production.

## 4. Rollback (exercise once)

Render keeps every deploy. To roll back to N-1:

- **Dashboard:** service → **Deploys** → pick the last-good deploy → **Rollback**.
  Render re-runs that image's `preDeployCommand` first — migrations are
  **additive-only** (new columns are nullable / backfilled), so N-1 code runs
  against the N schema without error. If a migration is ever destructive, add a
  down-migration before shipping it.
- **Verify:** after rollback, `/health` reports the previous `release` (commit
  id) and the smoke checks pass.

Document the exercised rollback (date + deploy ids) in a vault log the first
time it's run.

## 5. Dashboard + docs — Vercel (#96)

See [`apps/dashboard/vercel.json`](../apps/dashboard/vercel.json) and
[`apps/docs/vercel.json`](../apps/docs/vercel.json). Two Vercel projects,
same repo, different **Root Directory**:

- `ticora-dashboard` → root `apps/dashboard`; env: `WORKSPACE_API_URL` (the
  Render URL), `WORKSPACE_API_KEY`, `WORKSPACE_TENANT_ID`,
  `WORKSPACE_PROVISION_SECRET` (same as Render), `GITHUB_CLIENT_ID/SECRET`,
  `DASHBOARD_BASE_URL` (the Vercel URL).
- `ticora-docs` → root `apps/docs`; env: `NEXT_PUBLIC_API_URL` = the Render URL
  (baked into quickstart snippets via the content-sync mechanism).

Vercel gives per-PR preview deploys for both automatically. The dashboard proxy
stays server-side (the admin key never reaches the browser) — verify with the
grep check in #96 before launch.
