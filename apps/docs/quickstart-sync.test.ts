/**
 * The stopwatch claim's anti-rot guard (#30, decision D2): every fenced code
 * block in the quickstart tagged `filename="…"` must byte-match the real,
 * compiled, tested file in examples/quickstart. If the docs and the example
 * drift, CI fails — the quickstart cannot quietly stop working.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(join(__dirname, "content", "quickstart.mdx"), "utf8");
const exampleDir = join(__dirname, "..", "..", "examples", "quickstart");

const blocks = [...page.matchAll(/```(?:ts|tsx) filename="([^"]+)"\n([\s\S]*?)```/g)].map(
  (match) => ({ file: match[1]!, code: match[2]! }),
);

describe("quickstart page ↔ examples/quickstart sync", () => {
  it("has one tagged block per quickstart source file", () => {
    expect(blocks.map((b) => b.file).sort()).toEqual([
      "src/App.tsx",
      "src/contract.ts",
      "src/spec.ts",
      "src/validate.test.ts",
    ]);
  });

  for (const block of blocks) {
    it(`block ${block.file} matches the compiled example file`, () => {
      const real = readFileSync(join(exampleDir, block.file), "utf8");
      expect(block.code).toBe(real);
    });
  }
});
