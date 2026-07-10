/**
 * Policy validator (Workspace Spec v1 §10, card #9).
 *
 * `validateSpec(input, ctx)` → BUILD | CLARIFY | REJECT, a pure function.
 * Nothing half-hallucinated ever reaches the renderer: every block type,
 * config key, field, op, alias, and FilterBar target is checked against the
 * registry, the entity contracts, and the tenant policy. Every error names
 * what failed, why, and what is allowed.
 *
 * CLARIFY is deliberately narrow at this layer: a well-formed block that
 * *lacks a required binding* is the one under-determination the validator
 * can prove needs a user answer. Ambiguity detection at generation time
 * (Phase 3) produces its own CLARIFYs before the spec gets here.
 */
import { deriveBindingShape, type QuerySpec } from "../spec/query.js";
import { parseSpec, SpecParseError } from "../spec/serde.js";
import { SPEC_VERSION, type WorkspaceSpec } from "../spec/workspace.js";
import {
  compileToValidator,
  OPS_BY_KIND,
  type PolicyViolation,
} from "../contract/compile.js";
import type { EntityContract } from "../contract/define-entity.js";
import { DEFAULT_REGISTRY, type BlockRegistry } from "../registry/registry.js";

/** v1 hard cap on blocks; tenant policy may lower it, never raise it (Q3). */
export const MAX_BLOCKS = 24;

export interface TenantPolicy {
  /** Block types this tenant may use; omit = full registry. */
  allowedBlockTypes?: readonly string[];
  /** Entities this tenant may bind; omit = all provided contracts. */
  allowedEntities?: readonly string[];
  /** Lower block cap; values above MAX_BLOCKS are clamped down to it. */
  maxBlocks?: number;
}

export interface ValidationContext {
  contracts: Readonly<Record<string, EntityContract>>;
  registry?: BlockRegistry;
  policy?: TenantPolicy;
}

interface SpecErrorBase {
  blockId?: string;
  /** What failed and why. */
  message: string;
  /** What to do about it. */
  fix: string;
}

export type SpecValidationError = SpecErrorBase &
  (
    | { code: "SpecShapeError"; path: string }
    | { code: "SpecVersionError"; found: unknown; supported: number }
    | { code: "BlockCountError"; count: number; max: number }
    | { code: "UnknownBlockTypeError"; type: string; allowed: readonly string[] }
    | { code: "BlockTypeNotAllowedError"; type: string; allowed: readonly string[] }
    | { code: "FrameSizeError"; axis: "w" | "h"; found: number; min: number; max: number }
    | { code: "ConfigSchemaError"; path: string }
    | { code: "ConfigFieldReferenceError"; field: string; allowed: readonly string[] }
    | { code: "UnknownEntityError"; entity: string; allowed: readonly string[] }
    | { code: "EntityNotAllowedError"; entity: string; allowed: readonly string[] }
    | {
        code: "ContractViolationError";
        entity: string;
        violation: PolicyViolation["code"];
        field?: string | undefined;
        allowed: readonly string[];
      }
    | { code: "LayoutOverlapError"; blockIds: readonly [string, string] }
    | { code: "BindingShapeError"; expected: string; derived: string }
    | { code: "AliasReferenceError"; alias: string; declared: readonly string[] }
    | { code: "FilterTargetError"; target?: string | undefined; reason: string }
  );

export interface ClarifyQuestion {
  blockId?: string;
  question: string;
  /** Machine-readable candidates the user can pick from, when known. */
  options?: readonly string[];
}

/** Non-fatal adjustments made on the way to BUILD (e.g. date truncation). */
export interface ValidationNote {
  blockId: string;
  message: string;
}

export type ValidationVerdict =
  | { verdict: "BUILD"; spec: WorkspaceSpec; notes: readonly ValidationNote[] }
  | {
      verdict: "CLARIFY";
      questions: readonly ClarifyQuestion[];
      /** Opaque resume-context for amendment (Q1) — never rendered. */
      draft: unknown;
    }
  | { verdict: "REJECT"; errors: readonly SpecValidationError[] };

/**
 * Validate a candidate spec against contracts, registry, and tenant policy.
 *
 * @param input Raw candidate (object or JSON string) — shape-checked here
 * @returns BUILD with the (possibly normalized) spec + notes, CLARIFY with
 *          questions + the untouched draft, or REJECT with typed errors
 */
