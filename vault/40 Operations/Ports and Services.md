---
tags: [ops, reference]
created: 2026-07-04
---

# Ports and Services

| Port | Service | Source | Notes |
|---|---|---|---|
| **3001** | Demo app | `demo/` `npm run dev` | :3000 is held by the user's other project (`~/Desktop/startup`) |
| **8260** | Tambo web dashboard | docker (`apps/web`) | Login impossible locally — use seed script instead ([[Self-Hosted Stack]]) |
| **8261** | Tambo API (NestJS) | docker (`apps/api`) | What the demo + eval talk to; auth `x-api-key` |
| **5433** | PostgreSQL | docker | Non-default port — remember it in `DATABASE_URL` |
| **9000** | MinIO | docker | Object storage |
| 8262 | Showcase | clone `npm run dev` | Upstream demo — only if run manually |
| 8263 | Docs site | clone `npm run dev` | Only if run manually |

## Quick health checks

```bash
docker ps                                        # stack containers up?
curl -s -o /dev/null -w '%{http_code}' localhost:8261   # API alive?
lsof -i :3001                                    # demo app running?
```
