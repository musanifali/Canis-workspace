import { describe, expect, it } from "vitest";
import { loadSpecsFromDir } from "./load.js";
import { SPECS_DIR } from "../__fixtures__/paths.js";

describe("loadSpecsFromDir", () => {
  it("reads every *.json spec with its title, sorted by file name", async () => {
    const specs = await loadSpecsFromDir(SPECS_DIR);
    expect(specs.map((s) => s.id)).toEqual([
      "by-analyst.json",
      "high-risk-due.json",
      "sla-breach-watch.json",
    ]);
    const sla = specs.find((s) => s.id === "sla-breach-watch.json")!;
    expect(sla.title).toBe("SLA breach watch");
    expect(sla.source).toContain("sla-breach-watch.json");
  });
});
