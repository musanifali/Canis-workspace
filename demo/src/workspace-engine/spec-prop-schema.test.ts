import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DEFAULT_REGISTRY, workspaceSpecSchema } from "@workspace-engine/core";
import { BLOCK_TYPES, configSchema, specPropSchema } from "./spec-prop-schema";
import { demoWorkspaces } from "./specs";

/**
 * specPropSchema hand-mirrors the spec shape to give the model a Tambo-safe
 * schema to generate against (the #70 fix). Nothing structurally ties it to
 * core, so these tests fail CI the moment the mirror drifts (review P3 #71).
 */
describe("specPropSchema stays consistent with core", () => {
  it("admits every registered block type (registry types ⊆ enum)", () => {
    const admitted = new Set<string>(BLOCK_TYPES);
    for (const type of Object.keys(DEFAULT_REGISTRY)) {
      expect(admitted).toContain(type);
    }
  });

  it("admits every registry config key (registry config keys ⊆ config union)", () => {
    const allowed = new Set(Object.keys(configSchema.shape));
    for (const [type, entry] of Object.entries(DEFAULT_REGISTRY)) {
      const shape = (entry.configSchema as z.ZodObject<z.ZodRawShape>).shape;
      for (const key of Object.keys(shape)) {
        expect(allowed, `config key "${key}" of block "${type}"`).toContain(key);
      }
    }
  });

  it("parses a core-valid spec (no false negatives vs workspaceSpecSchema)", () => {
    for (const { spec } of demoWorkspaces) {
      // Sanity: the fixture really is core-valid.
      expect(() => workspaceSpecSchema.parse(spec)).not.toThrow();
      // The mirror must not reject what core accepts.
      expect(() => specPropSchema.parse(spec), spec.title).not.toThrow();
    }
  });
});
