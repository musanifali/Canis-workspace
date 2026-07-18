import { describe, expect, it } from "vitest";
import { run, type CliIo } from "./cli.js";
import { CONTRACTS, SPECS_DIR } from "./__fixtures__/paths.js";

function harness(): { io: CliIo; out: () => string; err: () => string } {
  const outLines: string[] = [];
  const errLines: string[] = [];
  const io: CliIo = {
    stdout: (line) => outLines.push(line),
    stderr: (line) => errLines.push(line),
    env: {},
    cwd: process.cwd(),
  };
  return { io, out: () => outLines.join("\n"), err: () => errLines.join("\n") };
}

describe("canis contracts diff", () => {
  it("exits non-zero and reports the breaking count for a narrowing", async () => {
    const h = harness();
    const code = await run(
      ["contracts", "diff", "--old", CONTRACTS.baseline, "--new", CONTRACTS.narrowed, "--specs-dir", SPECS_DIR],
      h.io,
    );
    expect(code).toBe(1);
    expect(h.out()).toContain("breaks 1 of 3");
    expect(h.out()).toContain("sla_deadline");
  });

  it("exits zero for a purely additive change", async () => {
    const h = harness();
    const code = await run(
      ["contracts", "diff", "--old", CONTRACTS.baseline, "--new", CONTRACTS.widened, "--specs-dir", SPECS_DIR],
      h.io,
    );
    expect(code).toBe(0);
    expect(h.out()).toContain("still build");
  });

  it("emits structured JSON with --json", async () => {
    const h = harness();
    const code = await run(
      ["contracts", "diff", "--old", CONTRACTS.baseline, "--new", CONTRACTS.narrowed, "--specs-dir", SPECS_DIR, "--json"],
      h.io,
    );
    expect(code).toBe(1);
    const parsed = JSON.parse(h.out());
    expect(parsed.summary).toMatchObject({ total: 3, broken: 1, compatible: 2 });
    expect(parsed.contractDiff.hasNarrowing).toBe(true);
    const broken = parsed.workspaces.find((w: { broken: boolean }) => w.broken);
    expect(broken.reasons.some((r: { field?: string }) => r.field === "sla_deadline")).toBe(true);
  });

  it("errors (exit 2) when no spec source is given", async () => {
    const h = harness();
    const code = await run(
      ["contracts", "diff", "--old", CONTRACTS.baseline, "--new", CONTRACTS.narrowed],
      h.io,
    );
    expect(code).toBe(2);
    expect(h.err()).toContain("spec source");
  });

  it("errors (exit 2) when a contract module is missing a flag", async () => {
    const h = harness();
    const code = await run(["contracts", "diff", "--old", CONTRACTS.baseline], h.io);
    expect(code).toBe(2);
    expect(h.err()).toContain("--new");
  });
});

describe("canis contracts lint", () => {
  it("prints warnings but exits zero for a valid-but-sloppy contract", async () => {
    const h = harness();
    const code = await run(["contracts", "lint", "--contracts", CONTRACTS.smelly], h.io);
    expect(code).toBe(0);
    expect(h.out()).toContain("warning(s)");
    expect(h.out()).toContain("enum field");
  });

  it("exits zero and reports clean for a well-documented contract", async () => {
    const h = harness();
    const code = await run(["contracts", "lint", "--contracts", CONTRACTS.clean], h.io);
    expect(code).toBe(0);
    expect(h.out()).toContain("no contract quality issues");
  });

  it("exits non-zero when a contract module fails to load", async () => {
    const h = harness();
    const code = await run(["contracts", "lint", "--contracts", CONTRACTS.broken], h.io);
    expect(code).toBe(1);
    expect(h.out()).toContain("contract_load_failed");
  });

  it("emits structured JSON with --json", async () => {
    const h = harness();
    const code = await run(["contracts", "lint", "--contracts", CONTRACTS.smelly, "--json"], h.io);
    expect(code).toBe(0);
    const parsed = JSON.parse(h.out());
    expect(parsed.summary.warnings).toBeGreaterThan(0);
    expect(parsed.summary.errors).toBe(0);
  });
});

describe("canis dispatch", () => {
  it("returns usage for an unknown command with a non-zero code", async () => {
    const h = harness();
    const code = await run(["frobnicate"], h.io);
    expect(code).toBe(2);
  });

  it("prints help", async () => {
    const h = harness();
    const code = await run(["--help"], h.io);
    expect(code).toBe(0);
    expect(h.out()).toContain("canis");
  });
});
