// The guarantee, as a test: the gate is unchanged by whose components render.
// The same spec that BUILDs here would BUILD against the default blocks — and
// a spec asking for data the contract doesn't expose is REJECTed either way.
import { validateSpec } from "@ticora/core";
import { expect, test } from "vitest";
import { issueContract } from "./contract";

const ctx = { contracts: { issue: issueContract } };

const boardSpec = {
  specVersion: 1,
  title: "Sprint board",
  timezone: "UTC",
  layout: { columns: 12 },
  refresh: { mode: "manual" },
  blocks: [
    {
      id: "blk_board",
      type: "GroupedBoard",
      frame: { x: 0, y: 0, w: 12, h: 6 },
      config: { title: "By state" },
      binding: { entity: "issue", query: { groupBy: "state" } },
    },
  ],
};

test("a spec over the contract BUILDs — your components render it", () => {
  expect(validateSpec(boardSpec, ctx).verdict).toBe("BUILD");
});

test("your components do NOT widen what the gate allows", () => {
  // "salary" is not on the issue contract. Swapping in your own components
  // changes the pixels, never the policy — this is still refused.
  const exfil = {
    ...boardSpec,
    blocks: [
      {
        ...boardSpec.blocks[0],
        binding: { entity: "issue", query: { sort: [{ field: "salary", dir: "desc" }] } },
      },
    ],
  };
  const verdict = validateSpec(exfil, ctx);
  expect(verdict.verdict).toBe("REJECT");
});
