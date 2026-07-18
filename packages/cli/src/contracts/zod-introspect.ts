/**
 * Read-only introspection of the Zod schema an EntityContract carries.
 *
 * The CLI reads field/enum metadata (descriptions, enum options) that the
 * contract compiler does not surface — purely for `contracts lint`. We touch
 * Zod's stable `_def` tags rather than `instanceof`, because a vendor builds
 * their entity schema with THEIR copy of zod, and `instanceof` compares class
 * identity across copies (the same reasoning as core/define-entity.ts).
 */
import type { z } from "zod";

interface ZodDef {
  typeName?: string;
  description?: string;
  innerType?: unknown;
  schema?: unknown;
  values?: unknown;
}

function def(type: unknown): ZodDef | undefined {
  return (type as { _def?: ZodDef } | undefined)?._def;
}

/** Peel Optional/Nullable/Default/Effects wrappers to the underlying type. */
function unwrap(type: unknown): unknown {
  let current = type;
  for (;;) {
    const d = def(current);
    switch (d?.typeName) {
      case "ZodOptional":
      case "ZodNullable":
      case "ZodDefault":
        if (!d.innerType) return current;
        current = d.innerType;
        break;
      case "ZodEffects":
        if (!d.schema) return current;
        current = d.schema;
        break;
      default:
        return current;
    }
  }
}

/**
 * The human description attached via `.describe(...)`, checking the outer
 * wrapper first and then the unwrapped inner type (a vendor may describe
 * either `z.string().describe(...)` or `...describe(...).optional()`).
 *
 * @returns The trimmed description, or undefined when none is present.
 */
export function describedText(type: unknown): string | undefined {
  const outer = def(type)?.description;
  if (typeof outer === "string" && outer.trim().length > 0) return outer.trim();
  const inner = def(unwrap(type))?.description;
  if (typeof inner === "string" && inner.trim().length > 0) return inner.trim();
  return undefined;
}

/** The enum member strings for an enum field, or undefined for non-enums. */
export function enumOptions(type: unknown): string[] | undefined {
  const d = def(unwrap(type));
  if (d?.typeName !== "ZodEnum") return undefined;
  const values = d.values;
  if (Array.isArray(values)) return values.filter((v): v is string => typeof v === "string");
  return undefined;
}

/** The entity-level description on the ZodObject itself. */
export function objectDescription(schema: z.ZodTypeAny): string | undefined {
  return describedText(schema);
}
