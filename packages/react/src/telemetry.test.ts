import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTelemetryReporter, NOOP_TELEMETRY } from "./telemetry";

describe("createTelemetryReporter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is the no-op reporter unless explicitly enabled with an endpoint", () => {
    expect(createTelemetryReporter(undefined, "k")).toBe(NOOP_TELEMETRY);
    expect(
      createTelemetryReporter({ enabled: false, endpoint: "https://x/v1/telemetry" }, "k"),
    ).toBe(NOOP_TELEMETRY);
    expect(createTelemetryReporter({ enabled: true, endpoint: "" }, "k")).toBe(
      NOOP_TELEMETRY,
    );
  });

  it("batches events and posts the documented payload with the key header", async () => {
    const doFetch = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    const reporter = createTelemetryReporter(
      { enabled: true, endpoint: "https://api.example/v1/telemetry", fetch: doFetch },
      "wek_test",
    );
    reporter.emit("provider.mounted", { devMode: false, contracts: 2, blocks: 6 });
    reporter.emit("block.degraded", { reason: "fetch-error", blockType: "Graph" });
    expect(doFetch).not.toHaveBeenCalled(); // debounced

    vi.advanceTimersByTime(2000);
    expect(doFetch).toHaveBeenCalledTimes(1);
    const [url, init] = doFetch.mock.calls[0]!;
    expect(url).toBe("https://api.example/v1/telemetry");
    expect(init.headers["x-api-key"]).toBe("wek_test");
    const body = JSON.parse(init.body);
    expect(body.events).toHaveLength(2);
    expect(body.events[0]).toMatchObject({
      event: "provider.mounted",
      props: { devMode: false, contracts: 2, blocks: 6 },
    });
    expect(body.events[0].sdkVersion).toBeTruthy();
  });

  it("flushes immediately at the batch limit", () => {
    const doFetch = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    const reporter = createTelemetryReporter(
      { enabled: true, endpoint: "https://api.example/v1/telemetry", fetch: doFetch },
      "k",
    );
    for (let i = 0; i < 20; i++) reporter.emit("block.degraded", { reason: "fetch-error" });
    expect(doFetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(doFetch.mock.calls[0]![1].body).events).toHaveLength(20);
  });

  it("swallows network failures — telemetry may never break the app", async () => {
    const doFetch = vi.fn().mockRejectedValue(new Error("offline"));
    const reporter = createTelemetryReporter(
      { enabled: true, endpoint: "https://api.example/v1/telemetry", fetch: doFetch },
      "k",
    );
    reporter.emit("provider.mounted");
    expect(() => reporter.flush()).not.toThrow();
    await vi.runAllTimersAsync();
  });
});
