// Server-execution contract whose fetch IGNORES query entirely — declared
// sortable/filterable with execution "server" but unimplemented. The probe
// must flag both (card #49: "declared sortable but sort unimplemented").
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
    filterable: ["region"],
    sortable: ["total"],
    groupable: ["region"],
    aggregations: { total: ["sum"] },
    defaultLimit: 50,
    maxLimit: 100,
    execution: { filter: "server", sort: "server" },
  },
  fetch: async () => ROWS,
});

export default [ordersContract];
