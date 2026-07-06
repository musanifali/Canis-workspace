---
tags: [overview, howto]
created: 2026-07-04
---

# Getting Started (cold start → working demo)

Full command detail in [[Commands Cheatsheet]]; ports in [[Ports and Services]].

## 1. Start the self-hosted Tambo stack

```bash
cd tambo                            # the vendored clone
./scripts/cloud/tambo-setup.sh      # one-time: creates docker.env (already done)
./scripts/cloud/tambo-start.sh      # postgres :5433, minio :9000, api :8261, web :8260
./scripts/cloud/init-database.sh    # apply migrations
```

## 2. Provision the demo project + API key

The local dashboard login needs OAuth/Resend which isn't configured, so the seed script provisions directly against the DB and writes `demo/.env.local`:

```bash
cd tambo && set -a && . ./docker.env && set +a && \
  DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5433/$POSTGRES_DB" \
  npx tsx ../demo/scripts/seed-tambo-project.mts
```

> [!warning] Run tsx scripts from `demo/`
> The tambo clone blocks npm <11 via `devEngines` (this machine has npm 10.9.7). Use `npx -y tsx` from `demo/`. See [[Known Issues]].

## 3. Configure the LLM (bring your own key)

OpenRouter free tier via Tambo's `openai-compatible` provider — see [[Scripts and Eval Harness]] for `configure-llm.mts` usage and [[Known Issues]] for the 50 req/day budget.

## 4. Run the demo

```bash
cd demo && npm run dev    # → localhost:3001 (:3000 is taken by another project)
```

## 5. Before eval runs

```bash
cd demo && npx -y tsx scripts/check-tools.mts   # 15 regression checks must pass
```
