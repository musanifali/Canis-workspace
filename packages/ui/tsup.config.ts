import { defineConfig } from "tsup";

// Dual CJS/ESM + .d.ts/.d.cts. react and the workspace packages are
// auto-externalized (peer + deps); no react-dom is required.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: "es2022",
  external: ["react"],
});
