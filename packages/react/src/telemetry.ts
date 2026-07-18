/**
 * Opt-in, anonymous SDK telemetry (card #52, decision D5).
 *
 * OFF unless the vendor passes `telemetry={{ enabled: true, endpoint }}` to
 * WorkspaceProvider — no config, no network, ever. When enabled, events from
 * the DOCUMENTED schema (integration funnel, degraded renders) are batched
 * and fired best-effort at the Workspace Service's /v1/telemetry (directly
 * or through the vendor's proxy). Failures are swallowed: telemetry may
 * never break, slow, or block the app. Nothing identifying is sent — no
 * user ids, no row data, no spec contents.
 */
import { SDK_VERSION } from "./version";

export interface TelemetryOptions {
  /** Must be explicitly true — there is no ambient default. */
  enabled: boolean;
  /**
   * Ingest URL, e.g. "https://workspace-api.internal/v1/telemetry" or a
   * same-origin proxy path. Required when enabled.
   */
  endpoint: string;
  /** Override for tests/SSR; defaults to globalThis.fetch. */
  fetch?: typeof fetch | undefined;
}

export type TelemetryEventName =
  | "provider.mounted"
  | "sandbox.rendered"
  | "store.first_save"
  | "block.degraded"
  | "spec.rejected";

export interface TelemetryReporter {
  emit(event: TelemetryEventName, props?: Record<string, unknown>): void;
  /** Flush pending events now (called on unmount). */
  flush(): void;
}

const BATCH_LIMIT = 20;
const FLUSH_DELAY_MS = 2000;

/** A reporter that does nothing — what every app gets by default. */
export const NOOP_TELEMETRY: TelemetryReporter = {
  emit: () => undefined,
  flush: () => undefined,
};

/**
 * Build the batching reporter for an explicitly-enabled config.
 * @param apiKey Sent as the abuse-gate header; never persisted server-side.
 * @returns A reporter (or the no-op one when not enabled).
 */
export function createTelemetryReporter(
  options: TelemetryOptions | undefined,
  apiKey: string,
): TelemetryReporter {
  if (!options?.enabled || !options.endpoint) return NOOP_TELEMETRY;
  const doFetch = options.fetch ?? globalThis.fetch;
  const endpoint = options.endpoint;
  let queue: { event: TelemetryEventName; props?: Record<string, unknown>; sdkVersion: string }[] =
    [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  function flush(): void {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    if (queue.length === 0) return;
    const events = queue.slice(0, BATCH_LIMIT);
    queue = queue.slice(BATCH_LIMIT);
    void doFetch(endpoint, {
      method: "POST",
      keepalive: true,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "x-user-id": "sdk-telemetry",
      },
      body: JSON.stringify({ events }),
    }).catch(() => undefined);
    if (queue.length > 0) flush();
  }

  return {
    emit(event, props) {
      queue.push({ event, ...(props ? { props } : {}), sdkVersion: SDK_VERSION });
      if (queue.length >= BATCH_LIMIT) {
        flush();
        return;
      }
      timer ??= setTimeout(flush, FLUSH_DELAY_MS);
    },
    flush,
  };
}