export function validateSpec(
  input: unknown,
  ctx: ValidationContext,
): ValidationVerdict {
  const registry = ctx.registry ?? DEFAULT_REGISTRY;
  const policy = ctx.policy ?? {};

  let spec: WorkspaceSpec;
  try {
    spec = parseSpec(input);
  } catch (error) {
    if (error instanceof SpecParseError) {
      return { verdict: "REJECT", errors: shapeErrors(error) };
    }
    throw error;
  }

  const errors: SpecValidationError[] = [];
  const questions: ClarifyQuestion[] = [];
  const notes: ValidationNote[] = [];

  const allowedTypes = Object.keys(registry).filter(
    (type) => !policy.allowedBlockTypes || policy.allowedBlockTypes.includes(type),
  );
  const allowedEntities = Object.keys(ctx.contracts).filter(
    (entity) => !policy.allowedEntities || policy.allowedEntities.includes(entity),
  );

  const maxBlocks = Math.min(MAX_BLOCKS, Math.max(1, policy.maxBlocks ?? MAX_BLOCKS));
  if (spec.blocks.length > maxBlocks) {
    errors.push({
      code: "BlockCountError",
      count: spec.blocks.length,
      max: maxBlocks,
      message: `spec has ${spec.blocks.length} blocks; this tenant allows ${maxBlocks}`,
      fix: `remove ${spec.blocks.length - maxBlocks} block(s) or split into multiple workspaces`,
    });
  }

  // §3 no-overlap rule: frames may not intersect (touching edges are fine).
  for (let i = 0; i < spec.blocks.length; i++) {
    for (let j = i + 1; j < spec.blocks.length; j++) {
      const a = spec.blocks[i]!;
      const b = spec.blocks[j]!;
      if (
        a.frame.x < b.frame.x + b.frame.w &&
        b.frame.x < a.frame.x + a.frame.w &&
        a.frame.y < b.frame.y + b.frame.h &&
        b.frame.y < a.frame.y + a.frame.h
      ) {
        errors.push({
          code: "LayoutOverlapError",
          blockIds: [a.id, b.id],
          message: `blocks "${a.id}" and "${b.id}" have overlapping frames`,
          fix: "move or resize one frame so the two rectangles do not intersect (gaps are allowed)",
        });
      }
    }
  }

  const normalizedBlocks: WorkspaceSpec["blocks"][number][] = [];

  for (const block of spec.blocks) {
    let normalized = block;
    const entry = registry[block.type];

    if (!entry) {
      errors.push({
        code: "UnknownBlockTypeError",
        blockId: block.id,
        type: block.type,
        allowed: allowedTypes,
        message: `block "${block.id}" uses unknown type "${block.type}"`,
        fix: `use one of the registered block types: ${allowedTypes.join(", ")}`,
      });
      normalizedBlocks.push(normalized);
      continue;
    }

    if (policy.allowedBlockTypes && !policy.allowedBlockTypes.includes(block.type)) {
      errors.push({
        code: "BlockTypeNotAllowedError",
        blockId: block.id,
        type: block.type,
        allowed: allowedTypes,
        message: `block type "${block.type}" is not allowed for this tenant`,
        fix: `use one of the tenant's allowed types: ${allowedTypes.join(", ")}`,
      });
    }

    for (const axis of ["w", "h"] as const) {
      const found = block.frame[axis];
      const [min, max] = [entry.minSize[axis], entry.maxSize[axis]];
      if (found < min || found > max) {
        errors.push({
          code: "FrameSizeError",
          blockId: block.id,
          axis,
          found,
          min,
          max,
          message: `block "${block.id}" (${block.type}) has ${axis}=${found}, outside ${min}..${max}`,
          fix: `resize the frame so ${axis} is between ${min} and ${max}`,
        });
      }
    }

    const configResult = entry.configSchema.safeParse(block.config);
    if (!configResult.success) {
      for (const issue of configResult.error.issues) {
        errors.push({
          code: "ConfigSchemaError",
          blockId: block.id,
          path: issue.path.join(".") || "(root)",
          message: `block "${block.id}" (${block.type}) config invalid at ${issue.path.join(".") || "(root)"}: ${issue.message}`,
          fix: `make config match the ${block.type} config schema`,
        });
      }
    }
    const config = configResult.success
      ? (configResult.data as Record<string, unknown>)
      : undefined;

    // ---- binding vs the block's declared shape -------------------------
    if (entry.bindingShape === "none") {
      if (block.binding !== null) {
        errors.push({
          code: "BindingShapeError",
          blockId: block.id,
          expected: "none",
          derived: deriveBindingShape(block.binding.query),
          message: `block "${block.id}" (${block.type}) is static but has a data binding`,
          fix: `set "binding": null on ${block.type} blocks`,
        });
      }
    } else if (block.binding === null) {
      questions.push({
        blockId: block.id,
        question: `Block "${block.id}" (${block.type}) has no data binding — which entity should it show?`,
        options: allowedEntities,
      });
    } else {
      const { entity, query } = block.binding;
      const contract = ctx.contracts[entity];

      if (!contract) {
        errors.push({
          code: "UnknownEntityError",
          blockId: block.id,
          entity,
          allowed: allowedEntities,
          message: `block "${block.id}" binds unknown entity "${entity}"`,
          fix: `bind one of: ${allowedEntities.join(", ")}`,
        });
      } else {
        if (policy.allowedEntities && !policy.allowedEntities.includes(entity)) {
          errors.push({
            code: "EntityNotAllowedError",
            blockId: block.id,
            entity,
            allowed: allowedEntities,
            message: `entity "${entity}" is not allowed for this tenant`,
            fix: `bind one of the tenant's allowed entities: ${allowedEntities.join(", ")}`,
          });
        }

        for (const violation of compileToValidator(contract)(query)) {
          errors.push(contractViolationError(block.id, entity, contract, violation));
        }

        const derived = deriveBindingShape(query);
        if (derived !== entry.bindingShape) {
          errors.push({
            code: "BindingShapeError",
            blockId: block.id,
            expected: entry.bindingShape,
            derived,
            message: `block "${block.id}" (${block.type}) needs a "${entry.bindingShape}" query but the binding derives "${derived}"`,
            fix: shapeFix(entry.bindingShape),
          });
        }

        // Config → entity field references (e.g. table columns).
        if (config && entry.referencedFields) {
          for (const field of entry.referencedFields(config)) {
            if (!(field in contract.fields)) {
              errors.push({
                code: "ConfigFieldReferenceError",
                blockId: block.id,
                field,
                allowed: Object.keys(contract.fields),
                message: `block "${block.id}" config references unknown ${entity} field "${field}"`,
                fix: `reference one of: ${Object.keys(contract.fields).join(", ")}`,
              });
            }
          }
        }

        // A1: every alias referenced in config is declared by the binding.
        if (config && entry.referencedAliases) {
          const declared = (query.aggregations ?? []).map((agg) => agg.alias);
          for (const alias of entry.referencedAliases(config)) {
            if (!declared.includes(alias)) {
              errors.push({
                code: "AliasReferenceError",
                blockId: block.id,
                alias,
                declared,
                message: `block "${block.id}" config references alias "${alias}" not declared in binding.query.aggregations`,
                fix: declared.length
                  ? `use a declared alias (${declared.join(", ")}) or add the aggregation`
                  : `add an aggregation with alias "${alias}" to the binding`,
              });
            }
          }
        }

        // §5: normalize datetime literals sent against date fields.
        const truncated = truncateDateFilters(block.id, query, contract, notes);
        if (truncated !== query) {
          normalized = { ...block, binding: { entity, query: truncated } };
        }
      }
    }

    // Q2: FilterBar target rules — exist, share one entity, filterable fields.
    if (config && entry.referencedTargets) {
      validateTargets(block.id, entry.referencedTargets(config), config, entry, spec, ctx, errors);
    }

    normalizedBlocks.push(normalized);
  }

  if (errors.length > 0) return { verdict: "REJECT", errors };
  if (questions.length > 0) return { verdict: "CLARIFY", questions, draft: input };
  return { verdict: "BUILD", spec: { ...spec, blocks: normalizedBlocks }, notes };
}

