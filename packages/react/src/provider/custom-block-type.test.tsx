/**
 * Level 3, end to end (#111): a custom block type has to work on BOTH sides —
 * the validator must accept a spec that uses it, AND the renderer must accept a
 * component registered for it. If either half rejected the type, "bring your
 * own block type" would be documentation for something that doesn't work.
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  DEFAULT_REGISTRY,
  defineBlockType,
  defineEntity,
  extendRegistry,
  parseSpec,
  validateSpec,
} from "@ticora/core";
import { WorkspaceProvider } from "./WorkspaceProvider";
import { WorkspaceRenderer } from "../renderer/WorkspaceRenderer";
import { defineBlock } from "./defineBlock";
import { BlockRegistrationError } from "./defineBlock";
import type { BlockComponentProps } from "../renderer/types";

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
  fetch: async () => [{ id: "ENG-1", state: "done", points: 5 }],
});

const burndown = defineBlockType({
  type: "Burndown",
  bindingShape: "aggregate",
  config: z.object({ title: z.string().optional() }).strict(),
  minSize: { w: 4, h: 3 },
  maxSize: { w: 12, h: 8 },
});
const registry = extendRegistry(DEFAULT_REGISTRY, [burndown]);

const Burndown = ({ data }: BlockComponentProps) => {
  const agg = ((data as Record<string, number>[] | undefined) ?? [])[0] ?? {};
  return <div data-testid="burndown">total {agg.total ?? "—"}</div>;
};

const spec = parseSpec({
  specVersion: 1,
  title: "Sprint",
  timezone: "UTC",
  blocks: [
    {
      id: "blk_burn",
      type: "Burndown",
      frame: { x: 0, y: 0, w: 6, h: 4 },
      config: { title: "Burndown" },
      binding: {
        entity: "issue",
        query: { aggregations: [{ fn: "sum", field: "points", alias: "total" }] },
      },
    },
  ],
});

describe("a custom block type works on both sides", () => {
  it("the validator accepts it when the registry is supplied", () => {
    const v = validateSpec(spec, { contracts: { issue: contract }, registry });
    expect(v.verdict).toBe("BUILD");
  });

  it("the renderer mounts a component registered for it", async () => {
    const { findByTestId } = render(
      <WorkspaceProvider
        devMode
        registry={registry}
        contracts={[contract]}
        blocks={[
          defineBlock({
            type: "Burndown",
            accepts: { shape: "aggregate", entities: ["issue"] },
            component: Burndown,
          }),
        ]}
      >
        <WorkspaceRenderer spec={spec} />
      </WorkspaceProvider>,
    );
    // Bound block: a skeleton renders first, then the component with data.
    expect(await findByTestId("burndown")).toBeTruthy();
  });

  it("registering the component WITHOUT the registry fails loudly", () => {
    // The mistake a partner will actually make: extend the registry for the
    // gate but forget to pass it to the provider. It must not fail silently.
    expect(() =>
      render(
        <WorkspaceProvider
          devMode
          contracts={[contract]}
          blocks={[
            defineBlock({
              type: "Burndown",
              accepts: { shape: "aggregate", entities: ["issue"] },
              component: Burndown,
            }),
          ]}
        >
          <WorkspaceRenderer spec={spec} />
        </WorkspaceProvider>,
      ),
    ).toThrow(BlockRegistrationError);
  });

  it("a component whose accepts.shape disagrees with the type is refused", () => {
    expect(() =>
      render(
        <WorkspaceProvider
          devMode
          registry={registry}
          contracts={[contract]}
          blocks={[
            defineBlock({
              // Burndown is "aggregate"; claiming "rows" would render garbage.
              type: "Burndown",
              accepts: { shape: "rows" },
              component: Burndown,
            }),
          ]}
        >
          <WorkspaceRenderer spec={spec} />
        </WorkspaceProvider>,
      ),
    ).toThrow(BlockRegistrationError);
  });
});
