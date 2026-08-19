# Workspace Service (NestJS) production image (#95). Monorepo-aware: `turbo
# prune` carves out just the API and its workspace deps, so the image builds
# without the dashboard/docs/demo. Build context is the REPO ROOT.
#
#   docker build -f apps/api/Dockerfile -t ticora-api .
#
# Runtime env (set in the host secret store, never in the image):
#   WORKSPACE_DATABASE_URL   Neon/RDS connection string (?sslmode=require)
#   WORKSPACE_PROVISION_SECRET, WORKSPACE_CORS_ORIGIN, WORKSPACE_RELEASE
#   PORT                     injected by the platform (Render/Fly/Railway)
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat

# 1. Prune the monorepo to just @workspace-engine/api + its deps.
FROM base AS pruner
WORKDIR /app
RUN npm i -g turbo@^2
COPY . .
RUN turbo prune @workspace-engine/api --docker

# 2. Install pruned deps and build (turbo builds api's dependency graph:
#    core → db → client → api).
FROM base AS builder
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN npm ci
COPY --from=pruner /app/out/full/ .
RUN npx turbo build --filter=@workspace-engine/api

# 3. Runtime. Copies the built workspace (dists + node_modules + db migrations).
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
# Run as a non-root user.
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /app .
USER app
# Informational; the platform maps its own PORT (config reads process.env.PORT).
EXPOSE 8270
CMD ["node", "apps/api/dist/main.js"]
