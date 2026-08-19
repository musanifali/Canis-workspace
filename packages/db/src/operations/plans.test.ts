/**
 * Plan tiers (#94): the plan drives the effective monthly cap through the SAME
 * allowance path as #48 (no second enforcement), a per-tenant override wins,
 * and a plan change takes effect immediately (no restart).
 */
import { PLAN_CAPS } from "@workspace-engine/core";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { WorkspaceDbClient } from "../client.js";
import { tenants } from "../schema.js";
import { withTenant, type TenantContext } from "../tenant.js";
import { connectTestDb } from "../test-helpers.js";
import { provisionTenant } from "./signup.js";
import {
  getGenerationAllowance,
  setTenantLimits,
  setTenantPlan,
} from "./usage.js";

let client: WorkspaceDbClient;
const uniq = () => Math.random().toString(36).slice(2, 10);

async function signup() {
  const p = await provisionTenant(client.db, {
    orgName: "Plan Co",
    slug: `plan-${uniq()}`,
    owner: { externalId: `github:${uniq()}` },
  });
  return { tenantId: p.tenant.id, ctx: { tenantId: p.tenant.id, userId: p.owner.id } as TenantContext };
}

const allowanceOf = (ctx: TenantContext) =>
  withTenant(client.db, ctx, (tx) => getGenerationAllowance(tx, ctx));

beforeAll(async () => {
  client = await connectTestDb();
});
afterAll(async () => {
  await client?.close();
});

describe("plan drives the monthly cap", () => {
  it("a self-signup tenant is on free with the free cap", async () => {
    const { ctx } = await signup();
    const a = await allowanceOf(ctx);
    expect(a.plan).toBe("free");
    expect(a.monthlyCap).toBe(PLAN_CAPS.free.generationsPerMonth);
    expect(a.remainingThisMonth).toBe(PLAN_CAPS.free.generationsPerMonth);
  });

  it("internal is unlimited", async () => {
    const { tenantId, ctx } = await signup();
    await setTenantPlan(client.db, tenantId, "internal");
    const a = await allowanceOf(ctx);
    expect(a.plan).toBe("internal");
    expect(a.monthlyCap).toBeNull();
    expect(a.remainingThisMonth).toBeNull();
  });

  it("pro raises the cap above free", async () => {
    const { tenantId, ctx } = await signup();
    await setTenantPlan(client.db, tenantId, "pro");
    const a = await allowanceOf(ctx);
    expect(a.monthlyCap).toBe(PLAN_CAPS.pro.generationsPerMonth);
    expect(PLAN_CAPS.pro.generationsPerMonth!).toBeGreaterThan(
      PLAN_CAPS.free.generationsPerMonth!,
    );
  });
});

describe("plan change is live (no restart)", () => {
  it("a raw UPDATE of the plan column changes the next allowance", async () => {
    const { tenantId, ctx } = await signup();
    expect((await allowanceOf(ctx)).monthlyCap).toBe(PLAN_CAPS.free.generationsPerMonth);
    // Simulate an admin/SQL plan change (not setTenantPlan) — caps resolve at
    // read time, so the very next check reflects it.
    await client.db.update(tenants).set({ plan: "pro" }).where(eq(tenants.id, tenantId));
    expect((await allowanceOf(ctx)).monthlyCap).toBe(PLAN_CAPS.pro.generationsPerMonth);
  });
});

describe("per-tenant override still wins over the plan", () => {
  it("an explicit budget overrides the plan cap", async () => {
    const { tenantId, ctx } = await signup(); // free
    await setTenantLimits(client.db, tenantId, { monthlyGenerationBudget: 7 });
    const a = await allowanceOf(ctx);
    expect(a.monthlyCap).toBe(7); // override, not the free 25
  });
});
