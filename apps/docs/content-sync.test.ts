/**
 * The docs' anti-rot guard (#30/#50, decision D2): every fenced code block
 * tagged `filename="…"` must byte-match the real, compiled, tested file in
 * its example package. If a page and its code drift, CI fails — the docs can
 * never quietly stop working.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(__dirname, "..", "..");

/** page → the example package its tagged blocks live in. */
const SYNCED_PAGES = [
  {
    page: "content/quickstart.mdx",
    exampleDir: "examples/quickstart",
    expectFiles: ["src/App.tsx", "src/contract.ts", "src/spec.ts", "src/validate.test.ts"],
  },
  {
    page: "content/guides/adapters.mdx",
    exampleDir: "examples/recipes",
    expectFiles: ["src/graphql.ts", "src/prisma.ts", "src/rest.ts", "src/supabase.ts"],
  },
];

for (const { page, exampleDir, expectFiles } of SYNCED_PAGES) {
  describe(`${page} ↔ ${exampleDir}`, () => {
    const source = readFileSync(join(__dirname, page), "utf8");
    const blocks = [
      ...source.matchAll(/```(?:ts|tsx) filename="([^"]+)"\n([\s\S]*?)```/g),
    ].map((match) => ({ file: match[1]!, code: match[2]! }));

    it("has one tagged block per example source file", () => {
      expect(blocks.map((b) => b.file).sort()).toEqual(expectFiles);
    });

    for (const block of blocks) {
      it(`block ${block.file} matches the compiled example file`, () => {
        const real = readFileSync(join(repoRoot, exampleDir, block.file), "utf8");
        expect(block.code).toBe(real);
      });
    }
  });
}
