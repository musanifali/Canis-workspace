/**
 * Load saved workspace specs — the population `contracts diff` tests its impact
 * against. Two sources, same shape out:
 *
 *   - a local directory of *.json spec files (air-gapped CI, and how the tests
 *     run — no live service or Docker required), and
 *   - the Phase 4 Workspace Service via @workspace-engine/client (tenant-scoped
 *     by API key + acting user).
 *
 * Specs are returned RAW (unparsed): validateSpec shape-checks every candidate
 * itself, so a malformed saved spec surfaces as a validator REJECT rather than
 * a loader crash.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createWorkspaceServiceClient } from "@workspace-engine/client";

export interface LoadedSpec {
  /** Stable identifier — workspace id (service) or file name (directory). */
  id: string;
  /** Where it came from, for the report. */
  source: string;
  /** Raw candidate spec (object) handed to validateSpec untouched. */
  spec: unknown;
  /** Best-effort title for human output. */
  title?: string;
}

/** Read every *.json file in a directory as a candidate spec. */
export async function loadSpecsFromDir(dir: string): Promise<LoadedSpec[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();

  const specs: LoadedSpec[] = [];
  for (const name of files) {
    const path = join(dir, name);
    const text = await readFile(path, "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error(
        `spec file "${path}" is not valid JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    const title =
      parsed !== null &&
      typeof parsed === "object" &&
      typeof (parsed as { title?: unknown }).title === "string"
        ? (parsed as { title: string }).title
        : undefined;
    specs.push({ id: name, source: path, spec: parsed, ...(title ? { title } : {}) });
  }
  return specs;
}

export interface ServiceSpecSource {
  baseUrl: string;
  apiKey: string;
  userId: string;
  fetch?: typeof fetch;
}

/**
 * Fetch every saved spec visible to the acting user in the tenant. The client
 * re-parses each payload through core's parseSpec, so we hand validateSpec the
 * already-validated object.
 */
export async function loadSpecsFromService(
  source: ServiceSpecSource,
): Promise<LoadedSpec[]> {
  const client = createWorkspaceServiceClient({
    baseUrl: source.baseUrl,
    apiKey: source.apiKey,
    userId: source.userId,
    ...(source.fetch ? { fetch: source.fetch } : {}),
  });
  const summaries = await client.listWorkspaces();
  const specs: LoadedSpec[] = [];
  for (const summary of summaries) {
    const record = await client.getWorkspace(summary.id);
    specs.push({
      id: record.id,
      source: `service:${record.id}`,
      spec: record.spec,
      title: record.title,
    });
  }
  return specs;
}
