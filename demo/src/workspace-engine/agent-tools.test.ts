import { describe, expect, it } from "vitest";
import { toGroundedTools } from "./agent-tools";
import { contracts } from "./kit";

describe("toGroundedTools — contract-grounded Tambo tools (card #19)", () => {
  const tools = toGroundedTools(contracts);

  it("emits one query_<entity> tool per contract", () => {
    expect(tools.map((t) => t.name)).toEqual(["query_case"]);
  });

  it("describes the contract's filterable fields in the tool description", () => {
    const desc = tools[0]!.description;
    // Grounding is by construction: the description carries the real field list,
    // so the model can't reference something the contract never granted.
    expect(desc).toMatch(/risk/);
    expect(desc).toMatch(/Filterable/);
  });

  it("runs a contract-legal query through the executor and returns rows", async () => {
    const rows = (await tools[0]!.tool({
      filters: [{ field: "risk", op: "in", value: ["high", "critical"] }],
      sort: [{ field: "riskScore", dir: "desc" }],
      limit: 5,
    })) as { risk: string }[];
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(5);
    // The client-side engine applied the filter: every row is high or critical.
    expect(rows.every((r) => r.risk === "high" || r.risk === "critical")).toBe(true);
  });

  it("rejects a query that violates the contract (grounding closes at call time)", async () => {
    // `title` is filterable but `gt` is not legal on a string field — the tool
    // input schema wouldn't admit this from the model, and the executor re-checks.
    await expect(
      tools[0]!.tool({ filters: [{ field: "title", op: "gt", value: "x" }] }),
    ).rejects.toThrow();
  });
});
