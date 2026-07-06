---
tags: [demo, infra]
created: 2026-07-04
---

# Self-Hosted Stack

We run Tambo's cloud platform locally via docker, built from the pinned clone (`tambo/` @ `6861a3f2`). We never use Tambo's hosted cloud — [[Architecture Decisions]] ADR-1/ADR-4.

## Lifecycle scripts (`tambo/scripts/cloud/`)

```bash
./scripts/cloud/tambo-setup.sh     # one-time: generates docker.env secrets
./scripts/cloud/tambo-start.sh     # starts the stack
./scripts/cloud/init-database.sh   # applies Drizzle migrations
./scripts/cloud/tambo-build.sh     # rebuild images (only on deliberate upgrade)
```

## Services

| Service | Port | Notes |
|---|---|---|
| NestJS API | **8261** | What the demo app and eval harness talk to; auth via `x-api-key` |
| Web dashboard | **8260** | Login **impossible locally** (needs GitHub/Google OAuth or Resend) — hence the seed script |
| PostgreSQL | **5433** | Non-default port; `DATABASE_URL` built from `docker.env` values |
| MinIO | **9000** | Object storage |

Full port table incl. demo app: [[Ports and Services]].

## Secrets & config

- `tambo/docker.env` — generated stack secrets (gitignored). Source it (`set -a && . ./docker.env && set +a`) before running db-touching scripts.
- `demo/.env.local` — written by `seed-tambo-project.mts`; contains the demo project API key.
- Provider keys stored **encrypted per-project** (`PROVIDER_KEY_SECRET`); stack-wide fallback possible via `FALLBACK_OPENAI_API_KEY` (OpenAI only).

## Provisioned identities

Demo project `p_tRC6ocZc.8737be`, user `demo@workspace-engine.local` — created by the seed script, see [[Scripts and Eval Harness]].
