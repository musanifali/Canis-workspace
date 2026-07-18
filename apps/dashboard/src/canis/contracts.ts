/**
 * Canis's own data contracts (#53): the dashboard is a vendor like any other.
 * Three entities over the Workspace Service's public read surface — audit
 * events, flattened spec rejections, and per-workspace usage — declared with
 * `defineEntity` exactly the way the docs tell customers to. The vendor
 * "backend" the fetches call is the typed public client; the in-memory query
 * engine applies filters/sort/aggregations on top, so fetches just return rows.
 */
import { defineEntity, type EntityContract } from "@workspace-engine/core";
import { z } from "zod";

/** The slice of the public client the contracts read (structural, test-fakeable). */
export interface CanisReadClient {
  listAudit(params?: {
    action?: string;
    limit?: number;
  }): Promise<AuditEntryPayload[]>;
  getUsageSummary(): Promise<UsageSummaryPayload>;
  listWorkspaces(): Promise<{ id: string; title: string }[]>;
}

export interface AuditEntryPayload {
  id: string;
  workspaceId?: string | null | undefined;
  actorUserId: string;
  action: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface UsageSummaryPayload {
  month: { generations: number; costCents: number };
  perWorkspace: {
    workspaceId: string | null;
    generations: number;
    costCents: number;
  }[];
}

const auditEventSchema = z.object({
  id: z.string(),
  action: z.string(),
  area: z.enum(["workspace", "contract"]),
  actor: z.string(),
  workspaceId: z.string(),
  at: z.string(),
});
export type AuditEventRow = z.infer<typeof auditEventSchema>;

const specRejectionSchema = z.object({
  id: z.string(),
  at: z.string(),
  actor: z.string(),
  verdict: z.enum(["REJECT", "CLARIFY"]),
  code: z.string(),
  entity: z.string(),
  field: z.string(),
  summary: z.string(),
});
export type SpecRejectionRow = z.infer<typeof specRejectionSchema>;

const usageRowSchema = z.object({
  workspaceId: z.string(),
  title: z.string(),
  generations: z.number(),
  costCents: z.number(),
});
export type UsageRow = z.infer<typeof usageRowSchema>;

/** audit_log payload → audit_event rows. */
export function toAuditEventRows(entries: AuditEntryPayload[]): AuditEventRow[] {
  return entries.map((entry) => ({
    id: entry.id,
    action: entry.action,
    area: entry.action.startsWith("contract.") ? "contract" : "workspace",
    actor: entry.actorUserId,
    workspaceId: entry.workspaceId ?? "(none)",
    at: entry.createdAt,
  }));
}

interface RejectionDetail {
  verdict?: string;
  errors?: { code?: string; entity?: string; field?: string; message?: string }[];
  questions?: { question?: string }[];
}

/**
 * Flatten workspace.spec_rejected entries — one row per validator error (or
 * clarify question), so "top requested but rejected" is a groupBy away.
 */
export function toSpecRejectionRows(
  entries: AuditEntryPayload[],
): SpecRejectionRow[] {
  const rows: SpecRejectionRow[] = [];
  for (const entry of entries) {
    const detail = entry.detail as RejectionDetail;
    const verdict = detail.verdict === "CLARIFY" ? "CLARIFY" : "REJECT";
    const base = { at: entry.createdAt, actor: entry.actorUserId, verdict } as const;
    const errors = detail.errors ?? [];
    const questions = detail.questions ?? [];
    errors.forEach((error, i) => {
      rows.push({
        ...base,
        id: `${entry.id}:${i}`,
        code: error.code ?? "UnknownError",
        entity: error.entity ?? "(spec)",
        field: error.field ?? "(none)",
        summary: error.message ?? "",
      });
    });
    questions.forEach((question, i) => {
      rows.push({
        ...base,
        id: `${entry.id}:q${i}`,
        code: "ClarifyQuestion",
        entity: "(spec)",
        field: "(none)",
        summary: question.question ?? "",
      });
    });
    if (errors.length === 0 && questions.length === 0) {
      rows.push({
        ...base,
        id: entry.id,
        code: "UnknownError",
        entity: "(spec)",
        field: "(none)",
        summary: "",
      });
    }
  }
  return rows;
}

/** usage summary + workspace titles → usage rows. */
export function toUsageRows(
  summary: UsageSummaryPayload,
  workspaces: { id: string; title: string }[],
): UsageRow[] {
  const titles = new Map(workspaces.map((w) => [w.id, w.title]));
  return summary.perWorkspace.map((row) => ({
    workspaceId: row.workspaceId ?? "(unattributed)",
    title: row.workspaceId
      ? (titles.get(row.workspaceId) ?? row.workspaceId)
      : "(unattributed)",
    generations: row.generations,
    costCents: row.costCents,
  }));
}

/**
 * Build the three contracts against a read client. Pages pass the proxied
 * browser client; tests pass a fake; the seed passes a stub (it only needs
 * the declarative surface via serializeContract — fetch is never stored).
 */
export function createCanisContracts(client: CanisReadClient): EntityContract[] {
  const auditEvent = defineEntity({
    name: "audit_event",
    schema: auditEventSchema,
    fieldKinds: { at: "datetime" },
    capabilities: {
      filterable: ["action", "area", "actor", "workspaceId", "at"],
      sortable: ["at"],
      groupable: ["action", "area", "actor"],
      aggregations: {},
      defaultLimit: 100,
      maxLimit: 500,
    },
    fetch: async () => toAuditEventRows(await client.listAudit({ limit: 500 })),
  });

  const specRejection = defineEntity({
    name: "spec_rejection",
    schema: specRejectionSchema,
    fieldKinds: { at: "datetime" },
    capabilities: {
      filterable: ["verdict", "code", "entity", "field", "actor", "at"],
      sortable: ["at"],
      groupable: ["verdict", "code", "entity", "field"],
      aggregations: {},
      defaultLimit: 100,
      maxLimit: 500,
    },
    fetch: async () =>
      toSpecRejectionRows(
        await client.listAudit({ action: "workspace.spec_rejected", limit: 500 }),
      ),
  });

  const usageRow = defineEntity({
    name: "usage_row",
    schema: usageRowSchema,
    capabilities: {
      filterable: ["title", "workspaceId"],
      sortable: ["generations", "costCents"],
      groupable: ["title"],
      aggregations: {
        generations: ["sum", "avg", "max"],
        costCents: ["sum", "avg", "max"],
      },
      defaultLimit: 100,
      maxLimit: 500,
    },
    fetch: async () => {
      const [summary, workspaces] = await Promise.all([
        client.getUsageSummary(),
        client.listWorkspaces(),
      ]);
      return toUsageRows(summary, workspaces);
    },
  });

  return [auditEvent, specRejection, usageRow];
}
