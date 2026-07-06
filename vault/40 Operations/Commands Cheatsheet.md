---
tags: [ops, howto]
created: 2026-07-04
---

# Commands Cheatsheet

Everything you actually type, grouped by where you run it. Cold-start order: [[Getting Started]].

## Stack lifecycle (from `tambo/`)

```bash
./scripts/cloud/tambo-setup.sh      # one-time secrets → docker.env
./scripts/cloud/tambo-start.sh      # start postgres/minio/api/web
./scripts/cloud/init-database.sh    # apply migrations
./scripts/cloud/tambo-build.sh      # rebuild images (deliberate upgrades only)
docker compose --env-file docker.env up postgres -d   # postgres alone
```

## Demo app (from `demo/`)

```bash
npm run dev                          # → localhost:3001
npm run build && npm run start
npm run lint / npm run lint:fix
npx -y tsx scripts/check-tools.mts   # 15 regression checks — before every eval
npx -y tsx scripts/eval-prompts.mts  # eval run → eval/phase0-quality-log.*
npx -y tsx scripts/set-instructions.mts
npx -y tsx scripts/configure-llm.mts <key> [model] [baseUrl]
```

## Provisioning (env sourced from the clone)

```bash
cd tambo && set -a && . ./docker.env && set +a && \
  DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5433/$POSTGRES_DB" \
  npx tsx ../demo/scripts/seed-tambo-project.mts
```

> [!warning] npm version trap
> The clone's `devEngines` requires npm ≥11; this machine has 10.9.7. Run tsx scripts **from `demo/`** with `npx -y tsx`. And keys contain `=` — never parse `.env` with `cut -d=`. See [[Known Issues]].

## Inside the clone (upstream workflows, rarely needed)

```bash
npm run dev:cloud                    # web+api in watch mode (8260/8261)
npm run dev                          # SDK: showcase (8262) + docs (8263)
npm run lint && npm run check-types && npm test
npm run db:generate|db:migrate|db:studio -w packages/db
```
