/**
 * Spec version migration framework (Workspace Spec v1 §9, card #11).
 *
 * Saved workspaces are long-lived customer data: stored specs are NEVER
 * rewritten in place. Pure `from → from+1` migration steps run lazily at
 * read time, composing to the current version — old workspaces load forever.
 *
 * The runner owns the bookkeeping the steps must not get wrong: it deep-
 * clones the stored value before the chain (the caller's object is never
 * mutated), stamps `specVersion` after every step, and finalizes through
 * `parseSpec` so a buggy migration can't smuggle an invalid spec past
 * validation.
 */
import { parseSpec } from "./serde.js";
import { SPEC_VERSION, type WorkspaceSpec } from "./workspace.js";

export interface SpecMigration {
  /** The version this step migrates FROM (to `from + 1`). */
  from: number;
  /**
   * Pure shape transform. Receives a private clone it may mutate or replace;
   * must NOT touch `specVersion` — the runner stamps it.
   */
  migrate: (spec: Record<string, unknown>) => Record<string, unknown>;
}

export class SpecMigrationError extends Error {
  constructor(
    message: string,
    readonly found: unknown,
    readonly current: number,
  ) {
    super(`spec migration failed: ${message}`);
    this.name = "SpecMigrationError";
  }
}

export interface MigrationRunnerOptions {
  /** Target version; defaults to the engine's SPEC_VERSION. */
  currentVersion?: number;
  /** Final validation; defaults to parseSpec. Overridable only for tests. */
  finalize?: (candidate: unknown) => WorkspaceSpec;
}

/**
 * Build a migration runner from a chain of steps.
 *
 * The chain is validated eagerly: steps must be unique and must cover every
 * version in `1..currentVersion-1` — a gap would strand old workspaces,
 * which §9 forbids.
 *
 * @returns `(stored) => WorkspaceSpec` — lazy read-time migration
 * @throws {Error} At construction when the chain has gaps or duplicates
 */
export function createMigrationRunner(
  migrations: readonly SpecMigration[],
  options: MigrationRunnerOptions = {},
): (stored: unknown) => WorkspaceSpec {
  const current = options.currentVersion ?? SPEC_VERSION;
  const finalize = options.finalize ?? parseSpec;

  const byVersion = new Map<number, SpecMigration>();
  for (const migration of migrations) {
    if (byVersion.has(migration.from)) {
      throw new Error(
        `duplicate migration from v${migration.from} — each step must be unique`,
      );
    }
    byVersion.set(migration.from, migration);
  }
  const missing = Array.from(
    { length: current - 1 },
    (_, i) => i + 1,
  ).filter((version) => !byVersion.has(version));
  if (missing.length > 0) {
    throw new Error(
      `migration chain has gaps: no step from v${missing.join(", v")} — old workspaces must load forever (§9)`,
    );
  }

  return (stored) => {
    const candidate =
      typeof stored === "string" ? parseStoredJson(stored, current) : stored;

    if (
      candidate === null ||
      typeof candidate !== "object" ||
      Array.isArray(candidate)
    ) {
      throw new SpecMigrationError(
        "stored value is not a spec object",
        candidate,
        current,
      );
    }
    const version = (candidate as { specVersion?: unknown }).specVersion;
    if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
      throw new SpecMigrationError(
        `stored spec has no usable specVersion (found ${JSON.stringify(version)})`,
        version,
        current,
      );
    }
    if (version > current) {
      throw new SpecMigrationError(
        `stored spec is v${version} but this engine only knows v${current} — ` +
          "upgrade the engine; never downgrade a stored spec",
        version,
        current,
      );
    }

    // The stored object is customer data: work on a clone, never in place.
    let spec = structuredClone(candidate) as Record<string, unknown>;
    for (let step = version; step < current; step++) {
      spec = byVersion.get(step)!.migrate(spec);
      spec.specVersion = step + 1;
    }
    return finalize(spec);
  };
}

/** The engine's runner: v1 is the baseline, so the chain is empty. */
export const migrateSpec = createMigrationRunner([]);

function parseStoredJson(text: string, current: number): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new SpecMigrationError("stored value is not valid JSON", text, current);
  }
}
