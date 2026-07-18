/**
 * The dogfooding gate (#53): every dashboard view must be a BUILD under the
 * same validateSpec any vendor spec faces, against Canis's own contracts.
 * Plus the row mappers the contract fetches use.
 */
import { parseSpec, validateSpec } from "@workspace-engine/core";
import { describe, expect, it } from "vitest";
import {
  createCanisContracts,
  toAuditEventRows,
  toSpecRejectionRows,
  toUsageRows,
  type CanisReadClient,
} from "./contracts.js";
import { dashboardViews } from "./specs.js";

const stubClient: CanisReadClient = {
  listAudit: async () => [],
  getUsageSummary: async () => ({
    month: { generations: 0, costCents: 0 },
    perWorkspace: [],
  }),
  listWorkspaces: async () => [],
};

const contracts = Object.fromEntries(
  createCanisContracts(stubClient).map((c) => [c.name, c]),
);

describe("dashboard views are validated workspaces", () => {
  for (const view of dashboardViews) {
    it(`"${view.spec.title}" gets a BUILD verdict`, () => {
      const result = validateSpec(view.spec, { contracts });
      expect(result.verdict).toBe("BUILD");
    });
  }

  it("the same gate refuses a view outside the contracts (control)", () => {
    const bad = parseSpec({
      specVersion: 1,
      title: "Off contract",
      timezone: "viewer",
      blocks: [
        {
          id: "blk_x",
          type: "CasesTable",
          frame: { x: 0, y: 0, w: 6, h: 4 },
          config: {},
          binding: { entity: "invoice", query: {} },
        },
      ],
    });
    const result = validateSpec(bad, { contracts });
    expect(result.verdict).toBe("REJECT");
  });
});

describe("row mappers", () => {
  it("maps audit entries and derives the area", () => {
    const rows = toAuditEventRows([
      {
        id: "1",
        workspaceId: "ws_a",
        actorUserId: "user_x",
        action: "workspace.created",
        detail: {},
        createdAt: "2026-07-18T10:00:00.000Z",
      },
      {
        id: "2",
        workspaceId: null,
        actorUserId: "user_x",
        action: "contract.registered",
        detail: { entityName: "case" },
        createdAt: "2026-07-18T10:01:00.000Z",
      },
    ]);
    expect(rows[0]).toMatchObject({ area: "workspace", workspaceId: "ws_a" });
    expect(rows[1]).toMatchObject({ area: "contract", workspaceId: "(none)" });
  });

  it("flattens one rejection entry into one row per validator error", () => {
    const rows = toSpecRejectionRows([
      {
        id: "9",
        workspaceId: null,
        actorUserId: "user_x",
        action: "workspace.spec_rejected",
        detail: {
          verdict: "REJECT",
          errors: [
            {
              code: "UnknownEntityError",
              entity: "invoice",
              message: 'unknown entity "invoice"',
            },
            {
              code: "ContractViolationError",
              entity: "case",
              field: "sla_deadline",
              message: "field is not filterable",
            },
          ],
        },
        createdAt: "2026-07-18T10:02:00.000Z",
      },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "9:0",
      verdict: "REJECT",
      code: "UnknownEntityError",
      entity: "invoice",
      field: "(none)",
    });
    expect(rows[1]).toMatchObject({
      code: "ContractViolationError",
      entity: "case",
      field: "sla_deadline",
    });
  });

  it("turns clarify questions into rows too", () => {
    const rows = toSpecRejectionRows([
      {
        id: "10",
        workspaceId: null,
        actorUserId: "user_x",
        action: "workspace.spec_rejected",
        detail: {
          verdict: "CLARIFY",
          questions: [{ question: "Which date field did you mean?" }],
        },
        createdAt: "2026-07-18T10:03:00.000Z",
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      verdict: "CLARIFY",
      code: "ClarifyQuestion",
      summary: "Which date field did you mean?",
    });
  });

  it("joins usage rows to workspace titles and names the unattributed bucket", () => {
    const rows = toUsageRows(
      {
        month: { generations: 5, costCents: 60 },
        perWorkspace: [
          { workspaceId: "ws_a", generations: 3, costCents: 36 },
          { workspaceId: null, generations: 2, costCents: 24 },
        ],
      },
      [{ id: "ws_a", title: "Audit activity" }],
    );
    expect(rows[0]).toMatchObject({ title: "Audit activity", costCents: 36 });
    expect(rows[1]).toMatchObject({
      workspaceId: "(unattributed)",
      title: "(unattributed)",
    });
  });

  it("mapped rows satisfy the contract schemas (fetch → engine handoff)", async () => {
    const client: CanisReadClient = {
      listAudit: async (params) =>
        params?.action === "workspace.spec_rejected"
          ? [
              {
                id: "9",
                workspaceId: null,
                actorUserId: "u",
                action: "workspace.spec_rejected",
                detail: { verdict: "REJECT", errors: [{ code: "X", message: "m" }] },
                createdAt: "2026-07-18T10:00:00.000Z",
              },
            ]
          : [
              {
                id: "1",
                workspaceId: "ws_a",
                actorUserId: "u",
                action: "workspace.created",
                detail: {},
                createdAt: "2026-07-18T10:00:00.000Z",
              },
            ],
      getUsageSummary: async () => ({
        month: { generations: 1, costCents: 12 },
        perWorkspace: [{ workspaceId: "ws_a", generations: 1, costCents: 12 }],
      }),
      listWorkspaces: async () => [{ id: "ws_a", title: "Audit activity" }],
    };
    for (const contract of createCanisContracts(client)) {
      const rows = await contract.fetch({
        query: { filters: [], sort: [] },
        auth: null,
      });
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(() => contract.schema.parse(row)).not.toThrow();
      }
    }
  });
});
