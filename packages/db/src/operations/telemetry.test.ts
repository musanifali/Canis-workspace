import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { WorkspaceDbClient } from "../client.js";
import { connectTestDb } from "../test-helpers.js";
import { getTelemetrySummary, recordTelemetryEvents } from "./telemetry.js";

let client: WorkspaceDbClient;

beforeAll(async () => {
  client = await connectTestDb();
  await recordTelemetryEvents(client.db, [
    { event: "provider.mounted", props: { devMode: true, contracts: 0 }, sdkVersion: "0.1.0" },
    { event: "provider.mounted", props: { devMode: false, contracts: 2 }, sdkVersion: "0.1.0" },
    { event: "block.degraded", props: { reason: "contract-drift", blockType: "CasesTable" } },
    { event: "block.degraded", props: { reason: "contract-drift", blockType: "Graph" } },
    { event: "block.degraded", props: { reason: "fetch-error", blockType: "Graph" } },
    { event: "store.first_save" },
  ]);
});

afterAll(async () => {
  await client?.close();
});

describe("telemetry", () => {
  it("stores events without any tenant/user attribution", async () => {
    const rows = await recordTelemetryEvents(client.db, [{ event: "sandbox.rendered" }]);
    expect(rows[0]?.event).toBe("sandbox.rendered");
    expect(Object.keys(rows[0]!)).not.toContain("tenantId");
    expect(Object.keys(rows[0]!)).not.toContain("actorUserId");
  });

  it("summarizes the funnel and degradation reasons", async () => {
    const summary = await getTelemetrySummary(client.db);
    const events = Object.fromEntries(summary.byEvent.map((e) => [e.event, e.count]));
    expect(events["provider.mounted"]).toBeGreaterThanOrEqual(2);
    expect(events["store.first_save"]).toBeGreaterThanOrEqual(1);
    const reasons = Object.fromEntries(
      summary.degradedByReason.map((r) => [r.reason, r.count]),
    );
    expect(reasons["contract-drift"]).toBeGreaterThanOrEqual(2);
    expect(reasons["fetch-error"]).toBeGreaterThanOrEqual(1);
  });

  it("no-ops on an empty batch", async () => {
    expect(await recordTelemetryEvents(client.db, [])).toEqual([]);
  });
});
