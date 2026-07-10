import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    // The SDK is linked via file:, so its react / react-dom / react-query
    // resolve from a different node_modules than the demo's. Dedupe to a single
    // copy of each or hooks fail with an invalid-hook-call. (Next dedupes react
    // itself; this is only for the vitest run.)
    dedupe: ["react", "react-dom", "@tanstack/react-query"],
  },
  test: {
    environment: "jsdom",
    // The Workspace Engine kit + its workspace-rendering components have unit/
    // snapshot tests; the Tambo chat flow is exercised manually / via the LLM
    // eval harness.
    include: [
      "src/workspace-engine/**/*.test.{ts,tsx}",
      "src/components/workspace/**/*.test.{ts,tsx}",
    ],
  },
});