// ---------------------------------------------------------------------------

function shapeErrors(error: SpecParseError): SpecValidationError[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".") || "(root)";
    if (issue.path[0] === "specVersion") {
      return {
        code: "SpecVersionError" as const,
        found: "received" in issue ? issue.received : undefined,
        supported: SPEC_VERSION,
        message: `unsupported specVersion (${issue.message})`,
        fix: `emit specVersion ${SPEC_VERSION}; older stored specs are migrated lazily, never re-emitted`,
      };
    }
    return {
      code: "SpecShapeError" as const,
      path,
      message: `${path}: ${issue.message}`,
      fix: "correct the spec shape to match Workspace Spec v1",
    };
  });
}

function contractViolationError(
  blockId: string,
  entity: string,
  contract: EntityContract,
  violation: PolicyViolation,
): SpecValidationError {
  const { capabilities, fields } = contract;
  const allowed: readonly string[] = (() => {
    switch (violation.code) {
      case "unknown_field":
        return Object.keys(fields);
      case "not_filterable":
        return [...capabilities.filterable];
      case "op_not_allowed": {
        const kind = violation.field ? fields[violation.field] : undefined;
        return kind ? OPS_BY_KIND[kind] : [];
      }
      case "not_sortable":
        return [...capabilities.sortable];
      case "not_groupable":
        return [...capabilities.groupable];
      case "aggregation_not_allowed":
        return [
          "count",
          ...Object.entries(capabilities.aggregations).flatMap(([field, fns]) =>
            fns.map((fn) => `${fn}(${field})`),
          ),
        ];
      case "limit_exceeded":
        return [`1..${capabilities.maxLimit}`];
    }
  })();

  return {
    code: "ContractViolationError",
    blockId,
    entity,
    violation: violation.code,
    field: violation.field,
    allowed,
    message: `block "${blockId}": ${violation.message}`,
    fix: `allowed: ${allowed.join(", ")}`,
  };
}

