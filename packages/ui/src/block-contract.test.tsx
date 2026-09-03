/**
 * The blocks we ship must pass the contract kit we hand partners (#110).
 *
 * If our own default blocks couldn't satisfy `assertBlockContract`, the kit
 * would be asking partners to clear a bar we don't clear ourselves — and a
 * partner debugging their component against it deserves to know the reference
 * implementation passes.
 *
 * This lives here rather than beside the kit in @ticora/react because @ticora/ui
 * depends on @ticora/react; importing these components back into that package
 * would be a dependency cycle. It only appeared to work before because npm
 * symlinks every workspace package into the root node_modules, so an undeclared
 * import resolved locally and broke in CI the first time the cache missed.
 */
import { assertBlockContract } from "@ticora/react/testing";
import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import { Board, Graph, KpiCards, Queue, Table } from "./blocks/data-blocks";
import { FilterBar } from "./blocks/filter-bar";

describe("the shipped default blocks satisfy their own contract", () => {
  // Pass the registry TYPE, not a hand-written shape: the kit derives the shape
  // the renderer actually produces. Asserting against a hand-picked shape is
  // how you get a vacuous pass (Graph is "aggregate", not "rows").
  it.each([
    ["CasesTable", Table],
    ["GroupedBoard", Board],
    ["KpiCards", KpiCards],
    ["CaseQueue", Queue],
    ["Graph", Graph],
    ["FilterBar", FilterBar],
  ])("%s", (type, Component) => {
    assertBlockContract(Component, { type, render });
  });
});
