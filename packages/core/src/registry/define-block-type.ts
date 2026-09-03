/**
 * Authoring custom block types (#111) — level 3 of a partner integration.
 *
 * Swapping COMPONENTS for the built-in types needs nothing from this file. This
 * is for the rarer case: a block we don't ship (a burndown, a heatmap). The
 * validator gates every block's config and binding shape, so it has to learn
 * the new type too — that means a registry entry beside your component.
 *
 * Hand-writing one is possible (the registry is plain data) but has two traps
 * this helper closes:
 *   - repeating `type` as both the record key and a field, which can disagree;
 *   - forgetting `.strict()` on the config schema, which silently lets unknown
 *     config keys through and quietly widens what the gate accepts.
 */
import { z } from "zod";
import { GRID_COLUMNS } from "../spec/frame.js";
import type { BindingShape } from "../spec/query.js";
import type { BlockRegistry, BlockRegistryEntry } from "./registry.js";

/** Thrown when a block-type declaration is invalid — at definition time. */
export class BlockTypeDefinitionError extends Error {
  constructor(
    readonly blockType: string,
    message: string,
  ) {
    super(`invalid block type "${blockType}": ${message}`);
    this.name = "BlockTypeDefinitionError";
  }
}

export interface BlockTypeDefinition {
  /** Registry key AND the `type` a spec's block uses, e.g. "Burndown". */
  type: string;
  /** The query output this block renders; "none" = static (no binding). */
  bindingShape: BindingShape | "none";
  /**
   * Strict schema for the block's `config`. MUST be `.strict()` — a permissive
   * schema would let a model put anything in config and still pass the gate.
   * Defaults to "no config allowed".
   */
  config?: z.ZodObject<z.ZodRawShape, "strict">;
  /** Grid bounds. Defaults to a sensible mid-size block. */
  minSize?: { w: number; h: number };
  maxSize?: { w: number; h: number };
  /** Aggregation aliases this block's config references (alias↔config check). */
  referencedAliases?: (config: Record<string, unknown>) => readonly string[];
  /** Entity field names the config references (e.g. explicit columns). */
  referencedFields?: (config: Record<string, unknown>) => readonly string[];
  /** Sibling block ids the config targets (FilterBar-style). */
  referencedTargets?: (config: Record<string, unknown>) => readonly string[];
}

const DEFAULT_MIN = { w: 3, h: 2 };
const DEFAULT_MAX = { w: GRID_COLUMNS, h: 12 };

function isStrictObject(schema: z.ZodTypeAny): boolean {
  const def = (schema as { _def?: { typeName?: string; unknownKeys?: string } })._def;
  return def?.typeName === "ZodObject" && def?.unknownKeys === "strict";
}

/**
 * Author a registry entry for a custom block type.
 *
 * @returns The entry, ready to merge with `extendRegistry`.
 * @throws BlockTypeDefinitionError on a declaration that would weaken the gate.
 */
export function defineBlockType(def: BlockTypeDefinition): BlockRegistryEntry {
  const { type } = def;
  if (!type || !/^[A-Za-z][A-Za-z0-9_]*$/.test(type)) {
    throw new BlockTypeDefinitionError(
      String(type),
      "type must be a non-empty identifier (letters, digits, underscore)",
    );
  }

  const config = def.config ?? z.object({}).strict();
  if (!isStrictObject(config)) {
    // The whole point of the registry is that config is closed. A loose schema
    // would let anything through and the REJECT path would never fire.
    throw new BlockTypeDefinitionError(
      type,
      "config must be a strict object schema — use z.object({...}).strict() so " +
        "unknown config keys are rejected instead of silently accepted",
    );
  }

  const minSize = def.minSize ?? DEFAULT_MIN;
  const maxSize = def.maxSize ?? DEFAULT_MAX;
  for (const [name, size] of [["minSize", minSize], ["maxSize", maxSize]] as const) {
    if (size.w < 1 || size.h < 1 || size.w > GRID_COLUMNS) {
      throw new BlockTypeDefinitionError(
        type,
        `${name} must fit the ${GRID_COLUMNS}-column grid (got w=${size.w}, h=${size.h})`,
      );
    }
  }
  if (minSize.w > maxSize.w || minSize.h > maxSize.h) {
    throw new BlockTypeDefinitionError(type, "minSize must not exceed maxSize");
  }

  return {
    type,
    bindingShape: def.bindingShape,
    configSchema: config,
    minSize,
    maxSize,
    ...(def.referencedAliases ? { referencedAliases: def.referencedAliases } : {}),
    ...(def.referencedFields ? { referencedFields: def.referencedFields } : {}),
    ...(def.referencedTargets ? { referencedTargets: def.referencedTargets } : {}),
  };
}

/**
 * Merge custom block types into a registry, keyed correctly by `type`.
 *
 * Pass `DEFAULT_REGISTRY` to add to the built-ins, or a narrowed object to
 * publish a smaller surface — a type absent from the registry is REJECTed by
 * the validator, which is how a tenant policy restricts what may be generated.
 *
 * @returns A new registry; the base is never mutated.
 * @throws BlockTypeDefinitionError when an entry would silently replace a
 *   built-in (pass `{ override: true }` if that's genuinely intended).
 */
export function extendRegistry(
  base: BlockRegistry,
  entries: readonly BlockRegistryEntry[],
  options: { override?: boolean } = {},
): BlockRegistry {
  const out: Record<string, BlockRegistryEntry> = { ...base };
  for (const entry of entries) {
    if (!options.override && Object.hasOwn(base, entry.type)) {
      throw new BlockTypeDefinitionError(
        entry.type,
        "a block type with this name already exists — pass { override: true } " +
          "to replace it deliberately",
      );
    }
    out[entry.type] = entry;
  }
  return Object.freeze(out);
}
