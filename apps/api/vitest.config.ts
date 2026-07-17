import { defineConfig } from "vitest/config";

// e2e contract tests boot the Nest app against the shared test Postgres;
// serial files keep migrations and fixtures from racing.
export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
