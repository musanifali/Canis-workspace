import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

export type WorkspaceDb = NodePgDatabase<typeof schema>;

export interface WorkspaceDbClient {
  db: WorkspaceDb;
  pool: pg.Pool;
  /** Closes the underlying pool. */
  close: () => Promise<void>;
}

/**
 * Create a pooled Drizzle client for the Workspace Service database.
 *
 * The pool connects as the migration/admin user; per-request tenant scoping
 * happens inside `withTenant` (SET LOCAL ROLE workspace_service + a
 * transaction-local `app.tenant_id`), so RLS applies to every operation
 * without a second credential.
 */
export function createDbClient(databaseUrl: string): WorkspaceDbClient {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });
  return {
    db,
    pool,
    close: async () => {
      await pool.end();
    },
  };
}
