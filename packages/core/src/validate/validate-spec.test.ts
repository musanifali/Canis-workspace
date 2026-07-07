import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineEntity } from "../contract/define-entity.js";
import { validateSpec, type ValidationContext } from "./validate-spec.js";

const caseContract = defineEntity({
  name: "case",
  schema: z.object({
    id: z.string(),
    title: z.string(),
    risk: z.enum(["low", "medium", "high", "critical"]),
    riskScore: z.number(),
    analyst: z.string(),
    dueDate: z.string(),
    amountUsd: z.number(),
  }),
  fieldKinds: { dueDate: "date" },
  capabilities: {
    filterable: ["risk", "analyst", "dueDate", "riskScore"],
    sortable: ["dueDate", "riskScore"],
    groupable: ["analyst", "risk"],
    aggregations: { amountUsd: ["sum", "avg"], riskScore: ["avg"] },
    maxLimit: 240,
  },
  fetch: async () => [],
});

const taskContract = defineEntity({
  name: "task",
  schema: z.object({ id: z.string(), owner: z.string() }),
  capabilities: { filterable: ["owner"] },
  fetch: async () => [],
});

const ctx: ValidationContext = {
  contracts: { case: caseContract, task: taskContract },
};

/** Flagship §11 spec — fully legal against the default registry + contract. */
const flagship = () => ({
  specVersion: 1,
  title: "High-risk cases due this month",
  blocks: [
    {
      id: "blk_kpis",
      type: "KpiCards",
      frame: { x: 0, y: 0, w: 12, h: 2 },
      config: { cards: [{ alias: "total", label: "High-risk due this month" }] },
      binding: {
        entity: "case",
        query: {
          filters: [
            { field: "risk", op: "in", value: ["high", "critical"] },
            { field: "dueDate", op: "between", value: { rel: "this_month" } },
          ],
          aggregations: [{ fn: "count", alias: "total" }],
        },
      },
    },
    {
      id: "blk_board",
      type: "GroupedBoard",
      frame: { x: 0, y: 2, w: 12, h: 8 },
      config: { title: "By analyst" },
      binding: {
        entity: "case",
        query: {
          filters: [{ field: "risk", op: "in", value: ["high", "critical"] }],
          groupBy: "analyst",
          sort: [{ field: "riskScore", dir: "desc" }],
          limit: 100,
        },
      },
    },
  ],
});

const codesOf = (verdict: ReturnType<typeof validateSpec>) =>
  verdict.verdict === "REJECT" ? verdict.errors.map((e) => e.code) : [];

describe("validateSpec — BUILD", () => {
  it("builds the flagship spec with no notes", () => {
    const verdict = validateSpec(flagship(), ctx);
    expect(verdict.verdict).toBe("BUILD");
    if (verdict.verdict !== "BUILD") return;
    expect(verdict.spec.blocks).toHaveLength(2);
    expect(verdict.notes).toEqual([]);
  });

  it("normalizes datetime literals on date fields and records a note", () => {
    const spec = flagship();
    spec.blocks[1]!.binding!.query.filters = [
      { field: "dueDate", op: "before", value: { abs: "2026-07-05T19:32:08Z" } },
    ] as never;
    const verdict = validateSpec(spec, ctx);
    expect(verdict.verdict).toBe("BUILD");
    if (verdict.verdict !== "BUILD") return;
    expect(verdict.notes).toEqual([
      {
        blockId: "blk_board",
        message: "truncated 2026-07-05T19:32:08Z to 2026-07-05 for day-precision field",
      },
    ]);
    const filter = verdict.spec.blocks[1]!.binding!.query.filters[0]!;
    expect((filter as { value: { abs: string } }).value.abs).toBe("2026-07-05");
  });
});

describe("validateSpec — CLARIFY", () => {
  it("asks (with options) when a data block lacks a binding, and returns the draft", () => {
    const draft = {
      specVersion: 1,
      title: "Half-built",
      blocks: [
        {
          id: "blk_t",
          type: "CasesTable",
          frame: { x: 0, y: 0, w: 12, h: 4 },
          binding: null,
        },
      ],
    };
    const verdict = validateSpec(draft, ctx);
    expect(verdict.verdict).toBe("CLARIFY");
    if (verdict.verdict !== "CLARIFY") return;
    expect(verdict.questions).toHaveLength(1);
    expect(verdict.questions[0]!.blockId).toBe("blk_t");
    expect(verdict.questions[0]!.options).toEqual(["case", "task"]);
    expect(verdict.draft).toBe(draft); // opaque, by reference (Q1)
  });

  it("REJECT wins over CLARIFY when both are present", () => {
    const spec = flagship() as Record<string, unknown>;
    (spec.blocks as unknown[]).push({
      id: "blk_null",
      type: "CasesTable",
      frame: { x: 0, y: 10, w: 12, h: 4 },
      binding: null,
    });
    (spec.blocks as { type: string }[])[0]!.type = "Nope";
    expect(validateSpec(spec, ctx).verdict).toBe("REJECT");
  });
});