function shapeFix(expected: string): string {
  switch (expected) {
    case "rows":
      return "remove groupBy and aggregations from the query";
    case "groups":
      return "add a groupBy field (and no aggregations) to the query";
    case "aggregate":
      return "add at least one aggregation to the query";
    default:
      return 'set "binding": null';
  }
}

function validateTargets(
  blockId: string,
  targets: readonly string[],
  config: Record<string, unknown>,
  entry: { referencedFields?: (config: Record<string, unknown>) => readonly string[] },
  spec: WorkspaceSpec,
  ctx: ValidationContext,
  errors: SpecValidationError[],
) {
  const flag = (reason: string, target?: string, fix?: string) =>
    errors.push({
      code: "FilterTargetError",
      blockId,
      target,
      reason,
      message: `block "${blockId}": ${reason}`,
      fix:
        fix ??
        "target sibling blocks that bind one shared entity, filtering only its filterable fields",
    });

  const entities = new Set<string>();
  for (const target of targets) {
    const targetBlock = spec.blocks.find((candidate) => candidate.id === target);
    if (!targetBlock) {
      flag(`target "${target}" does not exist in this spec`, target);
    } else if (targetBlock.id === blockId) {
      flag("a FilterBar cannot target itself", target);
    } else if (targetBlock.binding === null) {
      flag(`target "${target}" has no data binding to filter`, target);
    } else {
      entities.add(targetBlock.binding.entity);
    }
  }
  if (entities.size > 1) {
    flag(`targets span multiple entities (${[...entities].join(", ")}); they must share one`);
  }
  if (entities.size === 1) {
    const entity = [...entities][0]!;
    const contract = ctx.contracts[entity];
    if (contract) {
      // Q2 (v1): a field the FilterBar drives must be filterable AND text-kind.
      // The bar emits `contains` per keystroke, and `contains` is legal only on
      // string fields (§5). An enum/number/date field passes `filterable` at
      // save but breaks the target block at the first keystroke — reject it here
      // instead. Kind-aware controls (enum→select, number→range) are a later card.
      const textFilterable = [...contract.capabilities.filterable].filter((f) =>
        OPS_BY_KIND[contract.fields[f]!].includes("contains"),
      );
      for (const field of entry.referencedFields?.(config) ?? []) {
        if (!contract.capabilities.filterable.has(field)) {
          flag(
            `field "${field}" is not filterable on "${entity}" (filterable: ${[...contract.capabilities.filterable].join(", ")})`,
          );
        } else if (!OPS_BY_KIND[contract.fields[field]!].includes("contains")) {
          flag(
            `field "${field}" is a ${contract.fields[field]} field; the v1 FilterBar filters text only (contains), so it can only target string-kind fields (available on "${entity}": ${textFilterable.join(", ") || "(none)"})`,
            undefined,
            "filter only string-kind fields in v1; kind-aware FilterBar controls (enum/number/date) are a later card",
          );
        }
      }
    }
  }
}

/**
 * §5 date normalization: a datetime literal against a day-precision `date`
 * field is truncated to the day, with a note — never a silent boundary shift
 * (Phase 0 lesson) and never a rejection (the intent is unambiguous).
 */
function truncateDateFilters(
  blockId: string,
  query: QuerySpec,
  contract: EntityContract,
  notes: ValidationNote[],
): QuerySpec {
  let changed = false;

  const truncate = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(truncate);
    if (
      value !== null &&
      typeof value === "object" &&
      "abs" in value &&
      typeof (value as { abs: unknown }).abs === "string" &&
      (value as { abs: string }).abs.includes("T")
    ) {
      const abs = (value as { abs: string }).abs;
      const day = abs.slice(0, 10);
      changed = true;
      notes.push({
        blockId,
        message: `truncated ${abs} to ${day} for day-precision field`,
      });
      return { ...(value as object), abs: day };
    }
    return value;
  };

  const filters = query.filters.map((filter) =>
    contract.fields[filter.field] === "date" && "value" in filter
      ? ({ ...filter, value: truncate(filter.value) } as typeof filter)
      : filter,
  );

  return changed ? { ...query, filters } : query;
}
