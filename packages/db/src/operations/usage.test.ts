/**
 * #48's guarantees at the operations layer: budgets and rate limits are
 * enforced with named reasons (never a silent failure), the summary breaks
 * cost down per workspace, and reads never appear in the ledger.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { WorkspaceDbClient } from "../client.js";
import { withTenant, type TenantContext } from "../tenant.js";
import {
  buildVerdict,
  connectTestDb,
  createTestTenant,
  specFixture,
} from "../test-helpers.js";
import {
  GenerationLimitError,
  getGenerationAllowance,
  getUsageSummary,
  recordGenerationUsage,
  setTenantLimits,
} from "./usage.js";
import { createWorkspace, getWorkspace } from "./workspaces.js";

let client: WorkspaceDbClient;

async function freshTenant(limits?: {
  monthlyGenerationBudget?: number | null;
  generationRatePerMinute?: number;
}): Promise<{ tenantId: string; ctx: TenantContext }> {
  const seeded = await createTestTenant(client, "Usage Tenant");
  if (limits) {
    await setTenantLimits(client.db, seeded.tenantId, limits);
  }
  return seeded;
}

beforeAll(async () => {
  client = await connectTestDb();
});

afterAll(async () => {
  await client?.close();
});

describe("generation budget", () => {
  it("counts down and blocks with budget_exceeded at zero", async () => {
    const { ctx } = await freshTenant({ monthlyGenerationBudget: 2 });

    const first = await withTenant(client.db, ctx, (tx) =>
      recordGenerationUsage(tx, ctx, { costCents: 3 }),
    );
    expect(first.allowance.remainingThisMonth).toBe(1);

    await withTenant(client.db, ctx, (tx) => recordGenerationUsage(tx, ctx));

    const exhausted = await withTenant(client.db, ctx, (tx) =>
      getGenerationAllowance(tx, ctx),
    );
    expect(exhausted).toMatchObject({
      allowed: false,
      reason: "budget_exceeded",
      remainingThisMonth: 0,
    });

    await expect(
      withTenant(client.db, ctx, (tx) => recordGenerationUsage(tx, ctx)),
    ).rejects.toThrow(GenerationLimitError);
  });

  it("null budget means unlimited", async () => {
    const { ctx } = await freshTenant();
    const allowance = await withTenant(client.db, ctx, (tx) =>
      getGenerationAllowance(tx, ctx),
    );
    expect(allowance.allowed).toBe(true);
    expect(allowance.remainingThisMonth).toBeNull();
  });
});

describe("per-user rate limit", () => {
  it("blocks the noisy user with rate_limited but not their teammate", async () => {
    const seeded = await freshTenant({ generationRatePerMinute: 2 });
    const noisy = seeded.ctx;
    const teammate: TenantContext = {
      tenantId: seeded.tenantId,
      userId: "user_quiet",
    };

    await withTenant(client.db, noisy, (tx) => recordGenerationUsage(tx, noisy));
    await withTenant(client.db, noisy, (tx) => recordGenerationUsage(tx, noisy));

    const blocked = await withTenant(client.db, noisy, (tx) =>
      getGenerationAllowance(tx, noisy),
    );
    expect(blocked).toMatchObject({
      allowed: false,
      reason: "rate_limited",
      remainingThisMinute: 0,
    });

    const other = await withTenant(client.db, teammate, (tx) =>
      getGenerationAllowance(tx, teammate),
    );
    expect(other.allowed).toBe(true);
  });
});

describe("cost visibility", () => {
  it("summarizes the month per workspace, with reads costing zero", async () => {
    const { ctx } = await freshTenant();
    const { workspace } = await withTenant(client.db, ctx, (tx) =>
      createWorkspace(tx, ctx, {
        spec: specFixture("Costed board"),
        verdict: buildVerdict,
      }),
    );

    await withTenant(client.db, ctx, (tx) =>
      recordGenerationUsage(tx, ctx, { workspaceId: workspace.id, costCents: 5 }),
    );
    await withTenant(client.db, ctx, (tx) =>
      recordGenerationUsage(tx, ctx, { workspaceId: workspace.id, costCents: 7 }),
    );
    await withTenant(client.db, ctx, (tx) =>
      recordGenerationUsage(tx, ctx, { costCents: 2 }),
    );

    // Reads are free and unmetered: opening the workspace changes nothing.
    await withTenant(client.db, ctx, (tx) => getWorkspace(tx, ctx, workspace.id));

    const summary = await withTenant(client.db, ctx, (tx) =>
      getUsageSummary(tx),
    );
    expect(summary.month).toEqual({ generations: 3, costCents: 14 });
    expect(summary.readCostCents).toBe(0);
    const forWorkspace = summary.perWorkspace.find(
      (w) => w.workspaceId === workspace.id,
    );
    expect(forWorkspace).toEqual({
      workspaceId: workspace.id,
      generations: 2,
      costCents: 12,
    });
  });
});
