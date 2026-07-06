---
tags: [overview]
created: 2026-07-04
---

# Repo Map

`/Users/thamacstore/tambo` is the **product monorepo** for the [[Product Vision|Workspace Engine]] (git repo, `main` branch, no commits yet as of 2026-07-04).

```
tambo/                      ← repo root (the PRODUCT repo)
├── .gitignore              # ignores tambo/, node_modules, .env*, logs
├── demo/                   # Phase 0 demo app (create-tambo-app scaffold)
│   ├── src/                # app code — see [[Demo App Overview]]
│   ├── scripts/            # seed / configure-llm / eval / check-tools
│   └── eval/               # phase0-quality-log.{json,md}
└── tambo/                  # ⚠ GITIGNORED vendored clone of tambo-ai/tambo
    ├── react-sdk/          # @tambo-ai/react (SDK we consume)
    ├── packages/           # client, core, backend, db, ui, configs
    ├── apps/               # web (dashboard), api (NestJS), mcp servers
    ├── cli/  showcase/  docs/  create-tambo-app/
    └── scripts/cloud/      # tambo-setup / tambo-start / init-database
```

## Key facts

- The inner `tambo/` clone is **gitignored** — we [[Architecture Decisions|consume Tambo, never fork it]]. It's pinned at commit `6861a3f2` (2026-06-16) and only moved deliberately (see upgrade procedure in [[Known Issues]] / `demo/README.md`).
- `demo/` pins `@tambo-ai/react` at **exact 1.3.0** (no `^`) to stay in lockstep with the backend built from that clone.
- Secrets live in gitignored files: `tambo/docker.env`, `demo/.env.local`.

## Where things are decided

| Question | Answer lives in |
|---|---|
| Product & architecture | [[Product Vision]], [[Architecture Decisions]] |
| What's built / next | [[Phase 0 Status]], Trello board ([[External Links]]) |
| How to run everything | [[Getting Started]], [[Commands Cheatsheet]] |
| Tambo internals | [[Tambo Monorepo Overview]] |
