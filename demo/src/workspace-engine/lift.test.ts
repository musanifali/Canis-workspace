import { describe, expect, it } from "vitest";
import type { EntityContract, ValidationContext } from "@workspace-engine/core";
import { liftWorkspaceSpec, LiftError } from "./lift";
import { contracts } from "./kit";
import { demoWorkspaces } from "./specs";

const ctx: ValidationContext = {
  contracts: Object.fromEntries(contracts.map((c: EntityContract) => [c.name, c])),
};

const snapshotWith = (spec: unknown) => [
  { name: "GeneratedWorkspace", props: { spec } },
];

describe("liftWorkspaceSpec — capture a saveable spec (card #21)", () => {
  it("lifts and validates the live workspace's spec (criterion 1)", () => {
    const spec = liftWorkspaceSpec(snapshotWith(demoWorkspaces[0]!.spec), ctx);
    expect(spec.blocks.length).toBeGreaterThan(0);
    expect(spec.title).toBe(demoWorkspaces[0]!.spec.title);
  });

  it("lifts the most recent workspace when several were generated", () => {
    const snapshot = [
      { name: "GeneratedWorkspace", props: { spec: demoWorkspaces[1]!.spec } },
      { name: "GeneratedWorkspace", props: { spec: demoWorkspaces[0]!.spec } },
    ];
    expect(liftWorkspaceSpec(snapshot, ctx).title).toBe(demoWorkspaces[0]!.spec.title);
  });

  it("strips a stray top-level key the model added, still lifts", () => {
    const withExtra = { ...demoWorkspaces[0]!.spec, description: "noise" };
    expect(() => liftWorkspaceSpec(snapshotWith(withExtra), ctx)).not.toThrow();
  });

  it("fails fast when there's no workspace to save (criterion 3)", () => {
    expect(() => liftWorkspaceSpec([], ctx)).toThrow(LiftError);
    expect(() => liftWorkspaceSpec([], ctx)).toThrow(/generate one first/);
  });

  it("fails fast while the workspace is still composing (criterion 3)", () => {
    expect(() => liftWorkspaceSpec(snapshotWith(undefined), ctx)).toThrow(/still composing/);
  });

  it("fails fast with the contract reason for an unliftable (invalid) spec (criterion 3)", () => {
    const badSpec = {
      specVersion: 1,
      title: "Bad",
      blocks: [
        {
          id: "blk_a",
          type: "CasesTable",
          frame: { x: 0, y: 0, w: 12, h: 6 },
          config: {},
          binding: { entity: "case", query: { filters: [{ field: "nope", op: "eq", value: "x" }] } },
        },
      ],
    };
    expect(() => liftWorkspaceSpec(snapshotWith(badSpec), ctx)).toThrow(/can't be saved yet/);
    expect(() => liftWorkspaceSpec(snapshotWith(badSpec), ctx)).toThrow(/nope/);
  });
});
