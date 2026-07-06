/**
 * Points the seeded demo project at an OpenAI-compatible LLM provider and
 * stores the provider key encrypted (BYOK).
 *
 * Usage (env comes from tambo/docker.env, same as seed-tambo-project.mts):
 *   DATABASE_URL=... API_KEY_SECRET=... PROVIDER_KEY_SECRET=... \
 *     npx -y tsx scripts/configure-llm.mts <provider-api-key> [model] [baseUrl]
 *
 * Defaults target OpenRouter's free tier with a tool-capable model.
 */
import {
  closeDb,
  getDb,
  operations,
} from "../../tambo/packages/db/src/index";

const DEMO_EMAIL = "demo@workspace-engine.local";
const PROJECT_NAME = "Workspace Engine Demo";
const DEFAULT_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";
const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

const databaseUrl = process.env.DATABASE_URL;
const providerKeySecret = process.env.PROVIDER_KEY_SECRET;
if (!databaseUrl || !providerKeySecret) {
  throw new Error(
    "DATABASE_URL and PROVIDER_KEY_SECRET must be set (source tambo/docker.env)",
  );
}

const providerKey = process.argv[2];
if (!providerKey) {
  throw new Error("Pass the provider API key as the first argument");
}
const model = process.argv[3] ?? DEFAULT_MODEL;
const baseUrl = process.argv[4] ?? DEFAULT_BASE_URL;

const db = getDb(databaseUrl);

const user = await db.query.authUsers.findFirst({
  where: (users, { eq }) => eq(users.email, DEMO_EMAIL),
});
if (!user) {
  throw new Error(
    `Demo user ${DEMO_EMAIL} not found — run seed-tambo-project.mts first`,
  );
}

const projects = await operations.getProjectsForUser(db, user.id);
const project = projects.find((p) => p.name === PROJECT_NAME);
if (!project) {
  throw new Error(
    `Project "${PROJECT_NAME}" not found — run seed-tambo-project.mts first`,
  );
}

await operations.updateProject(db, project.id, {
  defaultLlmProviderName: "openai-compatible",
  customLlmModelName: model,
  customLlmBaseURL: baseUrl,
});
console.log(
  `Project ${project.id} → provider openai-compatible, model ${model}, baseUrl ${baseUrl}`,
);

const existingKeys = await operations.getProviderKeys(db, project.id);
for (const key of existingKeys) {
  if (key.providerName === "openai-compatible") {
    await operations.deleteProviderKey(db, project.id, key.id);
    console.log(`Removed previous openai-compatible provider key ${key.id}`);
  }
}

await operations.addProviderKey(db, providerKeySecret, {
  projectId: project.id,
  providerName: "openai-compatible",
  providerKey,
  userId: user.id,
});
console.log("Stored provider key (encrypted per-project)");

await closeDb();
