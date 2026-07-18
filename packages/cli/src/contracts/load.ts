/**
 * Load vendor contracts from a module path (all IO for the contract side lives
 * here — packages/core never imports or executes anything).
 *
 * A "contract module" is any JS/ESM module (or TS, if the vendor runs the CLI
 * under a loader such as tsx / after a build) that produces `EntityContract`
 * objects via `defineEntity`. We accept several natural export shapes:
 *
 *   export const contracts = [caseContract, invoiceContract];   // array
 *   export default [caseContract];                               // default array
 *   export default caseContract;                                 // single default
 *   export const caseContract = defineEntity({ ... });           // any named exports
 *
 * Every exported value that structurally looks like an EntityContract is
 * collected and de-duplicated by entity name. If a module's top-level
 * `defineEntity` throws (e.g. a capability names a field the schema lacks), the
 * import rejects and we surface it as a load error rather than a stack trace —
 * `contracts lint` reports it as an error-severity finding.
 */
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import type { EntityContract } from "@workspace-engine/core";

export class ContractLoadError extends Error {
  constructor(
    readonly modulePath: string,
    readonly reason: string,
  ) {
    super(`failed to load contracts from "${modulePath}": ${reason}`);
    this.name = "ContractLoadError";
  }
}

/** Structural (duck-typed) check — a contract may come from a foreign zod copy. */
function isEntityContract(value: unknown): value is EntityContract {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.fields === "object" &&
    candidate.fields !== null &&
    typeof candidate.capabilities === "object" &&
    candidate.capabilities !== null &&
    typeof candidate.fetch === "function" &&
    // a resolved contract exposes filterable as a Set (validateSpec relies on it)
    candidate.capabilities !== null &&
    typeof (candidate.capabilities as { filterable?: unknown }).filterable === "object"
  );
}

/**
 * Pull every EntityContract-shaped value out of a module's exports.
 * Arrays (named or default) are flattened one level.
 */
function collectContracts(mod: Record<string, unknown>): EntityContract[] {
  const found: EntityContract[] = [];
  const seen = new Set<string>();
  const consider = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) consider(item);
      return;
    }
    if (isEntityContract(value) && !seen.has(value.name)) {
      seen.add(value.name);
      found.push(value);
    }
  };
  for (const value of Object.values(mod)) consider(value);
  return found;
}

/**
 * Dynamically import a contract module and return its EntityContracts.
 *
 * @param modulePath Path (relative to cwd) or file URL of the module.
 * @throws {ContractLoadError} When the import fails or yields no contracts.
 */
export async function loadContractModule(
  modulePath: string,
  cwd: string = process.cwd(),
): Promise<EntityContract[]> {
  const url = modulePath.startsWith("file:")
    ? modulePath
    : pathToFileURL(resolve(cwd, modulePath)).href;

  let mod: Record<string, unknown>;
  try {
    mod = (await import(url)) as Record<string, unknown>;
  } catch (error) {
    throw new ContractLoadError(
      modulePath,
      error instanceof Error ? error.message : String(error),
    );
  }

  const contracts = collectContracts(mod);
  if (contracts.length === 0) {
    throw new ContractLoadError(
      modulePath,
      "module exported no EntityContract (export contracts via `defineEntity`, " +
        "as named exports, an array, or the default export)",
    );
  }
  return contracts;
}

/** Index contracts by entity name for validateSpec's `contracts` map. */
export function toContractMap(
  contracts: readonly EntityContract[],
): Record<string, EntityContract> {
  const map: Record<string, EntityContract> = {};
  for (const contract of contracts) map[contract.name] = contract;
  return map;
}
