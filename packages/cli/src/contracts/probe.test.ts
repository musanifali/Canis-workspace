import { defineEntity } from "@workspace-engine/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { probeContracts } from "./probe.js";

const ROWS = [
  { id: "o1", region: "emea", total: 40, placed: "2026-07-01" },
  { id: "o2", region: "amer", total: 10, placed: "2026-07-02" },
  { id: "o3", region: "emea", total: 30, placed: "2026-07-03" },
];

type Query = {
  filters?: { field: string; op: string; value: unknown }[];
  sort?: { field: string; dir: string }[];
};

function ordersContract(options: {
  honor: boolean;
  execution?: Record<string, "client" | "server">;
  rows?: typeof ROWS;
}) {
  return defineEntity({
    name: "orders",
    schema: z.object({
      id: z.string(),
      region: z.enum(["amer", "emea", "apac"]),
      total: z.number(),
      placed: z.string(),
    }),
    fieldKinds: { placed: "date" },
    capabilities: {
      filterable: ["region", "placed"],
      sortable: ["total"],
      groupable: ["region"],
      aggregations: { total: ["sum"] },
      defaultLimit: 50,
      maxLimit: 100,
      execution: options.execution ?? { filter: "server", sort: "server" },
    },
    fetch: async ({ query }) => {
      const rows = [...(options.rows ?? ROWS)];
      if (!options.honor) return rows;
      const q = query as Query;
      let out = rows;
      for (const f of q.filters ?? []) {
        if (f.op === "eq")
          out = out.filter((r) => (r as Record<string, unknown>)[f.field] === f.value);
      }
      for (const s of [...(q.sort ?? [])].reverse()) {
        out = [...out].sort((a, b) => {
          const av = (a as Record<string, unknown>)[s.field] as number;
          const bv = (b as Record<string, unknown>)[s.field] as number;
          return s.dir === "desc" ? bv - av : av - bv;
        });
      }
      return out;
    },
  });
}

describe("probeContracts", () => {
  it("passes a fetch that honors server-mode sort and filter", async () => {
    const findings = await probeContracts([ordersContract({ honor: true })]);
    expect(findings).toEqual([]);
  });

  it("flags declared-but-unimplemented server sort and filter", async () => {
    const findings = await probeContracts([ordersContract({ honor: false })]);
    const codes = findings.map((f) => f.code).sort();
    expect(codes).toContain("server_sort_unimplemented");
    expect(codes).toContain("server_filter_unimplemented");
    const sortFinding = findings.find((f) => f.code === "server_sort_unimplemented");
    expect(sortFinding?.field).toBe("total");
    expect(sortFinding?.severity).toBe("error");
  });

  it("skips date-kind fields for filter probes (eq is not in their grammar)", async () => {
    const findings = await probeContracts([ordersContract({ honor: false })]);
    expect(
      findings.some((f) => f.code === "server_filter_unimplemented" && f.field === "placed"),
    ).toBe(false);
  });

  it("does not probe client-mode contracts at all (engine enforces them)", async () => {
    let called = 0;
    const contract = defineEntity({
      name: "orders",
      schema: z.object({ id: z.string(), total: z.number() }),
      capabilities: {
        filterable: ["total"],
        sortable: ["total"],
        groupable: [],
        aggregations: {},
        defaultLimit: 50,
        maxLimit: 100,
      },
      fetch: async () => {
        called++;
        return ROWS;
      },
    });
    const findings = await probeContracts([contract]);
    expect(findings).toEqual([]);
    expect(called).toBe(0);
  });

  it("warns instead of guessing when there are too few rows to verify", async () => {
    const findings = await probeContracts([
      ordersContract({ honor: false, rows: ROWS.slice(0, 1) }),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.code).toBe("probe_insufficient_rows");
    expect(findings[0]?.severity).toBe("warning");
  });

  it("warns that server group/aggregate cannot be auto-probed", async () => {
    const findings = await probeContracts([
      ordersContract({
        honor: true,
        execution: { filter: "client", sort: "client", group: "server", aggregate: "server" },
      }),
    ]);
    const codes = findings.map((f) => f.code);
    expect(codes.filter((c) => c === "probe_unverified_server_op")).toHaveLength(2);
  });

  it("surfaces a throwing fetch as a probe error, not a crash", async () => {
    const contract = defineEntity({
      name: "orders",
      schema: z.object({ id: z.string(), total: z.number() }),
      capabilities: {
        filterable: [],
        sortable: ["total"],
        groupable: [],
        aggregations: {},
        defaultLimit: 50,
        maxLimit: 100,
        execution: { sort: "server" },
      },
      fetch: async () => {
        throw new Error("upstream 500");
      },
    });
    const findings = await probeContracts([contract]);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ code: "probe_fetch_failed", severity: "error" });
    expect(findings[0]?.message).toContain("upstream 500");
  });

  it("passes the --auth value through to the vendor fetch", async () => {
    let seenAuth: unknown = undefined;
    const contract = defineEntity({
      name: "orders",
      schema: z.object({ id: z.string(), total: z.number() }),
      capabilities: {
        filterable: [],
        sortable: ["total"],
        groupable: [],
        aggregations: {},
        defaultLimit: 50,
        maxLimit: 100,
        execution: { sort: "server" },
      },
      fetch: async ({ auth }) => {
        seenAuth = auth;
        return [
          { id: "a", total: 1 },
          { id: "b", total: 2 },
        ];
      },
    });
    await probeContracts([contract], { auth: { token: "t0" } });
    expect(seenAuth).toEqual({ token: "t0" });
  });
});
