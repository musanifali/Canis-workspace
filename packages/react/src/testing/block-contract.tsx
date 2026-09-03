/**
 * Block contract test kit (#110). A partner who swaps in their own components
 * needs to assert, in THEIR CI, that those components satisfy the contract the
 * renderer holds them to — so an SDK upgrade can't silently break their UI.
 *
 * Deliberately render-agnostic: you pass your own `render`. That keeps this
 * kit free of react-dom and any testing library, so importing it can't drag
 * either into a consumer's dependency tree (`@ticora/react` is SSR-compatible
 * and has `react` as its only peer — this entry does not change that).
 *
 *   import { assertBlockContract } from "@ticora/react/testing";
 *   import { render } from "@testing-library/react";
 *
 *   it("MyTable satisfies the block contract", () => {
 *     assertBlockContract(MyTable, { shape: "rows", render });
 *   });
 */
import type { ComponentType } from "react";
import { DEFAULT_REGISTRY, type Block } from "@ticora/core";
import type { BlockComponentProps } from "../renderer/types";

/** The binding output a block renders; "none" = static (no data). */
export type ContractShape = "rows" | "groups" | "aggregate" | "none";

/** One state the renderer can hand a block, with a human name for failures. */
export interface BlockState {
  /** Named so a failure says WHICH state broke, not just "it threw". */
  name: string;
  props: BlockComponentProps;
}

/** Anything that mounts an element; the return value is ignored. */
export type RenderFn = (element: React.ReactElement) => unknown;

export interface AssertBlockContractOptions {
  /**
   * The registry block type you're registering for (e.g. "Graph"). Preferred
   * over `shape`: the shape is derived from the registry, so you cannot test a
   * component against a shape the renderer would never hand it — a passing
   * assertion against the wrong shape proves nothing.
   */
  type?: string;
  /** Explicit shape. Only needed for a block type not in the registry. */
  shape?: ContractShape;
  /** Your test renderer, e.g. `render` from @testing-library/react. */
  render: RenderFn;
  /** Merged into the fixture block's `config` (titles, columns, cards…). */
  config?: Record<string, unknown>;
  /** Skip states by name — use sparingly, and say why in a comment. */
  skip?: readonly string[];
}

const SAMPLE_ROWS = [
  { id: "row-1", name: "First", status: "todo", team: "alpha", effort: 3 },
  { id: "row-2", name: "Second", status: "done", team: "beta", effort: 8 },
];

/** Data a binding of each shape actually yields (matches the executor). */
function dataFor(shape: ContractShape, empty: boolean): unknown {
  if (shape === "none") return undefined;
  if (empty) return shape === "aggregate" ? [{}] : [];
  if (shape === "rows") return SAMPLE_ROWS;
  if (shape === "groups") {
    return [
      { group: "todo", rows: [SAMPLE_ROWS[0]] },
      { group: "done", rows: [SAMPLE_ROWS[1]] },
    ];
  }
  // An aggregate binding yields ONE row of aliased values — not a flat map.
  return [{ count: 2, total: 11, avg: 5.5 }];
}

function fixtureBlock(shape: ContractShape, config: Record<string, unknown>): Block {
  return {
    id: "blk_fixture",
    type: "Fixture",
    frame: { x: 0, y: 0, w: 6, h: 4 },
    config: {
      title: "Fixture",
      // Aggregate blocks read aliases out of config.cards; supply the ones the
      // aggregate fixture provides so a correct component finds real values.
      ...(shape === "aggregate"
        ? {
            cards: [
              { alias: "count", label: "Count" },
              { alias: "total", label: "Total" },
            ],
          }
        : {}),
      ...config,
    },
    binding: shape === "none" ? null : { entity: "fixture", query: {} },
  } as unknown as Block;
}

/**
 * Every state the renderer can hand a block component, for one binding shape.
 * Exported so you can drive them yourself (snapshot each state, assert
 * accessible names, etc.) instead of using `assertBlockContract`.
 */
export function blockStates(
  shape: ContractShape,
  config: Record<string, unknown> = {},
): BlockState[] {
  const block = fixtureBlock(shape, config);
  const base = { block, refetch: () => {}, dataUpdatedAt: Date.now() };
  const err = Object.assign(new Error("fixture fetch failed"), {
    name: "BindingFetchError",
  }) as BlockComponentProps["error"];

  const states: BlockState[] = [
    {
      name: "loading",
      props: { ...base, status: "loading", data: undefined, error: null, isFetching: true, dataUpdatedAt: null },
    },
    {
      name: "success",
      props: { ...base, status: "success", data: dataFor(shape, false), error: null, isFetching: false },
    },
    {
      name: "empty",
      props: { ...base, status: "success", data: dataFor(shape, true), error: null, isFetching: false },
    },
    {
      name: "error",
      props: { ...base, status: "error", data: undefined, error: err, isFetching: false, dataUpdatedAt: null },
    },
    {
      // A background refetch failed but stale data is still on screen — the
      // state most components forget, and the one that looks worst in prod.
      name: "stale-refetching",
      props: { ...base, status: "success", data: dataFor(shape, false), error: null, isFetching: true },
    },
  ];
  return shape === "none" ? states.filter((s) => s.name !== "empty") : states;
}


/**
 * Resolve the shape to test against. A registry `type` wins: it is the shape
 * the renderer will actually produce for that block.
 * @throws Error when neither is usable — silently guessing would let a
 *   component "pass" against data it will never receive.
 */
function resolveShape({ type, shape }: { type?: string | undefined; shape?: ContractShape | undefined }): ContractShape {
  if (type) {
    const entry = (DEFAULT_REGISTRY as Record<string, { bindingShape: string } | undefined>)[type];
    if (!entry) {
      throw new Error(
        `unknown block type "${type}" — pass an explicit \`shape\` for a custom type`,
      );
    }
    return entry.bindingShape as ContractShape;
  }
  if (shape) return shape;
  throw new Error("assertBlockContract needs either a `type` or a `shape`");
}

/** Thrown when a component fails one or more contract states. */
export class BlockContractError extends Error {
  constructor(readonly failures: readonly { state: string; cause: unknown }[]) {
    super(
      `block component failed ${failures.length} contract state(s):\n` +
        failures
          .map((f) => `  - ${f.state}: ${f.cause instanceof Error ? f.cause.message : String(f.cause)}`)
          .join("\n"),
    );
    this.name = "BlockContractError";
  }
}

/**
 * Render `component` through every state the renderer can hand it and throw a
 * single aggregated error if any state fails.
 *
 * @throws BlockContractError naming each failing state.
 */
export function assertBlockContract(
  component: ComponentType<BlockComponentProps>,
  { type, shape, render, config = {}, skip = [] }: AssertBlockContractOptions,
): void {
  const resolved = resolveShape({ type, shape });
  const Component = component;
  const failures: { state: string; cause: unknown }[] = [];

  for (const state of blockStates(resolved, config)) {
    if (skip.includes(state.name)) continue;
    try {
      render(<Component {...state.props} />);
    } catch (cause) {
      failures.push({ state: state.name, cause });
    }
  }

  if (failures.length > 0) throw new BlockContractError(failures);
}
