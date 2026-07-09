import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // The SDK is a workspace dep; keep a single copy of react so hooks work.
    dedupe: ["react", "react-dom", "@tanstack/react-query"],
  },
  test: {
    environment: "jsdom",
  },
});
