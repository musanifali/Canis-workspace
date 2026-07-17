import { defineConfig } from "tsup";

// Dual CJS/ESM + .d.ts/.d.cts output, matching @workspace-engine/core.
// drizzle-orm and pg are runtime deps and auto-externalized.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: "es2022",
});