describe("validateSpec — REJECT: shape & version", () => {
  it("maps shape failures to SpecShapeError with paths", () => {
    const verdict = validateSpec({ specVersion: 1, blocks: [] }, ctx);
    expect(codesOf(verdict)).toContain("SpecShapeError");
  });

  it("maps a wrong specVersion to SpecVersionError", () => {
    const verdict = validateSpec({ ...flagship(), specVersion: 2 }, ctx);
    expect(codesOf(verdict)).toContain("SpecVersionError");
  });
});

describe("validateSpec — REJECT: registry & policy", () => {
  it("rejects unknown block types, listing what is allowed", () => {
    const spec = flagship();
    spec.blocks[0]!.type = "SparkleChart";
    const verdict = validateSpec(spec, ctx);
    expect(verdict.verdict).toBe("REJECT");
    if (verdict.verdict !== "REJECT") return;
    const error = verdict.errors.find((e) => e.code === "UnknownBlockTypeError")!;
    expect(error.blockId).toBe("blk_kpis");
    expect((error as { allowed: readonly string[] }).allowed).toContain(
      "KpiCards",
    );
  });

  it("enforces the tenant block-type allowlist", () => {
    const verdict = validateSpec(flagship(), {
      ...ctx,
      policy: { allowedBlockTypes: ["KpiCards"] },
    });
    expect(codesOf(verdict)).toContain("BlockTypeNotAllowedError");
  });

  it("enforces the tenant entity allowlist", () => {
    const verdict = validateSpec(flagship(), {
      ...ctx,
      policy: { allowedEntities: ["task"] },
    });
    expect(codesOf(verdict)).toContain("EntityNotAllowedError");
  });

  it("rejects unknown entities, listing the contracts", () => {
    const spec = flagship();
    spec.blocks[0]!.binding!.entity = "kase";
    const verdict = validateSpec(spec, ctx);
    expect(verdict.verdict).toBe("REJECT");
    if (verdict.verdict !== "REJECT") return;
    const error = verdict.errors.find((e) => e.code === "UnknownEntityError")!;
    expect((error as { allowed: readonly string[] }).allowed).toEqual([
      "case",
      "task",
    ]);
  });

  it("lowers the block cap by policy — but never raises it", () => {
    expect(
      codesOf(validateSpec(flagship(), { ...ctx, policy: { maxBlocks: 1 } })),
    ).toContain("BlockCountError");
    expect(
      validateSpec(flagship(), { ...ctx, policy: { maxBlocks: 100 } }).verdict,
    ).toBe("BUILD");
  });

  it("rejects overlapping frames — the reviewer's probe case (§3)", () => {
    const spec = {
      specVersion: 1,
      title: "Overlap",
      blocks: [
        {
          id: "blk_a",
          type: "CasesTable",
          frame: { x: 0, y: 0, w: 6, h: 4 },
          binding: { entity: "case", query: { filters: [] } },
        },
        {
          id: "blk_b",
          type: "CasesTable",
          frame: { x: 3, y: 2, w: 6, h: 4 },
          binding: { entity: "case", query: { filters: [] } },
        },
      ],
    };
    const verdict = validateSpec(spec, ctx);
    expect(verdict.verdict).toBe("REJECT");
    if (verdict.verdict !== "REJECT") return;
    const error = verdict.errors.find((e) => e.code === "LayoutOverlapError")!;
    expect(error).toMatchObject({ blockIds: ["blk_a", "blk_b"] });
  });

  it("allows frames that touch edges without intersecting", () => {
    const spec = {
      specVersion: 1,
      title: "Adjacent",
      blocks: [
        {
          id: "blk_a",
          type: "CasesTable",
          frame: { x: 0, y: 0, w: 6, h: 4 },
          binding: { entity: "case", query: { filters: [] } },
        },
        {
          id: "blk_b",
          type: "CasesTable",
          frame: { x: 6, y: 0, w: 6, h: 4 },
          binding: { entity: "case", query: { filters: [] } },
        },
        {
          id: "blk_c",
          type: "CasesTable",
          frame: { x: 0, y: 4, w: 12, h: 4 },
          binding: { entity: "case", query: { filters: [] } },
        },
      ],
    };
    expect(validateSpec(spec, ctx).verdict).toBe("BUILD");
  });

  it("rejects frames outside the block type's size bounds", () => {
    const spec = flagship();
    spec.blocks[1]!.frame = { x: 0, y: 2, w: 4, h: 8 }; // GroupedBoard min w=6
    const verdict = validateSpec(spec, ctx);
    expect(verdict.verdict).toBe("REJECT");
    if (verdict.verdict !== "REJECT") return;
    const error = verdict.errors.find((e) => e.code === "FrameSizeError")!;
    expect(error).toMatchObject({ axis: "w", found: 4, min: 6, max: 12 });
  });
});

