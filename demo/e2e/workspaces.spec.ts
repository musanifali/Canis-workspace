import { expect, test } from "@playwright/test";

// Case ids are seeded (mulberry32) and deterministic — they render as CASE-1000,
// CASE-1001, … A skeleton/unhydrated block has cells but never this text, so
// asserting a *value* (not just a row count) is what catches a stale dev server
// serving unhydrated SSR — the failure that slipped past element-count checks
// during the Phase 2 review (card #69).
const CASE_ID = /CASE-\d{4}/;

test.describe("hand-written specs render live in the demo app", () => {
  test("renders all three workspaces with real data and no broken blocks", async ({ page }) => {
    await page.goto("/workspaces");
    await expect(page.getByTestId("workspaces-page")).toBeVisible();

    // Default tab: Compliance Overview → KPI cards + a cases table, with data.
    // Blocks come from @workspace-engine/ui (data-testid="ui-*").
    await expect(page.getByTestId("ui-kpis")).toBeVisible();
    await expect(page.getByTestId("ui-table").first()).toBeVisible();
    // Assert rendered DATA, not just that a row element exists: the first cell
    // of the first row is the case id, which only appears once real rows hydrate.
    const firstCell = page.locator("table tbody tr").first().locator("td").first();
    await expect(firstCell).toHaveText(CASE_ID);
    // The KPI card shows a computed count — a live number, not a placeholder dash.
    await expect(page.getByTestId("ui-kpis")).toHaveText(/\d/);
    await expect(page.locator("[data-workspace-broken-block]")).toHaveCount(0);
    await expect(page.locator("[data-workspace-skeleton]")).toHaveCount(0);

    // Active Work Queue → a case queue, showing real case ids.
    await page.getByTestId("tab-queue").click();
    await expect(page.getByTestId("ui-queue")).toBeVisible();
    await expect(page.getByTestId("ui-queue").getByText(CASE_ID).first()).toBeVisible();
    await expect(page.locator("[data-workspace-broken-block]")).toHaveCount(0);

    // Portfolio by Category → a grouped board, showing real case ids in groups.
    await page.getByTestId("tab-category").click();
    await expect(page.getByTestId("ui-board")).toBeVisible();
    await expect(page.getByTestId("ui-board").getByText(CASE_ID).first()).toBeVisible();
    await expect(page.locator("[data-workspace-broken-block]")).toHaveCount(0);
  });
});
