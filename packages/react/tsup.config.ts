import { defineConfig } from "tsup";

// Dual CJS/ESM + .d.ts output. React and the core package are externalized so
// consumers dedupe them; no react-dom is bundled or required (SSR-compatible).
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
