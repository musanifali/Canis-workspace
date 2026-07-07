/**
 * Block registry (Workspace Spec v1 §7).
 *
 * Each entry publishes what the policy validator needs to gate a block:
 * the config schema (a narrowed subset of the component's props), the
 * binding shape the block consumes, frame size bounds, and extractors for
 * the references config may legally make (aggregation aliases per A1,
 * entity field names, FilterBar targets per Q2).
 *
 * The default registry is the six Phase 0 blocks, hardened. Registries are
 * plain data so tenants can be handed narrowed copies.
 */
import { z } from "zod";
import { blockIdSchema } from "../spec/block.js";
import { fieldNameSchema, type BindingShape } from "../spec/query.js";

export interface BlockRegistryEntry {
  type: string;
  /** The query output shape this block renders; "none" = static, no binding. */
  bindingShape: BindingShape | "none";
  /** Strict schema for the block's `config` object. */
  configSchema: z.ZodTypeAny;
  minSize: { w: number; h: number };
  maxSize: { w: number; h: number };
  /** Aggregation aliases the config references (A1 alias↔config contract). */
  referencedAliases?: (config: Record<string, unknown>) => readonly string[];
  /** Entity field names the config references (e.g. table columns). */
  referencedFields?: (config: Record<string, unknown>) => readonly string[];
  /** Sibling block ids the config targets (FilterBar, Q2). */
  referencedTargets?: (config: Record<string, unknown>) => readonly string[];
}

export type BlockRegistry = Readonly<Record<string, BlockRegistryEntry>>;

const title = z.string().min(1).max(120);

const kpiCardSchema = z
  .object({
    alias: fieldNameSchema,
    label: z.string().min(1).max(80),
    intent: z.enum(["positive", "negative", "neutral"]).optional(),
  })
  .strict();

/** The v1 registry: the six Phase 0 blocks (Spec v1 §7). */
export const DEFAULT_REGISTRY: BlockRegistry = {
  CasesTable: {
    type: "CasesTable",
    bindingShape: "rows",
    configSchema: z
      .object({
        title: title.optional(),
        columns: z.array(fieldNameSchema).nonempty().max(12).optional(),
        emptyMessage: z.string().max(200).optional(),
      })
      .strict(),
    minSize: { w: 4, h: 3 },
    maxSize: { w: 12, h: 12 },
    referencedFields: (config) => (config.columns as string[] | undefined) ?? [],
  },
  KpiCards: {
    type: "KpiCards",
    bindingShape: "aggregate",
    configSchema: z
      .object({ cards: z.array(kpiCardSchema).nonempty().max(8) })
      .strict(),
    minSize: { w: 4, h: 2 },
    maxSize: { w: 12, h: 4 },
    referencedAliases: (config) =>
      ((config.cards as { alias: string }[] | undefined) ?? []).map(
        (card) => card.alias,
      ),
  },
  CaseQueue: {
    type: "CaseQueue",
    bindingShape: "rows",
    configSchema: z.object({ title: title.optional() }).strict(),
    minSize: { w: 3, h: 3 },
    maxSize: { w: 6, h: 12 },
  },
  FilterBar: {
    type: "FilterBar",
    bindingShape: "none",
    configSchema: z
      .object({
        targets: z.array(blockIdSchema).nonempty().max(23),
        fields: z.array(fieldNameSchema).nonempty().max(8),
      })
      .strict(),
    minSize: { w: 4, h: 1 },
    maxSize: { w: 12, h: 2 },
    referencedTargets: (config) => (config.targets as string[] | undefined) ?? [],
    referencedFields: (config) => (config.fields as string[] | undefined) ?? [],
  },
  GroupedBoard: {
    type: "GroupedBoard",
    bindingShape: "groups",
    configSchema: z.object({ title: title.optional() }).strict(),
    minSize: { w: 6, h: 4 },
    maxSize: { w: 12, h: 12 },
  },
  Graph: {
    type: "Graph",
    bindingShape: "aggregate",
    configSchema: z
      .object({
        title: title.optional(),
        kind: z.enum(["bar", "line"]).optional(),
      })
      .strict(),
    minSize: { w: 4, h: 3 },
    maxSize: { w: 12, h: 8 },
  },
};
