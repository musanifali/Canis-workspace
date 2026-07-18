import { describe, expect, it } from "vitest";
import { parseArgs, resolveOption } from "./args.js";

describe("parseArgs", () => {
  it("collects positionals, options, and boolean flags", () => {
    const parsed = parseArgs([
      "contracts",
      "diff",
      "--old",
      "a.mjs",
      "--new=b.mjs",
      "--json",
    ]);
    expect(parsed.positionals).toEqual(["contracts", "diff"]);
    expect(parsed.options.old).toBe("a.mjs");
    expect(parsed.options.new).toBe("b.mjs");
    expect(parsed.flags.has("json")).toBe(true);
  });

  it("treats a value-less non-boolean flag as a boolean", () => {
    const parsed = parseArgs(["--verbose", "--old", "x"]);
    expect(parsed.flags.has("verbose")).toBe(true);
    expect(parsed.options.old).toBe("x");
  });
});

describe("resolveOption", () => {
  it("prefers the flag, then falls back through env names", () => {
    const withFlag = parseArgs(["--api-key", "flagkey"]);
    expect(resolveOption(withFlag, "api-key", {}, ["CANIS_API_KEY"])).toBe("flagkey");

    const noFlag = parseArgs([]);
    expect(
      resolveOption(noFlag, "api-key", { CANIS_API_KEY: "envkey" }, ["CANIS_API_KEY"]),
    ).toBe("envkey");
    expect(resolveOption(noFlag, "api-key", {}, ["CANIS_API_KEY"])).toBeUndefined();
  });
});
