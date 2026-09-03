/**
 * A custom block type must be gated EXACTLY like a built-in (#111). If the
 * validator treated partner types more loosely, level 3 of the integration
 * would be a hole in the gate rather than an extension of it.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineEntity } from "../contract/define-entity.js";
import { validateSpec } from "../validate/validate-spec.js";
import { DEFAULT_REGISTRY } from "./registry.js";
import {
  BlockTypeDefinitionError,
  defineBlockType,
  extendRegistry,
} from "./define-block-type.js";

const contract = defineEntity({
  name: "issue",
  schema: z.object({ id: z.string(), state: z.string(), points: z.number() }),
  capabilities: {
    filterable: ["state"],
    sortable: ["points"],
    groupable: ["state"],
    aggregations: { points: ["sum"] },
    defaultLimit: 50,
    maxLimit: 100,
  },
  fetch: async () => [],
});

/** A block we don't ship: a burndown over an aggregate binding. */
const burndown = defineBlockType({
  type: "Burndown",
  bindingShape: "aggregate",
  config: z.object({ title: z.string().max(80).optional() }).strict(),
  minSize: { w: 4, h: 3 },
  maxSize: { w: 12, h: 8 },
});

const registry = extendRegistry(DEFAULT_REGISTRY, [burndown]);
const ctx = { contracts: { issue: contract }, registry };

const specWith = (block: Record<string, unknown>) => ({
  specVersion: 1,
  title: "Sprint",
  timezone: "UTC",
  layout: { columns: 12 },
  refresh: { mode: "manual" },
  blocks: [block],
});

const burndownBlock = {
  id: "blk_burn",
  type: "Burndown",
  frame: { x: 0, y: 0, w: 6, h: 4 },
  config: { title: "Burndown" },
  binding: {
    entity: "issue",
    query: { aggregations: [{ fn: "sum", field: "points", alias: "total" }] },
  },
};

describe("a custom block type is a first-class citizen", () => {
  it("BUILDs end-to-end once registered", () => {
    expect(validateSpec(specWith(burndownBlock), ctx).verdict).toBe("BUILD");
  });

  it("is REJECTed by a registry that doesn't include it", () => {
    // Same spec, default registry: the type simply doesn't exist.
    const v = validateSpec(specWith(burndownBlock), { contracts: { issue: contract } });
    expect(v.verdict).toBe("REJECT");
    if (v.verdict === "REJECT") {
      expect(v.errors[0]!.code).toBe("UnknownBlockTypeError");
    }
  });
});

describe("the gate holds a custom type to its own declaration", () => {
  it("REJECTs config the schema doesn't allow", () => {
    const v = validateSpec(
      specWith({ ...burndownBlock, config: { title: "ok", secretFlag: true } }),
      ctx,
    );
    expect(v.verdict).toBe("REJECT");
    if (v.verdict === "REJECT") {
      expect(v.errors.some((e) => e.code === "ConfigSchemaError")).toBe(true);
    }
  });

  it("REJECTs a binding whose shape doesn't match the declaration", () => {
    // Burndown declared "aggregate"; a plain rows query yields the wrong shape.
    const v = validateSpec(
      specWith({ ...burndownBlock, binding: { entity: "issue", query: { limit: 10 } } }),
      ctx,
    );
    expect(v.verdict).toBe("REJECT");
    if (v.verdict === "REJECT") {
      expect(v.errors.some((e) => e.code === "BindingShapeError")).toBe(true);
    }
  });

  it("REJECTs a frame outside the declared size bounds", () => {
    const v = validateSpec(
      specWith({ ...burndownBlock, frame: { x: 0, y: 0, w: 2, h: 1 } }),
      ctx,
    );
    expect(v.verdict).toBe("REJECT");
    if (v.verdict === "REJECT") {
      expect(v.errors.some((e) => e.code === "FrameSizeError")).toBe(true);
    }
  });
});

describe("the helper refuses declarations that would weaken the gate", () => {
  it("rejects a non-strict config schema", () => {
    // The trap this helper exists to close: a loose schema means unknown config
    // keys pass silently and the ConfigSchemaError path never fires.
    expect(() =>
      defineBlockType({
        type: "Loose",
        bindingShape: "rows",
        config: z.object({ title: z.string() }) as never,
      }),
    ).toThrow(BlockTypeDefinitionError);
  });

  it("rejects an invalid type name", () => {
    expect(() => defineBlockType({ type: "", bindingShape: "rows" })).toThrow(
      BlockTypeDefinitionError,
    );
    expect(() => defineBlockType({ type: "has space", bindingShape: "rows" })).toThrow(
      BlockTypeDefinitionError,
    );
  });

  it("rejects sizes that can't fit the grid, or min > max", () => {
    expect(() =>
      defineBlockType({ type: "TooWide", bindingShape: "rows", minSize: { w: 20, h: 2 } }),
    ).toThrow(BlockTypeDefinitionError);
    expect(() =>
      defineBlockType({
        type: "Inverted",
        bindingShape: "rows",
        minSize: { w: 8, h: 4 },
        maxSize: { w: 4, h: 2 },
      }),
    ).toThrow(BlockTypeDefinitionError);
  });

  it("refuses to silently shadow a built-in", () => {
    const clash = defineBlockType({ type: "CasesTable", bindingShape: "rows" });
    expect(() => extendRegistry(DEFAULT_REGISTRY, [clash])).toThrow(BlockTypeDefinitionError);
    // …but allows it when the caller says so explicitly.
    expect(() => extendRegistry(DEFAULT_REGISTRY, [clash], { override: true })).not.toThrow();
  });

  it("never mutates the base registry", () => {
    const before = Object.keys(DEFAULT_REGISTRY).length;
    extendRegistry(DEFAULT_REGISTRY, [burndown]);
    expect(Object.keys(DEFAULT_REGISTRY)).toHaveLength(before);
    expect(DEFAULT_REGISTRY).not.toHaveProperty("Burndown");
  });
});
