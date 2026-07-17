import type { OnApplicationShutdown, Provider } from "@nestjs/common";
import { createDbClient, type WorkspaceDbClient } from "@workspace-engine/db";

/** Injection token for the shared database client. */
export const DB_CLIENT = "DB_CLIENT";

class DbClientHost implements OnApplicationShutdown {
  constructor(readonly client: WorkspaceDbClient) {}
  async onApplicationShutdown() {
    await this.client.close();
  }
}

/**
 * Build the DB_CLIENT provider for a database url. The pool connects as the
 * admin user; tenant scoping happens per-request inside withTenant.
 * @returns Providers registering the pooled client + its shutdown hook.
 */
export function dbProviders(databaseUrl: string): Provider[] {
  const host = new DbClientHost(createDbClient(databaseUrl));
  return [
    { provide: DB_CLIENT, useValue: host.client },
    { provide: DbClientHost, useValue: host },
  ];
}
