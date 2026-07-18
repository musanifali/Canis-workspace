// Server-execution contract whose fetch genuinely honors sort + filter.
// Used by the conformance probe tests (card #49): this one must pass clean.
import { z } from "zod";
import { defineEntity } from "@workspace-engine/core";

const ROWS = [
  { id: "o1", region: "emea", total: 40 },
  { id: "o2", region: "amer", total: 10 },
  { id: "o3", region: "emea", total: 30 },
  { id: "o4", region: "apac", total: 20 },
];

export const ordersContract = defineEntity({
  name: "orders",
  schema: z.object({
    id: z.string().describe("Order id from the commerce system."),
    region: z.enum(["amer", "emea", "apac"]).describe("Sales region: amer, emea, or apac."),
    total: z.number().describe("Order total in dollars."),
  }).describe("A customer order from the commerce system."),
  capabilities: {
    filterable: ["region", "total"],
    sortable: ["total"],
    groupable: ["region"],
    aggregations: { total: ["sum"] },
    defaultLimit: 50,
    maxLimit: 100,
    execution: { filter: "server", sort: "server" },
  },
  fetch: async ({ query }) => {
    let rows = [...ROWS];
    for (const filter of query.filters ?? []) {
      if (filter.op === "eq") rows = rows.filter((r) => r[filter.field] === filter.value);
    }
    for (const sort of [...(query.sort ?? [])].reverse()) {
      rows.sort((a, b) => {
        const cmp = a[sort.field] < b[sort.field] ? -1 : a[sort.field] > b[sort.field] ? 1 : 0;
        return sort.dir === "desc" ? -cmp : cmp;
      });
    }
    return rows;
  },
});

export default [ordersContract];
