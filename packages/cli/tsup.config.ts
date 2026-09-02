import { defineConfig } from "tsup";

// Dual CJS/ESM library plus the `canis` bin. The bin keeps its shebang
// (preserved from src/bin/ticora.ts). @ticora/* are runtime deps and
// auto-externalized.
export default defineConfig({
  entry: ["src/index.ts", "src/bin/ticora.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: "es2022",
});
