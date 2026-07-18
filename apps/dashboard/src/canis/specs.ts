/**
 * The dashboard's analytics views, written as Workspace Specs (#31 + #53) —
 * not bespoke pages. They are validated by the same validateSpec as any
 * vendor spec (see canis.test.ts), saved to the Phase 4 service by the seed,
 * and rendered by WorkspaceRenderer + the default block set.
 */
import { parseSpec, type WorkspaceSpec } from "@workspace-engine/core";

export interface DashboardView {
  /** Stable slug the seed uses to find-or-create by title. */
  slug: string;
  spec: WorkspaceSpec;
}

const auditActivity = parseSpec({
  specVersion: 1,
  title: "Audit activity",
  timezone: "viewer",
  refresh: { mode: "manual" },
  layout: { columns: 12 },
  blocks: [
    {
      id: "blk_kpi",
      type: "KpiCards",
      frame: { x: 0, y: 0, w: 12, h: 2 },
      config: { cards: [{ alias: "events", label: "Audit events" }] },
      binding: {
        entity: "audit_event",
        query: { aggregations: [{ fn: "count", alias: "events" }] },
      },
    },
    {
      id: "blk_byaction",
      type: "Graph",
      frame: { x: 0, y: 2, w: 6, h: 4 },
      config: { title: "Events by action", kind: "bar" },
      binding: {
        entity: "audit_event",
        query: {
          groupBy: "action",
          aggregations: [{ fn: "count", alias: "n" }],
        },
      },
    },
    {
      id: "blk_byactor",
      type: "Graph",
      frame: { x: 6, y: 2, w: 6, h: 4 },
      config: { title: "Events by actor", kind: "bar" },
      binding: {
        entity: "audit_event",
        query: {
          groupBy: "actor",
          aggregations: [{ fn: "count", alias: "n" }],
        },
      },
    },
    {
      id: "blk_recent",
      type: "CasesTable",
      frame: { x: 0, y: 6, w: 12, h: 5 },
      config: {
        title: "Recent activity",
        columns: ["action", "area", "actor", "workspaceId", "at"],
      },
      binding: {
        entity: "audit_event",
        query: { sort: [{ field: "at", dir: "desc" }], limit: 50 },
      },
    },
  ],
});

const rejectedCapabilities = parseSpec({
  specVersion: 1,
  title: "Rejected capabilities",
  timezone: "viewer",
  refresh: { mode: "manual" },
  layout: { columns: 12 },
  blocks: [
    {
      id: "blk_kpi",
      type: "KpiCards",
      frame: { x: 0, y: 0, w: 12, h: 2 },
      config: {
        cards: [{ alias: "refused", label: "Refused saves", intent: "negative" }],
      },
      binding: {
        entity: "spec_rejection",
        query: { aggregations: [{ fn: "count", alias: "refused" }] },
      },
    },
    {
      id: "blk_byentity",
      type: "Graph",
      frame: { x: 0, y: 2, w: 6, h: 4 },
      config: { title: "Top requested but rejected — by entity", kind: "bar" },
      binding: {
        entity: "spec_rejection",
        query: {
          groupBy: "entity",
          aggregations: [{ fn: "count", alias: "n" }],
        },
      },
    },
    {
      id: "blk_bycode",
      type: "Graph",
      frame: { x: 6, y: 2, w: 6, h: 4 },
      config: { title: "By error code", kind: "bar" },
      binding: {
        entity: "spec_rejection",
        query: {
          groupBy: "code",
          aggregations: [{ fn: "count", alias: "n" }],
        },
      },
    },
    {
      id: "blk_detail",
      type: "CasesTable",
      frame: { x: 0, y: 6, w: 12, h: 5 },
      config: {
        title: "What was asked for and refused",
        columns: ["entity", "field", "code", "summary", "at"],
      },
      binding: {
        entity: "spec_rejection",
        query: { sort: [{ field: "at", dir: "desc" }], limit: 50 },
      },
    },
  ],
});

const usageAndCost = parseSpec({
  specVersion: 1,
  title: "Usage & cost",
  timezone: "viewer",
  refresh: { mode: "manual" },
  layout: { columns: 12 },
  blocks: [
    {
      id: "blk_kpi",
      type: "KpiCards",
      frame: { x: 0, y: 0, w: 12, h: 2 },
      config: {
        cards: [
          { alias: "total_generations", label: "Generations (month)" },
          { alias: "total_cost", label: "Cost (cents)" },
        ],
      },
      binding: {
        entity: "usage_row",
        query: {
          aggregations: [
            { fn: "sum", field: "generations", alias: "total_generations" },
            { fn: "sum", field: "costCents", alias: "total_cost" },
          ],
        },
      },
    },
    {
      id: "blk_costbyws",
      type: "Graph",
      frame: { x: 0, y: 2, w: 12, h: 4 },
      config: { title: "Cost by workspace", kind: "bar" },
      binding: {
        entity: "usage_row",
        query: {
          groupBy: "title",
          aggregations: [{ fn: "sum", field: "costCents", alias: "cost" }],
        },
      },
    },
    {
      id: "blk_table",
      type: "CasesTable",
      frame: { x: 0, y: 6, w: 12, h: 5 },
      config: {
        title: "Per workspace",
        columns: ["title", "generations", "costCents"],
      },
      binding: {
        entity: "usage_row",
        query: { sort: [{ field: "costCents", dir: "desc" }], limit: 50 },
      },
    },
  ],
});

export const dashboardViews: DashboardView[] = [
  { slug: "audit-activity", spec: auditActivity },
  { slug: "rejected-capabilities", spec: rejectedCapabilities },
  { slug: "usage-and-cost", spec: usageAndCost },
];
