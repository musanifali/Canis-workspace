/**
 * Internal telemetry view (#52): integration funnel + degradation-reason
 * frequencies from GET /v1/telemetry/summary. Aggregates only — raw events
 * are never exposed by the API surface.
 */
import { createWorkspaceServiceClient } from "@workspace-engine/client";

export const dynamic = "force-dynamic";

export default async function TelemetryPage(): Promise<React.ReactElement> {
  const apiKey = process.env.WORKSPACE_API_KEY;
  if (!apiKey) {
    return (
      <div className="notice error">
        <p>
          <code>WORKSPACE_API_KEY</code> is not set — see{" "}
          <code>.env.example</code>.
        </p>
      </div>
    );
  }
  const client = createWorkspaceServiceClient({
    baseUrl: process.env.WORKSPACE_API_URL ?? "http://localhost:8270",
    apiKey,
    userId: process.env.WORKSPACE_DASHBOARD_USER ?? "canis_ops",
  });

  let summary;
  try {
    summary = await client.getTelemetrySummary();
  } catch (error) {
    return (
      <div className="notice error">
        <p>
          Could not reach the Workspace Service:{" "}
          {error instanceof Error ? error.message : String(error)}
        </p>
      </div>
    );
  }

  if (summary.byEvent.length === 0) {
    return (
      <div className="notice">
        <p>
          No telemetry yet — it is opt-in and OFF by default. SDKs send events
          only when a vendor passes{" "}
          <code>{'telemetry={{ enabled: true, endpoint }}'}</code>.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.25rem" }}>SDK telemetry (anonymous, opt-in)</h1>
      <h2 style={{ fontSize: "1rem", marginTop: "1.5rem" }}>Integration funnel</h2>
      <table className="contracts-table">
        <thead>
          <tr>
            <th>Event</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          {summary.byEvent.map((row) => (
            <tr key={row.event}>
              <td>{row.event}</td>
              <td>{row.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 style={{ fontSize: "1rem", marginTop: "1.5rem" }}>
        Degraded renders by reason
      </h2>
      <table className="contracts-table">
        <thead>
          <tr>
            <th>Reason</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          {summary.degradedByReason.map((row) => (
            <tr key={row.reason}>
              <td>{row.reason}</td>
              <td>{row.count}</td>
            </tr>
          ))}
          {summary.degradedByReason.length === 0 && (
            <tr>
              <td colSpan={2}>No degraded renders reported.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
