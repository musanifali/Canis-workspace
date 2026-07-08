import { describe, expect, it } from "vitest";
import { parseSpec, type Filter, type QuerySpec } from "@workspace-engine/core";
import { resolveQueryDates } from "./resolve-dates";

/** Build a QuerySpec around one filter, through the real schema. */
function queryWith(filter: Filter): QuerySpec {
  const spec = parseSpec({
    specVersion: 1,
    title: "t",
    blocks: [
      {
        id: "blk_a1",
        type: "CasesTable",
        frame: { x: 0, y: 0, w: 6, h: 4 },
        binding: { entity: "case", query: { filters: [filter] } },
      },
    ],
  });
  return spec.blocks[0]!.binding!.query;
}

const UTC = { timeZone: "UTC" as const };

describe("resolveQueryDates", () => {
  it("resolves this_month to the month's first and last day at fetch time", () => {
    const q = queryWith({ field: "due", op: "between", value: { rel: "this_month" } });
    const resolved = resolveQueryDates(q, { now: new Date("2026-07-09T10:00:00Z"), ...UTC });
    expect(resolved.filters[0]).toEqual({
      field: "due",
      op: "between",
      value: [{ abs: "2026-07-01" }, { abs: "2026-07-31" }],
    });
  });

  it("resolves the SAME symbolic query differently as the clock moves (not save-time)", () => {
    const q = queryWith({ field: "due", op: "between", value: { rel: "this_month" } });
    const jan = resolveQueryDates(q, { now: new Date("2026-01-15T12:00:00Z"), ...UTC });
    const jul = resolveQueryDates(q, { now: new Date("2026-07-15T12:00:00Z"), ...UTC });
    expect(jan.filters[0]).toEqual({
      field: "due",
      op: "between",
      value: [{ abs: "2026-01-01" }, { abs: "2026-01-31" }],
    });
    expect(jul.filters[0]).toEqual({
      field: "due",
      op: "between",
      value: [{ abs: "2026-07-01" }, { abs: "2026-07-31" }],
    });
  });

  it("resolves today/yesterday/tomorrow to single days", () => {
    const now = new Date("2026-07-09T08:00:00Z");
    const on = (rel: "today" | "yesterday" | "tomorrow") =>
      resolveQueryDates(queryWith({ field: "due", op: "on", value: { rel } }), {
        now,
        ...UTC,
      }).filters[0];
    expect(on("today")).toMatchObject({ value: { abs: "2026-07-09" } });
    expect(on("yesterday")).toMatchObject({ value: { abs: "2026-07-08" } });
    expect(on("tomorrow")).toMatchObject({ value: { abs: "2026-07-10" } });
  });

  it("snaps before→period start and after→period end for single-sided ops", () => {
    const now = new Date("2026-07-09T00:00:00Z");
    const before = resolveQueryDates(
      queryWith({ field: "due", op: "before", value: { rel: "this_month" } }),
      { now, ...UTC },
    ).filters[0];
    const after = resolveQueryDates(
      queryWith({ field: "due", op: "after", value: { rel: "this_month" } }),
      { now, ...UTC },
    ).filters[0];
    expect(before).toMatchObject({ value: { abs: "2026-07-01" } });
    expect(after).toMatchObject({ value: { abs: "2026-07-31" } });
  });

  it("uses Monday-anchored weeks", () => {
    // 2026-07-09 is a Thursday → this_week is Mon 07-06 … Sun 07-12.
    const q = queryWith({ field: "due", op: "between", value: { rel: "this_week" } });
    const resolved = resolveQueryDates(q, { now: new Date("2026-07-09T00:00:00Z"), ...UTC });
    expect(resolved.filters[0]).toMatchObject({
      value: [{ abs: "2026-07-06" }, { abs: "2026-07-12" }],
    });
  });

  it("applies offsetDays", () => {
    const q = queryWith({ field: "due", op: "on", value: { rel: "today", offsetDays: 7 } });
    const resolved = resolveQueryDates(q, { now: new Date("2026-07-09T00:00:00Z"), ...UTC });
    expect(resolved.filters[0]).toMatchObject({ value: { abs: "2026-07-16" } });
  });

  it("resolves quarter and year boundaries", () => {
    const now = new Date("2026-07-09T00:00:00Z"); // Q3
    const quarter = resolveQueryDates(
      queryWith({ field: "due", op: "between", value: { rel: "this_quarter" } }),
      { now, ...UTC },
    ).filters[0];
    const year = resolveQueryDates(
      queryWith({ field: "due", op: "between", value: { rel: "this_year" } }),
      { now, ...UTC },
    ).filters[0];
    expect(quarter).toMatchObject({ value: [{ abs: "2026-07-01" }, { abs: "2026-09-30" }] });
    expect(year).toMatchObject({ value: [{ abs: "2026-01-01" }, { abs: "2026-12-31" }] });
  });

  it("leaves absolute dates and non-date filters untouched", () => {
    const abs = resolveQueryDates(
      queryWith({ field: "due", op: "on", value: { abs: "2026-03-04" } }),
      { now: new Date("2026-07-09T00:00:00Z"), ...UTC },
    ).filters[0];
    expect(abs).toMatchObject({ value: { abs: "2026-03-04" } });

    const scalar = resolveQueryDates(
      queryWith({ field: "status", op: "eq", value: "open" }),
      { now: new Date("2026-07-09T00:00:00Z"), ...UTC },
    ).filters[0];
    expect(scalar).toEqual({ field: "status", op: "eq", value: "open" });
  });

  it("resolves last_month across a year boundary", () => {
    const q = queryWith({ field: "due", op: "between", value: { rel: "last_month" } });
    const resolved = resolveQueryDates(q, { now: new Date("2026-01-15T00:00:00Z"), ...UTC });
    expect(resolved.filters[0]).toMatchObject({
      value: [{ abs: "2025-12-01" }, { abs: "2025-12-31" }],
    });
  });
});
