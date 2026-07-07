/**
 * Parse/serialize helpers for WorkspaceSpec.
 *
 * Invariant (card DUx7yjkT): `parseSpec(serializeSpec(spec))` deep-equals
 * `spec` for every valid spec. Serialization is canonical: object keys are
 * sorted recursively so equal specs serialize to identical bytes (stable
 * hashing/diffing later).
 */
import { z } from "zod";
import { workspaceSpecSchema, type WorkspaceSpec } from "./workspace.js";

export class SpecParseError extends Error {
  readonly issues: z.ZodIssue[];

  constructor(issues: z.ZodIssue[]) {
    const summary = issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    super(`invalid workspace spec: ${summary}`);
    this.name = "SpecParseError";
    this.issues = issues;
  }
}

/**
 * Parse unknown input (object or JSON string) into a validated WorkspaceSpec.
 *
 * @returns The validated spec with defaults applied
 * @throws {SpecParseError} When the input is not a structurally valid spec
 */
export function parseSpec(input: unknown): WorkspaceSpec {
  const candidate = typeof input === "string" ? parseJson(input) : input;
  const result = workspaceSpecSchema.safeParse(candidate);
  if (!result.success) {
    throw new SpecParseError(result.error.issues);
  }
  return result.data;
}

/**
 * Serialize a spec to canonical JSON (recursively sorted keys).
 *
 * @returns A JSON string that parses back to a deep-equal spec
 */
export function serializeSpec(spec: WorkspaceSpec): string {
  return JSON.stringify(sortKeysDeep(spec));
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new SpecParseError([
      {
        code: z.ZodIssueCode.custom,
        path: [],
        message: "input is not valid JSON",
      },
    ]);
  }
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .toSorted(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, sortKeysDeep(entry)]),
    );
  }
  return value;
}
