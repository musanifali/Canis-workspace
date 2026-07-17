/**
 * Per-tenant cost controls (#48). Generation events are the only thing that
 * costs money — the two-phase design means saved workspaces cost ZERO at
 * read time, so reads are never metered here. Budgets are per calendar
 * month per tenant; rate limits are per user per minute.
 */
import { and, count, eq, gte, sql, sum } from "drizzle-orm";
import {
  tenants,
  usageEvents,
  type DBUsageEvent,
} from "../schema.js";
import type { WorkspaceDb } from "../client.js";
import type { TenantContext, TenantTx } from "../tenant.js";

export type GenerationDenialReason = "budget_exceeded" | "rate_limited";

/** Thrown when a generation is recorded against an exhausted allowance. */
export class GenerationLimitError extends Error {
  constructor(readonly reason: GenerationDenialReason, message: string) {
    super(message);
    this.name = "GenerationLimitError";
  }
}

export interface GenerationAllowance {
  allowed: boolean;
  reason?: GenerationDenialReason;
  /** Generations left this month; null = unlimited budget. */
  remainingThisMonth: number | null;
  /** Generations left in the current per-user minute window. */
  remainingThisMinute: number;
}

/**
 * Check whether the acting user may run a generation right now. UIs call
 * this to disable/explain the affordance BEFORE burning a model call —
 * budget exhaustion is a clear state, never a silent failure.
 * @returns The allowance with remaining headroom.
 */
export async function getGenerationAllowance(
  tx: TenantTx,
  ctx: TenantContext,
): Promise<GenerationAllowance> {
  const [tenant] = await tx
    .select({
      budget: tenants.monthlyGenerationBudget,
      ratePerMinute: tenants.generationRatePerMinute,
    })
    .from(tenants)
    .where(eq(tenants.id, ctx.tenantId));
  if (!tenant) {
    throw new Error(`tenant "${ctx.tenantId}" not visible — withTenant missing?`);
  }

  const [monthRow] = await tx
    .select({ used: count() })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.kind, "generation"),
        gte(usageEvents.createdAt, sql`date_trunc('month', now())`),
      ),
    );
  const usedThisMonth = monthRow?.used ?? 0;

  const [minuteRow] = await tx
    .select({ used: count() })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.kind, "generation"),
        eq(usageEvents.userId, ctx.userId),
        gte(usageEvents.createdAt, sql`now() - interval '1 minute'`),
      ),
    );
  const usedThisMinute = minuteRow?.used ?? 0;

  const remainingThisMonth =
    tenant.budget === null ? null : Math.max(0, tenant.budget - usedThisMonth);
  const remainingThisMinute = Math.max(
    0,
    tenant.ratePerMinute - usedThisMinute,
  );

  if (remainingThisMonth !== null && remainingThisMonth === 0) {
    return {
      allowed: false,
      reason: "budget_exceeded",
      remainingThisMonth,
      remainingThisMinute,
    };
  }
  if (remainingThisMinute === 0) {
    return {
      allowed: false,
      reason: "rate_limited",
      remainingThisMonth,
      remainingThisMinute,
    };
  }
  return { allowed: true, remainingThisMonth, remainingThisMinute };
}

export interface RecordGenerationParams {
  workspaceId?: string | undefined;
  costCents?: number | undefined;
}

/**
 * Record one generation event, enforcing budget + rate limit first.
 * @returns The event and the post-event allowance.
 * @throws {GenerationLimitError} When the allowance is exhausted.
 */
export async function recordGenerationUsage(
  tx: TenantTx,
  ctx: TenantContext,
  params: RecordGenerationParams = {},
): Promise<{ event: DBUsageEvent; allowance: GenerationAllowance }> {
  const before = await getGenerationAllowance(tx, ctx);
  if (!before.allowed) {
    const message =
      before.reason === "budget_exceeded"
        ? "the tenant's monthly generation budget is exhausted"
        : "per-user generation rate limit reached — try again in a minute";
    throw new GenerationLimitError(before.reason as GenerationDenialReason, message);
  }

  const [event] = await tx
    .insert(usageEvents)
    .values({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      kind: "generation",
      workspaceId: params.workspaceId ?? null,
      costCents: params.costCents ?? 0,
    })
    .returning();
  if (!event) {
    throw new Error("Failed to record generation usage");
  }
  return { event, allowance: await getGenerationAllowance(tx, ctx) };
}

export interface UsageSummary {
  month: { generations: number; costCents: number };
  perWorkspace: {
    workspaceId: string | null;
    generations: number;
    costCents: number;
  }[];
  /** Saved workspaces cost nothing to open — reads are never metered. */
  readCostCents: 0;
}

/**
 * The tenant's cost picture for the current month: totals plus a
 * per-workspace breakdown (the vendor dashboard's data source).
 * @returns The usage summary.
 */
export async function getUsageSummary(tx: TenantTx): Promise<UsageSummary> {
  const monthWindow = gte(
    usageEvents.createdAt,
    sql`date_trunc('month', now())`,
  );
  const rows = await tx
    .select({
      workspaceId: usageEvents.workspaceId,
      generations: count(),
      costCents: sum(usageEvents.costCents),
    })
    .from(usageEvents)
    .where(and(eq(usageEvents.kind, "generation"), monthWindow))
    .groupBy(usageEvents.workspaceId);

  const perWorkspace = rows.map((row) => ({
    workspaceId: row.workspaceId,
    generations: row.generations,
    costCents: Number(row.costCents ?? 0),
  }));
  return {
    month: {
      generations: perWorkspace.reduce((total, w) => total + w.generations, 0),
      costCents: perWorkspace.reduce((total, w) => total + w.costCents, 0),
    },
    perWorkspace,
    readCostCents: 0,
  };
}

/**
 * Set a tenant's limits (admin operation, owner connection).
 * @returns The updated tenant row's limits.
 */
export async function setTenantLimits(
  db: WorkspaceDb,
  tenantId: string,
  limits: {
    monthlyGenerationBudget?: number | null;
    generationRatePerMinute?: number;
  },
): Promise<{ monthlyGenerationBudget: number | null; generationRatePerMinute: number }> {
  const [updated] = await db
    .update(tenants)
    .set({
      ...(limits.monthlyGenerationBudget !== undefined
        ? { monthlyGenerationBudget: limits.monthlyGenerationBudget }
        : {}),
      ...(limits.generationRatePerMinute !== undefined
        ? { generationRatePerMinute: limits.generationRatePerMinute }
        : {}),
    })
    .where(eq(tenants.id, tenantId))
    .returning({
      monthlyGenerationBudget: tenants.monthlyGenerationBudget,
      generationRatePerMinute: tenants.generationRatePerMinute,
    });
  if (!updated) {
    throw new Error(`tenant not found: "${tenantId}"`);
  }
  return updated;
}
