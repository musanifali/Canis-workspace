import { defineConfig } from "tsup";

// Dual CJS/ESM + types. react and react-query are peers (externalized).
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: "es2022",
  external: ["react", "@tanstack/react-query"],
});
