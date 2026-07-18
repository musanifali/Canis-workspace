/**
 * Public-surface snapshot + breaking-change gate (card #51).
 *
 * The snapshot (devdocs/api-surface.json) records every runtime export of the
 * six public packages' built entrypoints, with its typeof. CI runs --check:
 *
 *  1. The snapshot must match reality — a surface change without a snapshot
 *     update (reviewable in the diff) fails.
 *  2. If this commit REMOVED exports (vs the parent commit's snapshot), a
 *     `major` changeset must be present — semver enforced mechanically, per
 *     devdocs/release-policy.md. Additions need any changeset (minor/patch
 *     hygiene is the review's job); removals block without a major.
 *
 * Runtime-export names catch removals/renames — the trust-killing class. Deep
 * type narrowing is out of scope here (tracked by core's test-types job).
 *
 * Usage: node scripts/api-surface.mjs --write | --check
 */
import { execSync } from "node:child_process";
import { log, error } from "node:console";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const SNAPSHOT = join(repoRoot, "devdocs", "api-surface.json");

const PUBLIC_PACKAGES = [
  "@workspace-engine/core",
  "@workspace-engine/react",
  "@workspace-engine/ui",
  "@workspace-engine/client",
  "@workspace-engine/cli",
  "@workspace-engine/devtools",
];

async function currentSurface() {
  const surface = {};
  for (const name of PUBLIC_PACKAGES) {
    const dir = join(repoRoot, "packages", name.split("/")[1]);
    const entry = join(dir, "dist", "index.js");
    const mod = await import(pathToFileURL(entry).href);
    surface[name] = Object.fromEntries(
      Object.keys(mod)
        .sort()
        .map((key) => [key, typeof mod[key]]),
    );
  }
  return surface;
}

function committedSnapshot(rev) {
  try {
    return JSON.parse(
      execSync(`git show ${rev}:devdocs/api-surface.json`, {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
  } catch {
    return null; // snapshot did not exist at that revision (bootstrap)
  }
}

function removalsBetween(oldSurface, newSurface) {
  const removals = [];
  for (const [pkg, exports] of Object.entries(oldSurface ?? {})) {
    for (const name of Object.keys(exports)) {
      if (!(newSurface[pkg] && name in newSurface[pkg])) {
        removals.push(`${pkg}#${name}`);
      }
    }
  }
  return removals;
}

function hasMajorChangeset() {
  const dir = join(repoRoot, ".changeset");
  return readdirSync(dir)
    .filter((file) => file.endsWith(".md") && file !== "README.md")
    .some((file) => {
      const frontmatter = readFileSync(join(dir, file), "utf8").split("---")[1] ?? "";
      return /:\s*major\s*$/m.test(frontmatter);
    });
}

const mode = process.argv[2];
const surface = await currentSurface();

if (mode === "--write") {
  writeFileSync(SNAPSHOT, `${JSON.stringify(surface, null, 2)}\n`);
  log(`wrote ${SNAPSHOT}`);
  process.exit(0);
}

if (mode !== "--check") {
  error("usage: node scripts/api-surface.mjs --write | --check");
  process.exit(2);
}

// 1. Snapshot must match the built reality.
const committed = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
if (JSON.stringify(committed) !== JSON.stringify(surface)) {
  const drift = [
    ...removalsBetween(committed, surface).map((r) => `removed: ${r}`),
    ...removalsBetween(surface, committed).map((r) => `added:   ${r}`),
  ];
  error("Public API surface differs from devdocs/api-surface.json:");
  for (const line of drift) error(`  ${line}`);
  error(
    "Run `node scripts/api-surface.mjs --write`, commit the snapshot with an " +
      "appropriate changeset, and let the diff be reviewed.",
  );
  process.exit(1);
}

// 2. Removals vs the parent commit's snapshot require a major changeset.
const parent = committedSnapshot("HEAD^");
const removals = removalsBetween(parent, surface);
if (removals.length > 0 && !hasMajorChangeset()) {
  error("Breaking change: exports removed from the public surface:");
  for (const removal of removals) error(`  - ${removal}`);
  error(
    "Removals ship only in a major (devdocs/release-policy.md). Add a " +
      "`major` changeset, or restore the exports.",
  );
  process.exit(1);
}

log(
  `api-surface OK — ${PUBLIC_PACKAGES.length} packages, ` +
    `${Object.values(surface).reduce((n, e) => n + Object.keys(e).length, 0)} exports` +
    (removals.length > 0 ? ` (${removals.length} removal(s) covered by a major changeset)` : ""),
);
