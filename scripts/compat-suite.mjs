/**
 * Previous-minor compatibility suite (card #51, decision D4).
 *
 * "Previous minor" = the newest `vX.Y.Z` git tag whose X.Y line is older than
 * the current fixed-group version. That tag's example apps are checked out
 * into a temp dir, their @workspace-engine/* deps are rewritten to tarballs
 * packed from the CURRENT tree, and each example must type-check and pass its
 * tests. A red run means current packages broke code written against the
 * previous minor — either fix it, or it ships as a major with a migration
 * note (devdocs/release-policy.md).
 *
 * Bootstrap: exits 0 with a notice while no qualifying tag exists yet, or
 * when the tagged tree predates examples/.
 */
import { execSync } from "node:child_process";
import { log, error } from "node:console";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = (cmd, cwd = repoRoot) =>
  execSync(cmd, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();

const current = JSON.parse(
  readFileSync(join(repoRoot, "packages/core/package.json"), "utf8"),
).version;
const [curMajor, curMinor] = current.split(".").map(Number);

const tags = run("git tag -l 'v*' --sort=-v:refname")
  .split("\n")
  .filter(Boolean);
const previousMinor = tags.find((tag) => {
  const [major, minor] = tag.slice(1).split(".").map(Number);
  return major < curMajor || (major === curMajor && minor < curMinor);
});
if (!previousMinor) {
  log(`compat-suite: no tag older than v${current} yet — nothing to pin (bootstrap).`);
  process.exit(0);
}
log(`compat-suite: current v${current}, previous minor ${previousMinor}`);

const work = join(repoRoot, ".compat-work");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });

// 1. The previous minor's examples.
run(`git worktree add --detach ${join(work, "old")} ${previousMinor}`);
try {
  const oldExamples = join(work, "old", "examples");
  if (!existsSync(oldExamples)) {
    log(`compat-suite: ${previousMinor} predates examples/ — nothing to pin.`);
    process.exit(0);
  }

  // 2. Tarballs from the CURRENT tree.
  const tarballDir = join(work, "tarballs");
  mkdirSync(tarballDir);
  run(
    "npm pack --workspace @workspace-engine/core --workspace @workspace-engine/react " +
      "--workspace @workspace-engine/ui --workspace @workspace-engine/client " +
      "--workspace @workspace-engine/cli --workspace @workspace-engine/devtools " +
      `--pack-destination ${tarballDir}`,
  );
  const tarballByPackage = {};
  for (const file of readdirSync(tarballDir)) {
    const name = `@workspace-engine/${file.replace(/^workspace-engine-/, "").replace(/-\d.*$/, "")}`;
    tarballByPackage[name] = join(tarballDir, file);
  }

  // 3. Each old example against the new packages.
  let failures = 0;
  for (const example of readdirSync(oldExamples)) {
    const source = join(oldExamples, example);
    if (!existsSync(join(source, "package.json"))) continue;
    const target = join(work, example);
    cpSync(source, target, { recursive: true });
    // Standalone: drop the monorepo tsconfig inheritance if present.
    const tsconfigPath = join(target, "tsconfig.json");
    if (existsSync(tsconfigPath)) {
      const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf8"));
      if (tsconfig.extends?.startsWith("../..")) {
        delete tsconfig.extends;
        tsconfig.compilerOptions = {
          strict: true,
          skipLibCheck: true,
          target: "ES2022",
          ...tsconfig.compilerOptions,
        };
      }
      writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
    }
    const pkg = JSON.parse(readFileSync(join(target, "package.json"), "utf8"));
    for (const deps of [pkg.dependencies ?? {}, pkg.devDependencies ?? {}]) {
      for (const dep of Object.keys(deps)) {
        if (tarballByPackage[dep]) deps[dep] = `file:${tarballByPackage[dep]}`;
      }
    }
    writeFileSync(join(target, "package.json"), JSON.stringify(pkg, null, 2));

    log(`\ncompat-suite: ${example}@${previousMinor} against v${current}`);
    try {
      run("npm install --no-audit --no-fund", target);
      run("npx tsc --noEmit", target);
      if (pkg.scripts?.test) run("npm test", target);
      log(`compat-suite: ${example} OK`);
    } catch {
      failures++;
      error(`compat-suite: ${example} FAILED against v${current}`);
    }
  }

  if (failures > 0) {
    error(
      `\ncompat-suite: ${failures} previous-minor example(s) broke. Fix the ` +
        "regression, or ship it as a major with a migration note " +
        "(devdocs/release-policy.md).",
    );
    process.exit(1);
  }
  log("\ncompat-suite: previous minor fully compatible.");
} finally {
  try {
    run(`git worktree remove --force ${join(work, "old")}`);
  } catch {
    /* already gone */
  }
  rmSync(work, { recursive: true, force: true });
}
