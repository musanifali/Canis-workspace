import { defineConfig } from "vitest/config";

// Integration tests share one Postgres database; serial files keep the
// drizzle migrator and tenant fixtures from racing each other.
export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
