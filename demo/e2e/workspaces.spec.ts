import { expect, test } from "@playwright/test";

test.describe("hand-written specs render live in the demo app", () => {
  test("renders all three workspaces with data and no broken blocks", async ({ page }) => {
    await page.goto("/workspaces");
    await expect(page.getByTestId("workspaces-page")).toBeVisible();

    // Default tab: Compliance Overview → KPI cards + a cases table, with data.
    // Blocks come from @workspace-engine/ui (data-testid="ui-*").
    await expect(page.getByTestId("ui-kpis")).toBeVisible();
    await expect(page.getByTestId("ui-table").first()).toBeVisible();
    await expect(page.locator("table tbody tr").first()).toBeVisible();
    await expect(page.locator("[data-workspace-broken-block]")).toHaveCount(0);
    await expect(page.locator("[data-workspace-skeleton]")).toHaveCount(0);

    // Active Work Queue → a case queue.
    await page.getByTestId("tab-queue").click();
    await expect(page.getByTestId("ui-queue")).toBeVisible();
    await expect(page.locator("[data-workspace-broken-block]")).toHaveCount(0);

    // Portfolio by Category → a grouped board.
    await page.getByTestId("tab-category").click();
    await expect(page.getByTestId("ui-board")).toBeVisible();
    await expect(page.locator("[data-workspace-broken-block]")).toHaveCount(0);
  });
});