describe("validateSpec — REJECT: contract & config", () => {
  it("carries {blockId, field, allowed[]} on contract violations", () => {
    const spec = flagship();
    spec.blocks[1]!.binding!.query.filters = [
      { field: "title", op: "eq", value: "x" },
    ] as never;
    const verdict = validateSpec(spec, ctx);
    expect(verdict.verdict).toBe("REJECT");
    if (verdict.verdict !== "REJECT") return;
    const error = verdict.errors.find((e) => e.code === "ContractViolationError")!;
    expect(error).toMatchObject({
      blockId: "blk_board",
      field: "title",
      violation: "not_filterable",
      allowed: ["risk", "analyst", "dueDate", "riskScore"],
    });
  });

  it("rejects config that fails the block's config schema", () => {
    const spec = flagship();
    spec.blocks[0]!.config = { cards: [], sparkle: true } as never;
    expect(codesOf(validateSpec(spec, ctx))).toContain("ConfigSchemaError");
  });

  it("rejects config field references unknown to the entity", () => {
    const spec = flagship();
    spec.blocks[1]! = {
      id: "blk_table",
      type: "CasesTable",
      frame: { x: 0, y: 2, w: 12, h: 4 },
      config: { columns: ["id", "riks"] },
      binding: { entity: "case", query: { filters: [] } },
    } as never;
    const verdict = validateSpec(spec, ctx);
    expect(verdict.verdict).toBe("REJECT");
    if (verdict.verdict !== "REJECT") return;
    const error = verdict.errors.find(
      (e) => e.code === "ConfigFieldReferenceError",
    )!;
    expect(error).toMatchObject({ blockId: "blk_table", field: "riks" });
  });

  it("A1: rejects config aliases the binding never declares", () => {
    const spec = flagship();
    spec.blocks[0]!.config = {
      cards: [{ alias: "totals", label: "Oops" }],
    } as never;
    const verdict = validateSpec(spec, ctx);
    expect(verdict.verdict).toBe("REJECT");
    if (verdict.verdict !== "REJECT") return;
    const error = verdict.errors.find((e) => e.code === "AliasReferenceError")!;
    expect(error).toMatchObject({ alias: "totals", declared: ["total"] });
  });

  it("A2: rejects a query whose derived shape mismatches the block", () => {
    const spec = flagship();
    delete (spec.blocks[0]!.binding!.query as { aggregations?: unknown })
      .aggregations;
    spec.blocks[0]!.config = { cards: [{ alias: "total", label: "x" }] } as never;
    const verdict = validateSpec(spec, ctx);
    expect(verdict.verdict).toBe("REJECT");
    if (verdict.verdict !== "REJECT") return;
    const error = verdict.errors.find((e) => e.code === "BindingShapeError")!;
    expect(error).toMatchObject({ expected: "aggregate", derived: "rows" });
  });
});

describe("validateSpec — REJECT: FilterBar targets (Q2)", () => {
  const withFilterBar = (
    targets: string[],
    fields: string[],
    secondEntity = "case",
  ) => ({
    specVersion: 1,
    title: "Filtered",
    blocks: [
      {
        id: "blk_bar",
        type: "FilterBar",
        frame: { x: 0, y: 0, w: 12, h: 1 },
        config: { targets, fields },
        binding: null,
      },
      {
        id: "blk_q1",
        type: "CaseQueue",
        frame: { x: 0, y: 1, w: 6, h: 4 },
        binding: { entity: "case", query: { filters: [] } },
      },
      {
        id: "blk_q2",
        type: "CaseQueue",
        frame: { x: 6, y: 1, w: 6, h: 4 },
        binding: { entity: secondEntity, query: { filters: [] } },
      },
    ],
  });

  it("accepts a FilterBar over same-entity siblings with filterable fields", () => {
    const verdict = validateSpec(withFilterBar(["blk_q1", "blk_q2"], ["risk"]), ctx);
    expect(verdict.verdict).toBe("BUILD");
  });

  it("rejects targets that do not exist", () => {
    const verdict = validateSpec(withFilterBar(["blk_ghost"], ["risk"]), ctx);
    expect(codesOf(verdict)).toContain("FilterTargetError");
  });

  it("rejects targets spanning multiple entities", () => {
    const verdict = validateSpec(
      withFilterBar(["blk_q1", "blk_q2"], ["risk"], "task"),
      ctx,
    );
    expect(codesOf(verdict)).toContain("FilterTargetError");
  });

  it("rejects filter fields that are not filterable on the shared entity", () => {
    const verdict = validateSpec(withFilterBar(["blk_q1"], ["title"]), ctx);
    expect(codesOf(verdict)).toContain("FilterTargetError");
  });
});

describe("error ergonomics", () => {
  it("every error carries a non-empty message and fix", () => {
    const spec = flagship();
    spec.blocks[0]!.type = "Nope";
    spec.blocks[1]!.binding!.query.filters = [
      { field: "title", op: "eq", value: "x" },
    ] as never;
    const verdict = validateSpec(spec, { ...ctx, policy: { maxBlocks: 1 } });
    expect(verdict.verdict).toBe("REJECT");
    if (verdict.verdict !== "REJECT") return;
    expect(verdict.errors.length).toBeGreaterThanOrEqual(3);
    for (const error of verdict.errors) {
      expect(error.message.length).toBeGreaterThan(0);
      expect(error.fix.length).toBeGreaterThan(0);
    }
  });
});
