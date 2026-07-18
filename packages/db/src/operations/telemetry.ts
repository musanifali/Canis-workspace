/**
 * Anonymous SDK telemetry (card #52, decision D5). Runs on the service
 * connection WITHOUT a tenant context on purpose: the table has no tenant or
 * user columns, and the documented payload schema is aggregate-only. Writes
 * are append-only; reads are aggregates.
 */
import { count, desc, sql } from "drizzle-orm";
import { telemetryEvents, type DBTelemetryEvent } from "../schema.js";
import type { WorkspaceDb } from "../client.js";

export interface TelemetryEventInput {
  event: string;
  props?: Record<string, unknown> | undefined;
  sdkVersion?: string | undefined;
}

/**
 * Append a batch of anonymous telemetry events.
 * @returns The inserted rows.
 */
export async function recordTelemetryEvents(
  db: WorkspaceDb,
  events: readonly TelemetryEventInput[],
): Promise<DBTelemetryEvent[]> {
  if (events.length === 0) return [];
  return await db
    .insert(telemetryEvents)
    .values(
      events.map((event) => ({
        event: event.event,
        props: event.props ?? {},
        sdkVersion: event.sdkVersion ?? null,
      })),
    )
    .returning();
}

export interface TelemetrySummary {
  /** Integration-step funnel: how many times each event fired. */
  byEvent: { event: string; count: number }[];
  /** block.degraded events broken down by reason (error-taxonomy view). */
  degradedByReason: { reason: string; count: number }[];
}

/**
 * Aggregate view for the internal dashboard: event funnel + degradation
 * reasons. Raw rows are never returned by the API surface.
 * @returns The summary.
 */
export async function getTelemetrySummary(db: WorkspaceDb): Promise<TelemetrySummary> {
  const byEvent = await db
    .select({ event: telemetryEvents.event, count: count() })
    .from(telemetryEvents)
    .groupBy(telemetryEvents.event)
    .orderBy(desc(count()));

  const reasonExpr = sql<string>`coalesce(${telemetryEvents.props} ->> 'reason', '(none)')`;
  const degradedByReason = await db
    .select({ reason: reasonExpr, count: count() })
    .from(telemetryEvents)
    .where(sql`${telemetryEvents.event} = 'block.degraded'`)
    .groupBy(reasonExpr)
    .orderBy(desc(count()));

  return {
    byEvent: byEvent.map((row) => ({ event: row.event, count: Number(row.count) })),
    degradedByReason: degradedByReason.map((row) => ({
      reason: row.reason,
      count: Number(row.count),
    })),
  };
}
