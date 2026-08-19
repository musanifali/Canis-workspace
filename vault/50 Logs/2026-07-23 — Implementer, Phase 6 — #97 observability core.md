---
tags: [log, implementer]
created: 2026-07-23
---

# 2026-07-23 · Implementer — Phase 6 #97 observability (core)

Sixth Phase 6 ticket this session. Built the **buildable/verifiable core** of
observability; the hosted pieces (Sentry, uptime prober, status page,
dashboards) are deploy + founder-account gated (the card even says "Depends on:
production deploys"). Branch `phase6/97-observability` (off main), PR
musanifali/Canis-workspace#6.

## Shipped (apps/api/src/observability/)

- **Health probes** outside the /v1 prefix (main.ts
  `setGlobalPrefix("v1", { exclude: ["health","health/ready"] })`) so a
  black-box prober hits them: `GET /health` (liveness, no deps),
  `GET /health/ready` (readiness — `select 1` DB round-trip → 503 if the pool
  is down, so a bad deploy fails its readiness gate).
- **RequestLoggerInterceptor** (APP_INTERCEPTOR): one JSON line/request to
  stdout — method, route PATTERN (not the url, so ids don't leak), status,
  durationMs, tenantId (from TENANT_CTX), requestId (honored or minted, echoed
  as x-request-id), release. NEVER bodies/spec/rows/keys (ADR-4).
- **AllExceptionsFilter** (APP_FILTER) EXTENDS BaseExceptionFilter — existing
  error responses unchanged — and adds a structured 5xx error log with
  release + tenantId (Sentry-forward shape). 4xx are expected, not escalated.
- `release.ts`: `WORKSPACE_RELEASE` (git tag in deploy; "dev" fallback).

## Verification

`observability.e2e.test.ts` makes the headline AC deterministic: it saves a
spec whose title carries `SECRET_SPEC_TITLE_*` and asserts that marker AND the
raw key are absent from captured stdout, while the request line still has
tenantId + timing. Health/readiness 200; a 5xx (if any) carries the tags.
api 63/63; check-types+lint 36/36. Live: /health + /health/ready 200 with
`release: v0.2.0` from WORKSPACE_RELEASE; /v1/health → 404.

## Gotcha logged

`git checkout main` reverts SOURCE but not gitignored `dist/`. The API imports
built db/core dist, which still had #94's plan build → usage.e2e's "unlimited
by default" failed ("expected 25 to be null") until I rebuilt core+db from the
branch source (`turbo build --filter core --filter db --force`). **After
switching branches, rebuild changed workspace packages before running
dependents' tests.** Relates to [[run-check-types-last]].

## Deploy/provider-gated (NOT in this PR)

Sentry DSN wiring; external uptime prober + alert routing; hosted public status
page + footer link; latency/error/generation dashboards. All land with the
production deploys (#95/#96). Only the log-hygiene AC is checked on Trello;
card stays In Progress.

Relates to [[phase6-launch]].
