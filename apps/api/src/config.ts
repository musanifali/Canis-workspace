/** Environment-derived configuration, resolved once at startup. */
export interface ApiConfig {
  databaseUrl: string;
  port: number;
}

const DEV_DATABASE_URL =
  "postgres://postgres:postgres@localhost:5443/workspace_engine";

/**
 * Read config from the environment with local-dev defaults matching
 * packages/db's docker compose.
 * @returns The resolved config.
 */
export function loadConfig(): ApiConfig {
  return {
    databaseUrl: process.env.WORKSPACE_DATABASE_URL ?? DEV_DATABASE_URL,
    port: Number(process.env.WORKSPACE_API_PORT ?? 8270),
  };
}
