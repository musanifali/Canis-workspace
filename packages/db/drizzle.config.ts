import type { Config } from "drizzle-kit";

// Local dev default matches docker-compose.yml (port 5443 so it never
// collides with the vendored Tambo stack's Postgres, which owns 5433).
const devUrl = "postgres://postgres:postgres@localhost:5443/workspace_engine";

export default {
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? devUrl,
  },
  verbose: true,
} satisfies Config;
