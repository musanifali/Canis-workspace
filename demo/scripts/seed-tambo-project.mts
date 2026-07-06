/**
 * Seeds the self-hosted Tambo backend with a demo user, project, and API key,
 * then writes the key into demo/.env.local.
 *
 * The self-hosted dashboard requires OAuth (GitHub/Google) or Resend email to
 * log in; none of those are configured for local dev, so we provision the
 * project directly through Tambo's own db operations instead.
 *
 * Usage (from the tambo clone so workspace deps resolve):
 *   cd ../tambo && set -a && . ./docker.env && set +a && \
 *     DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5433/$POSTGRES_DB" \
 *     npx tsx ../demo/scripts/seed-tambo-project.mts [openai-api-key]
 *
 * Pass an OpenAI API key as the first argument (or set SEED_OPENAI_API_KEY)
 * to register it as the project's BYOK provider key.
 */
import { randomUUID } from "crypto";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  closeDb,
  getDb,
  operations,
  schema,
} from "../../tambo/packages/db/src/index";

const DEMO_EMAIL = "demo@workspace-engine.local";
const PROJECT_NAME = "Workspace Engine Demo";

const databaseUrl = process.env.DATABASE_URL;
const apiKeySecret = process.env.API_KEY_SECRET;
const providerKeySecret = process.env.PROVIDER_KEY_SECRET;
if (!databaseUrl || !apiKeySecret || !providerKeySecret) {
  throw new Error(
    "DATABASE_URL, API_KEY_SECRET, and PROVIDER_KEY_SECRET must be set (source tambo/docker.env)",
  );
}

const openaiKey = process.argv[2] ?? process.env.SEED_OPENAI_API_KEY;

const db = getDb(databaseUrl);

async function findOrCreateDemoUser(): Promise<string> {
  const existing = await db.query.authUsers.findFirst({
    where: (users, { eq }) => eq(users.email, DEMO_EMAIL),
  });
  if (existing) {
    console.log(`Reusing demo user ${existing.id}`);
    return existing.id;
  }
  const [user] = await db
    .insert(schema.authUsers)
    .values({ id: randomUUID(), email: DEMO_EMAIL })
    .returning();
  console.log(`Created demo user ${user.id}`);
  return user.id;
}

async function findOrCreateProject(userId: string): Promise<string> {
  const projects = await operations.getProjectsForUser(db, userId);
  const existing = projects.find((p) => p.name === PROJECT_NAME);
  if (existing) {
    console.log(`Reusing project ${existing.id}`);
    return existing.id;
  }
  const project = await operations.createProject(db, {
    name: PROJECT_NAME,
    userId,
  });
  console.log(`Created project ${project.id}`);
  return project.id;
}

function writeEnvLocal(apiKey: string) {
  const envPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    ".env.local",
  );
  const lines = [
    `NEXT_PUBLIC_TAMBO_API_KEY=${apiKey}`,
    `NEXT_PUBLIC_TAMBO_URL=http://localhost:8261`,
  ];
  if (!existsSync(envPath)) {
    writeFileSync(envPath, lines.join("\n") + "\n");
    console.log(`Wrote ${envPath}`);
    return;
  }
  const current = readFileSync(envPath, "utf8");
  if (current.includes("NEXT_PUBLIC_TAMBO_API_KEY=")) {
    const updated = current
      .split("\n")
      .map((line) =>
        line.startsWith("NEXT_PUBLIC_TAMBO_API_KEY=") ? lines[0] : line,
      )
      .join("\n");
    writeFileSync(envPath, updated);
  } else {
    appendFileSync(envPath, lines.join("\n") + "\n");
  }
  console.log(`Updated ${envPath}`);
}

const userId = await findOrCreateDemoUser();
const projectId = await findOrCreateProject(userId);

const apiKey = await operations.createApiKey(db, apiKeySecret, {
  projectId,
  userId,
  name: `demo-${new Date().toISOString().slice(0, 10)}`,
});
console.log(`Created API key for project ${projectId}`);
writeEnvLocal(apiKey);

if (openaiKey) {
  await operations.addProviderKey(db, providerKeySecret, {
    projectId,
    providerName: "openai",
    providerKey: openaiKey,
    userId,
  });
  console.log("Stored OpenAI provider key (BYOK)");
} else {
  console.log(
    "No OpenAI key supplied — pass one as the first argument to enable generation (BYOK)",
  );
}

await closeDb();
