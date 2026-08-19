/**
 * Production migration runner (#95). Applies the drizzle migration files to
 * DATABASE_URL using drizzle-orm's programmatic migrator — no drizzle-kit
 * (a devDependency) needed in the deploy image. Run as the pre-deploy step so
 * the schema is current before the new release takes traffic.
 *
 * Usage:  DATABASE_URL=postgres://... node scripts/migrate-prod.mjs
 * The URL must point at an RLS-capable Postgres (Neon/RDS/Supabase) and use a
 * role allowed to CREATE ROLE (migration 0000 creates `workspace_service`).
 */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import { createDbClient } from "../dist/index.js";

const url =
  process.env.DATABASE_URL ?? process.env.WORKSPACE_DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required for migrations");
  process.exit(1);
}

const client = createDbClient(url);
try {
  await client.pool.query("select 1"); // fail fast on a bad URL/SSL
  await migrate(client.db, {
    migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)),
  });
  console.log("migrations applied");
} catch (error) {
  console.error("migration failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.close();
}
