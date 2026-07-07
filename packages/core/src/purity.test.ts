/**
 * Purity guard (card DUx7yjkT criterion: zero IO deps).
 *
 * The package charter: no React, no DB, no fetch — zod only. This test
 * enforces it structurally so a stray dependency or IO import fails CI,
 * not code review.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      return [path];
    }
    return [];
  });
}

describe("package purity", () => {
  it("zod is the only runtime dependency", () => {
    const pkg = JSON.parse(
      readFileSync(join(packageRoot, "package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(["zod"]);
  });

  it("no source file imports node builtins, react, or IO libraries", () => {
    const forbidden = /from\s+["'](node:|react|fs|path|http|https|net|child_process|pg|drizzle|@tambo)/;
    for (const file of sourceFiles(join(packageRoot, "src"))) {
      const source = readFileSync(file, "utf8");
      expect(forbidden.test(source), `${file} imports a forbidden module`).toBe(
        false,
      );
    }
  });

  it("no source file uses fetch, process, or globalThis IO", () => {
    const forbidden = /\b(fetch\(|process\.env|XMLHttpRequest|WebSocket)/;
    for (const file of sourceFiles(join(packageRoot, "src"))) {
      const source = readFileSync(file, "utf8");
      expect(forbidden.test(source), `${file} performs IO`).toBe(false);
    }
  });
});
