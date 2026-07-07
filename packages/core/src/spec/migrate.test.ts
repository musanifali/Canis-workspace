import { describe, expect, it } from "vitest";
import {
  createMigrationRunner,
  migrateSpec,
  SpecMigrationError,
} from "./migrate.js";
import { parseSpec } from "./serde.js";
import type { WorkspaceSpec } from "./workspace.js";

const v1Spec = () => ({
  specVersion: 1,
  title: "Saved workspace",
  blocks: [
    {
      id: "blk_a",
      type: "CasesTable",
      frame: { x: 0, y: 0, w: 12, h: 4 },
      binding: { entity: "case", query: { filters: [] } },
    },
  ],
});

describe("migrateSpec — v1 baseline", () => {
  it("loads a current-version spec through plain validation", () => {
    expect(migrateSpec(v1Spec())).toEqual(parseSpec(v1Spec()));
  });

  it("accepts stored JSON strings", () => {
    expect(migrateSpec(JSON.stringify(v1Spec()))).toEqual(parseSpec(v1Spec()));
  });

  it("never mutates the stored object (lazy read, no rewrite-in-place)", () => {
    const stored = v1Spec();
    const snapshot = structuredClone(stored);
    migrateSpec(stored);
    expect(stored).toEqual(snapshot);
  });
});

describe("migrateSpec — fail-fast cases", () => {
  it("rejects a FUTURE version with a clear upgrade-the-engine error", () => {
    expect(() => migrateSpec({ ...v1Spec(), specVersion: 99 })).toThrow(
      SpecMigrationError,
    );
    expect(() => migrateSpec({ ...v1Spec(), specVersion: 99 })).toThrow(
      /v99.*only knows v1.*upgrade the engine/s,
    );
  });

  it("rejects missing or garbage specVersion", () => {
    for (const specVersion of [undefined, null, "one", 1.5, 0, -2]) {
      expect(() => migrateSpec({ ...v1Spec(), specVersion })).toThrow(
        SpecMigrationError,
      );
    }
  });

  it("rejects non-object stored values and malformed JSON", () => {
    for (const stored of [null, 42, ["not", "a", "spec"], "{oops", "null"]) {
      expect(() => migrateSpec(stored)).toThrow(SpecMigrationError);
    }
  });
});

describe("createMigrationRunner — chain mechanics", () => {
  const passthrough = (candidate: unknown) => candidate as WorkspaceSpec;

  it("rejects chains with gaps at construction (§9: old specs load forever)", () => {
    expect(() =>
      createMigrationRunner([{ from: 2, migrate: (spec) => spec }], {
        currentVersion: 3,
        finalize: passthrough,
      }),
    ).toThrow(/gaps.*v1/);
  });

  it("rejects duplicate steps at construction", () => {
    expect(() =>
      createMigrationRunner(
        [
          { from: 1, migrate: (spec) => spec },
          { from: 1, migrate: (spec) => spec },
        ],
        { currentVersion: 2, finalize: passthrough },
      ),
    ).toThrow(/duplicate/);
  });

  it("composes v1→v2→v3, stamping specVersion after every step", () => {
    const runner = createMigrationRunner(
      [
        {
          from: 1,
          migrate: ({ title, ...rest }) => ({ ...rest, heading: title }),
        },
        { from: 2, migrate: (spec) => ({ ...spec, tags: [] }) },
      ],
      { currentVersion: 3, finalize: passthrough },
    );
    const stored = v1Spec();
    const snapshot = structuredClone(stored);

    const migrated = runner(stored) as unknown as Record<string, unknown>;
    expect(migrated.specVersion).toBe(3);
    expect(migrated.heading).toBe("Saved workspace");
    expect(migrated.title).toBeUndefined();
    expect(migrated.tags).toEqual([]);
    // Customer data untouched:
    expect(stored).toEqual(snapshot);
  });

  it("starts mid-chain when the stored spec is already partially current", () => {
    const runner = createMigrationRunner(
      [
        { from: 1, migrate: () => ({ never: "runs" }) },
        { from: 2, migrate: (spec) => ({ ...spec, tags: [] }) },
      ],
      { currentVersion: 3, finalize: passthrough },
    );
    const migrated = runner({
      ...v1Spec(),
      specVersion: 2,
    }) as unknown as Record<string, unknown>;
    expect(migrated.specVersion).toBe(3);
    expect(migrated.never).toBeUndefined();
    expect(migrated.tags).toEqual([]);
  });
});
