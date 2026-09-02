/**
 * Publish guard (#99). The six public packages are meant to reach npm; every
 * other workspace (db, api, dashboard, docs, playground) must stay private
 * FOREVER — an accidentally-public db or api package would leak internals and
 * can't be unpublished after 72h.
 *
 * Fails CI if:
 *   - a package that must be private lost `"private": true`, or
 *   - a public package gained it (it would silently stop publishing), or
 *   - a public package is missing the metadata npm needs (license/repository).
 *
 * Usage: node scripts/check-private.mjs
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const PUBLIC = new Set([
  "@ticora/core",
  "@ticora/react",
  "@ticora/ui",
  "@ticora/client",
  "@ticora/cli",
  "@ticora/devtools",
]);

const roots = ["packages", "apps"];
const problems = [];

for (const root of roots) {
  if (!existsSync(root)) continue;
  for (const dir of readdirSync(root)) {
    const manifest = join(root, dir, "package.json");
    if (!existsSync(manifest)) continue;
    const pkg = JSON.parse(readFileSync(manifest, "utf8"));
    const isPublic = PUBLIC.has(pkg.name);

    if (isPublic) {
      if (pkg.private === true) {
        problems.push(`${pkg.name}: public package is marked private — it would stop publishing`);
      }
      if (!pkg.license) problems.push(`${pkg.name}: missing "license"`);
      if (!pkg.repository) problems.push(`${pkg.name}: missing "repository" (npm provenance + the repo link)`);
    } else if (pkg.private !== true) {
      problems.push(`${pkg.name}: MUST be "private": true (it is not a published package)`);
    }
  }
}

if (problems.length > 0) {
  console.error("publish guard failed:\n" + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log(`publish guard ok — ${PUBLIC.size} public packages, everything else private`);
