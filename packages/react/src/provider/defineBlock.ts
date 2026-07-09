import {
  DEFAULT_REGISTRY,
  type BindingShape,
  type BlockRegistry,
  type EntityContract,
} from "@workspace-engine/core";
import type { BlockComponent, BlockComponentRegistry } from "../renderer/types";

/** The binding output a block renders; "none" = static (no data). */
export type BlockShape = BindingShape | "none";

/**
 * What a block can render — its data shape and the contracts it's compatible
 * with. Declared at registration and validated against the core block registry;
 * in Phase 3 the same declaration powers spec lifting (matching a user's request
 * to blocks that can display the resulting query).
 */
export interface BlockAccepts {
  /** Must match the registry's binding shape for this block type. */
  shape: BlockShape;
  /** Compatible contract entities; omit = any contract with a matching shape. */
  entities?: readonly string[] | undefined;
}

export interface BlockDefinition {
  /** Registry block type, e.g. "CasesTable". */
  type: string;
  accepts: BlockAccepts;
  component: BlockComponent;
}

/** Thrown when a block definition is invalid, at define or registration time. */
export class BlockRegistrationError extends Error {
  constructor(
    readonly blockType: string,
    message: string,
  ) {
    super(`invalid block registration for "${blockType}": ${message}`);
    this.name = "BlockRegistrationError";
  }
}

const VALID_SHAPES: readonly BlockShape[] = [
  "rows",
  "groups",
  "aggregate",
  "none",
];

/**
 * Register a block: pair a registry type with a component and its `accepts`
 * declaration. Does the structural checks that don't need contracts/registry
 * (valid shape, real component); the contract/registry-aware validation runs in
 * buildBlockRegistry when the provider mounts.
 */
export function defineBlock(def: BlockDefinition): BlockDefinition {
  if (!def.type || typeof def.type !== "string") {
    throw new BlockRegistrationError(String(def.type), "type is required");
  }
  if (!VALID_SHAPES.includes(def.accepts.shape)) {
    throw new BlockRegistrationError(
      def.type,
      `accepts.shape "${def.accepts.shape}" is not one of ${VALID_SHAPES.join(", ")}`,
    );
  }
  if (typeof def.component !== "function") {
    throw new BlockRegistrationError(def.type, "component must be a React component");
  }
  return def;
}

export interface RegisterBlocksContext {
  registry?: BlockRegistry;
  contracts: Readonly<Record<string, EntityContract>>;
}

/**
 * Validate a set of block definitions against the block registry and contracts,
 * returning the type→component map the renderer consumes. Registration fails
 * fast (BlockRegistrationError) on: an unknown block type, a duplicate type, an
 * `accepts.shape` that disagrees with the registry's binding shape, or an
 * `accepts.entities` reference to a contract that wasn't supplied.
 */
export function buildBlockRegistry(
  blocks: readonly BlockDefinition[],
  ctx: RegisterBlocksContext,
): BlockComponentRegistry {
  const registry = ctx.registry ?? DEFAULT_REGISTRY;
  const map: Record<string, BlockComponent> = {};

  for (const block of blocks) {
    defineBlock(block); // re-run structural checks defensively
    if (map[block.type]) {
      throw new BlockRegistrationError(block.type, "duplicate block type");
    }
    const entry = registry[block.type];
    if (!entry) {
      throw new BlockRegistrationError(
        block.type,
        `unknown block type; registry has ${Object.keys(registry).join(", ")}`,
      );
    }
    if (block.accepts.shape !== entry.bindingShape) {
      throw new BlockRegistrationError(
        block.type,
        `accepts.shape "${block.accepts.shape}" does not match the registry binding shape "${entry.bindingShape}"`,
      );
    }
    for (const entity of block.accepts.entities ?? []) {
      if (!ctx.contracts[entity]) {
        throw new BlockRegistrationError(
          block.type,
          `accepts.entities references contract "${entity}", which was not supplied to the provider`,
        );
      }
    }
    map[block.type] = block.component;
  }

  return map;
}
