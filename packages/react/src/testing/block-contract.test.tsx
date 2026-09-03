/**
 * The kit's own tests. The one that matters most is the LAST one: a kit that
 * can't fail a broken component is worse than no kit — it hands a partner false
 * confidence. So we prove it rejects, not just that it accepts.
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BlockComponentProps } from "../renderer/types";
import { assertBlockContract, blockStates, BlockContractError } from "./block-contract";

// The companion test — that the SHIPPED @ticora/ui blocks satisfy this kit —
// lives in packages/ui. It cannot live here: @ticora/ui depends on this package,
// so importing it back would be a cycle. It only ever resolved because npm
// symlinks every workspace package into the root node_modules, which made an
// undeclared dependency look fine locally and fail in CI on a cold cache.

describe("fixtures", () => {
  it("covers every binding shape with the states a block can receive", () => {
    for (const shape of ["rows", "groups", "aggregate", "none"] as const) {
      const names = blockStates(shape).map((s) => s.name);
      expect(names).toContain("loading");
      expect(names).toContain("success");
      expect(names).toContain("error");
      expect(names).toContain("stale-refetching");
      // A static block has no query, so "empty" is meaningless for it.
      if (shape !== "none") expect(names).toContain("empty");
    }
  });

  it("gives an aggregate binding ONE row of aliased values, not a flat map", () => {
    const success = blockStates("aggregate").find((s) => s.name === "success")!;
    expect(Array.isArray(success.props.data)).toBe(true);
    expect((success.props.data as Record<string, number>[])[0]).toHaveProperty("count");
  });
});

/** Any component will do below: these assertions reject the ARGUMENTS, before
 *  anything is ever rendered. */
const Anything = ({ data }: BlockComponentProps) => <div>{(data as unknown[])?.length ?? 0}</div>;

describe("shape resolution can't be fudged", () => {
  it("derives the shape from the registry, not the caller", () => {
    // Graph is an aggregate block. If the kit trusted a caller who said "rows",
    // the assertion would pass against data Graph never receives.
    expect(blockStates("aggregate").find((s) => s.name === "success")!.props.data)
      .not.toEqual(blockStates("rows").find((s) => s.name === "success")!.props.data);
  });

  it("refuses an unknown type instead of guessing", () => {
    expect(() => assertBlockContract(Anything, { type: "NotARealBlock", render })).toThrow(
      /unknown block type/,
    );
  });

  it("refuses when given neither type nor shape", () => {
    expect(() => assertBlockContract(Anything, { render })).toThrow(/needs either/);
  });
});

describe("the kit has teeth", () => {
  it("FAILS a component that throws on the error state", () => {
    // The classic bug: reads `data` without guarding, so any state where data
    // is undefined explodes. A partner must find this in CI, not in prod.
    const Careless = ({ data }: BlockComponentProps) => (
      <div>{(data as { id: string }[]).map((r) => r.id).join(",")}</div>
    );
    expect(() => assertBlockContract(Careless, { shape: "rows", render })).toThrow(
      BlockContractError,
    );
  });

  it("names WHICH states failed, so the fix is obvious", () => {
    const Careless = ({ data }: BlockComponentProps) => (
      <div>{(data as { id: string }[]).length}</div>
    );
    try {
      assertBlockContract(Careless, { shape: "rows", render });
      throw new Error("expected the kit to fail this component");
    } catch (e) {
      expect(e).toBeInstanceOf(BlockContractError);
      const err = e as BlockContractError;
      // undefined data → loading and error states are the ones that break.
      const failed = err.failures.map((f) => f.state);
      expect(failed).toContain("loading");
      expect(failed).toContain("error");
      expect(err.message).toMatch(/loading|error/);
    }
  });

  it("passes a component that handles every state", () => {
    const Careful = ({ data, status }: BlockComponentProps) => {
      if (status === "loading") return <div>loading…</div>;
      if (status === "error") return <div>failed</div>;
      const rows = (data as unknown[] | undefined) ?? [];
      return <div>{rows.length} rows</div>;
    };
    expect(() => assertBlockContract(Careful, { shape: "rows", render })).not.toThrow();
  });
});
