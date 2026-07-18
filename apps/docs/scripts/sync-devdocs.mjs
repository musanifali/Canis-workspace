/**
 * Copy the repo's canonical devdocs into the docs content tree at build time
 * (single source of truth — the copies are generated and gitignored). Spec v1
 * and the release policy live in devdocs/ because code gates on them; the
 * docs site republises them verbatim.
 */
import { log } from "node:console";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const contentDir = join(here, "..", "content", "reference");

mkdirSync(contentDir, { recursive: true });
const copies = [
  ["devdocs/workspace-spec-v1.md", "spec-v1.md"],
  ["devdocs/release-policy.md", "release-policy.md"],
];
for (const [source, target] of copies) {
  copyFileSync(join(repoRoot, source), join(contentDir, target));
  log(`synced ${source} -> content/reference/${target}`);
}
