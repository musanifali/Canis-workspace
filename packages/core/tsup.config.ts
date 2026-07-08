import { defineConfig } from "tsup";

// Dual CJS/ESM + .d.ts/.d.cts output so both `import` and `require` consumers
// can load the package. zod (the only runtime dep) is auto-externalized.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: "es2022",
});
