/**
 * Relative-date resolution (Workspace Spec v1 §6).
 *
 * Symbolic date tokens (`{ "rel": "this_month" }`) are STORED symbolically in a
 * saved spec and resolved to absolute dates at *execution* time — never at save
 * time. This module is the pure core of that: given a QuerySpec, the current
 * instant, and the workspace timezone, it returns an equivalent QuerySpec with
 * every relative date filter rewritten to `{ "abs": "YYYY-MM-DD" }`. Called
 * inside the React Query `queryFn` (see useBlockQuery), so a workspace saved in
 * January and viewed in July resolves "this_month" to July.
 *
 * Day-precision throughout: a token names a day range in the given zone, so we
 * extract the zone-local calendar date of `now` and do integer calendar math on
 * a UTC anchor (no DST-sensitive time-of-day arithmetic).
 */
import type {
  DateValue,
  Filter,
  QuerySpec,
  RelativeToken,
} from "@workspace-engine/core";

export interface ResolveOptions {
  /** The instant to resolve against — pass `new Date()` at fetch time. */
  now: Date;
  /** Workspace timezone: "viewer" (host locale), "UTC", or an IANA zone. */
  timeZone: string;
}

interface DateCtx {
  y: number;
  m: number; // 1-indexed
  d: number;
}

interface DateRange {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

const DAY_MS = 86_400_000;

/** Resolve all relative date filters in a query to absolute dates. Pure. */
export function resolveQueryDates(
  query: QuerySpec,
  opts: ResolveOptions,
): QuerySpec {
  const zone = effectiveZone(opts.timeZone);
  const ctx = partsInZone(opts.now, zone);
  return { ...query, filters: query.filters.map((f) => resolveFilter(f, ctx)) };
}

/** "viewer" resolves to the host runtime's zone; everything else passes through. */
export function effectiveZone(timeZone: string): string {
  if (timeZone === "viewer") {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  }
  return timeZone;
}

function partsInZone(now: Date, zone: string): DateCtx {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string): number => {
    const part = parts.find((p) => p.type === type);
    return part ? Number(part.value) : Number.NaN;
  };
  return { y: get("year"), m: get("month"), d: get("day") };
}

function resolveFilter(filter: Filter, ctx: DateCtx): Filter {
  switch (filter.op) {
    case "between":
      return { ...filter, value: resolveBetween(filter.value, ctx) };
    case "on":
    case "before":
    case "after":
      return { ...filter, value: resolveAnchor(filter.value, filter.op, ctx) };
    default:
      return filter;
  }
}

type BetweenValue = Extract<Filter, { op: "between" }>["value"];

function resolveBetween(value: BetweenValue, ctx: DateCtx): BetweenValue {
  if (Array.isArray(value)) {
    const [a, b] = value;
    // Numeric ranges are already concrete.
    if (typeof a === "number" || typeof b === "number") return value;
    return [resolveBound(a, "start", ctx), resolveBound(b, "end", ctx)];
  }
  // A single symbolic value means the whole period, e.g. between this_month.
  const range = rangeOfDateValue(value, ctx);
  return [{ abs: range.start }, { abs: range.end }];
}

/** For a two-sided range, the left value snaps to the period start, right to end. */
function resolveBound(
  value: DateValue,
  side: "start" | "end",
  ctx: DateCtx,
): DateValue {
  if ("abs" in value) return value;
  const range = rangeOfToken(value.rel, value.offsetDays ?? 0, ctx);
  return { abs: side === "start" ? range.start : range.end };
}

/** For a single-sided op, `after` snaps to the period end; `on`/`before` to start. */
function resolveAnchor(
  value: DateValue,
  op: "on" | "before" | "after",
  ctx: DateCtx,
): DateValue {
  if ("abs" in value) return value;
  const range = rangeOfToken(value.rel, value.offsetDays ?? 0, ctx);
  return { abs: op === "after" ? range.end : range.start };
}

function rangeOfDateValue(value: DateValue, ctx: DateCtx): DateRange {
  if ("abs" in value) {
    const day = value.abs.slice(0, 10);
    return { start: day, end: day };
  }
  return rangeOfToken(value.rel, value.offsetDays ?? 0, ctx);
}

function rangeOfToken(
  token: RelativeToken,
  offsetDays: number,
  ctx: DateCtx,
): DateRange {
  const anchor = Date.UTC(ctx.y, ctx.m - 1, ctx.d);
  const dow = new Date(anchor).getUTCDay(); // 0=Sun … 6=Sat
  const sinceMonday = (dow + 6) % 7;

  let startMs: number;
  let endMs: number;
  switch (token) {
    case "today":
      startMs = endMs = anchor;
      break;
    case "yesterday":
      startMs = endMs = anchor - DAY_MS;
      break;
    case "tomorrow":
      startMs = endMs = anchor + DAY_MS;
      break;
    case "this_week":
      startMs = anchor - sinceMonday * DAY_MS;
      endMs = startMs + 6 * DAY_MS;
      break;
    case "last_week":
      startMs = anchor - (sinceMonday + 7) * DAY_MS;
      endMs = startMs + 6 * DAY_MS;
      break;
    case "this_month":
      startMs = Date.UTC(ctx.y, ctx.m - 1, 1);
      endMs = Date.UTC(ctx.y, ctx.m, 0); // day 0 of next month = last day
      break;
    case "last_month":
      startMs = Date.UTC(ctx.y, ctx.m - 2, 1);
      endMs = Date.UTC(ctx.y, ctx.m - 1, 0);
      break;
    case "this_quarter": {
      const q = Math.floor((ctx.m - 1) / 3);
      startMs = Date.UTC(ctx.y, q * 3, 1);
      endMs = Date.UTC(ctx.y, q * 3 + 3, 0);
      break;
    }
    case "this_year":
      startMs = Date.UTC(ctx.y, 0, 1);
      endMs = Date.UTC(ctx.y, 11, 31);
      break;
  }

  const shift = offsetDays * DAY_MS;
  return { start: isoDay(startMs + shift), end: isoDay(endMs + shift) };
}

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
