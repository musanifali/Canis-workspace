import { sql } from "drizzle-orm";
import type { WorkspaceDb } from "./client.js";

/** Identity every operation runs under; resolved by the API's auth layer. */
export interface TenantContext {
  tenantId: string;
  userId: string;
  /** Teams the acting user belongs to (for team shares); caller-supplied. */
  teamIds?: readonly string[];
}

/** The transaction handle operations receive inside withTenant. */
export type TenantTx = Parameters<Parameters<WorkspaceDb["transaction"]>[0]>[0];

/**
 * Run `fn` inside a transaction scoped to one tenant, with RLS enforced.
 *
 * Two `SET LOCAL`-scoped settings make the database itself the enforcement
 * point:
 * - `SET LOCAL ROLE workspace_service` — a non-owner role, so every table's
 *   RLS policies apply (the pool's admin user would bypass them);
 * - `set_config('app.tenant_id', tenantId, true)` — the transaction-local
 *   variable the policies compare against.
 *
 * Both reset automatically at COMMIT/ROLLBACK, so a pooled connection can
 * never leak one request's tenant into the next — the exact RLS-bypass class
 * devdocs/security-review.md §5 flags as an open question for the platform.
 */
export async function withTenant<T>(
  db: WorkspaceDb,
  ctx: TenantContext,
  fn: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  return await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE workspace_service`);
    await tx.execute(sql`SELECT set_config('app.tenant_id', ${ctx.tenantId}, true)`);
    return await fn(tx);
  });
}
