import { defineConfig, devices } from "@playwright/test";

/**
 * E2E for the Workspace Engine milestone (card #18): drives the /workspaces page
 * against a production build. Run with `npm run test:e2e` after
 * `npx playwright install chromium` and `npm run build`.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  use: {
    // Port 3100 to avoid colliding with the Phase 0 self-hosted stack on 3000.
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start -- -p 3100",
    url: "http://localhost:3100/workspaces",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
