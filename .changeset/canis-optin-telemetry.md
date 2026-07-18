---
"@workspace-engine/react": minor
"@workspace-engine/client": minor
---

Opt-in anonymous telemetry (default OFF — no config, no network, ever):
`WorkspaceProvider` accepts `telemetry={{ enabled: true, endpoint }}` and
emits the documented event set (integration funnel, degraded renders) to the
Workspace Service's new `POST /v1/telemetry`; the typed client gains
`sendTelemetry` and `getTelemetrySummary` (aggregates only — raw events have
no read API and nothing identifying is persisted).
