import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { dataContracts, type DBDataContract } from "../schema.js";
import type { TenantContext, TenantTx } from "../tenant.js";
import { writeAudit } from "./audit.js";

export interface UpsertDataContractParams {
  entityName: string;
  /** The declared contract surface (defineEntity args) — no executable code. */
  definition: Record<string, unknown>;
}

/**
 * Register or update a tenant's data contract for one entity.
 * @returns The stored contract row.
 */
export async function upsertDataContract(
  tx: TenantTx,
  ctx: TenantContext,
  params: UpsertDataContractParams,
): Promise<DBDataContract> {
  const existing = await getDataContract(tx, params.entityName);

  if (existing) {
    const [updated] = await tx
      .update(dataContracts)
      .set({ definition: params.definition, updatedAt: new Date() })
      .where(eq(dataContracts.id, existing.id))
      .returning();
    if (!updated) {
      throw new Error(`Failed to update contract "${params.entityName}"`);
    }
    await writeAudit(tx, ctx, {
      action: "contract.updated",
      detail: { entityName: params.entityName },
    });
    return updated;
  }

  const [created] = await tx
    .insert(dataContracts)
    .values({
      id: `dc_${randomUUID()}`,
      tenantId: ctx.tenantId,
      entityName: params.entityName,
      definition: params.definition,
    })
    .returning();
  if (!created) {
    throw new Error(`Failed to register contract "${params.entityName}"`);
  }
  await writeAudit(tx, ctx, {
    action: "contract.registered",
    detail: { entityName: params.entityName },
  });
  return created;
}

/**
 * Fetch one contract by entity name (RLS scopes the tenant).
 * @returns The contract row, or null when the tenant hasn't registered one.
 */
export async function getDataContract(
  tx: TenantTx,
  entityName: string,
): Promise<DBDataContract | null> {
  const [contract] = await tx
    .select()
    .from(dataContracts)
    .where(and(eq(dataContracts.entityName, entityName)));
  return contract ?? null;
}

/**
 * List the tenant's registered contracts.
 * @returns Contract rows.
 */
export async function listDataContracts(tx: TenantTx): Promise<DBDataContract[]> {
  return await tx.select().from(dataContracts);
}

/**
 * Remove a tenant's contract registration.
 * @returns True when a contract was removed, false when none existed.
 */
export async function removeDataContract(
  tx: TenantTx,
  ctx: TenantContext,
  entityName: string,
): Promise<boolean> {
  const deleted = await tx
    .delete(dataContracts)
    .where(eq(dataContracts.entityName, entityName))
    .returning({ id: dataContracts.id });
  if (deleted.length === 0) {
    return false;
  }
  await writeAudit(tx, ctx, {
    action: "contract.removed",
    detail: { entityName },
  });
  return true;
}
