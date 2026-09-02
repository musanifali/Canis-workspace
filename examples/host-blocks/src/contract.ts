// The vendor's data contract — unchanged by which components render it.
// The contract is what the gate enforces; components are a separate concern.
import { defineEntity } from "@ticora/core";
import { z } from "zod";

export interface Issue {
  id: string;
  title: string;
  state: "backlog" | "started" | "done";
  assignee: string;
  points: number;
}

const ISSUES: Issue[] = [
  { id: "ENG-101", title: "Flaky checkout test", state: "started", assignee: "ada", points: 3 },
  { id: "ENG-102", title: "Rate-limit the webhook", state: "backlog", assignee: "grace", points: 5 },
  { id: "ENG-103", title: "Ship dark mode", state: "done", assignee: "ada", points: 8 },
  { id: "ENG-104", title: "Upgrade the query planner", state: "backlog", assignee: "linus", points: 13 },
];

export const issueContract = defineEntity({
  name: "issue",
  schema: z.object({
    id: z.string(),
    title: z.string(),
    state: z.enum(["backlog", "started", "done"]),
    assignee: z.string(),
    points: z.number(),
  }),
  capabilities: {
    filterable: ["state", "assignee"],
    sortable: ["points"],
    groupable: ["state", "assignee"],
    aggregations: { points: ["sum", "avg"] },
    defaultLimit: 50,
    maxLimit: 100,
  },
  // Your real fetch hits your API. The end-user's auth is passed through
  // unchanged, so your own authorization still decides what they can see.
  fetch: async () => ISSUES,
});
