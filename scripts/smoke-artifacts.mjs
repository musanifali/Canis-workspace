/**
 * Artifact loadability smoke test.
 *
 * The published packages advertise dual CJS/ESM. Unit tests run under ESM only,
 * so a broken `require()` path (e.g. an ESM-only dependency with no `require`
 * export condition) slips past them — as it did in review card #65. This script
 * loads every public entry point through BOTH conditions against the real built
 * artifacts and fails CI if either is dead on arrival.
 *
 * Run after `build`, from the repo root: `node scripts/smoke-artifacts.mjs`.
 */
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);

const PACKAGES = ["@workspace-engine/core", "@workspace-engine/react"];

let failed = false;

for (const pkg of PACKAGES) {
  // CJS: require() must resolve through the package's `require` condition and,
  // transitively, every dependency's `require` condition.
  try {
    const cjs = require(pkg);
    assert.ok(cjs, `${pkg}: require() returned an empty module`);
    console.log(`✓ require("${pkg}") loaded`);
  } catch (error) {
    failed = true;
    console.error(`✗ require("${pkg}") failed:\n  ${error.message}`);
  }

  // ESM: dynamic import() must resolve through the `import` condition.
  try {
    const esm = await import(pkg);
    assert.ok(esm, `${pkg}: import() returned an empty module`);
    console.log(`✓ import("${pkg}") loaded`);
  } catch (error) {
    failed = true;
    console.error(`✗ import("${pkg}") failed:\n  ${error.message}`);
  }
}

if (failed) {
  console.error("\nArtifact loadability smoke test FAILED.");
  process.exit(1);
}
console.log("\nAll artifacts load under both require() and import().");
