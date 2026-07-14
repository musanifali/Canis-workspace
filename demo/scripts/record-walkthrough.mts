/**
 * Records the full Canis demo walkthrough (Trello #81) as a single video,
 * driving the polished arc end-to-end with Playwright:
 *
 *   landing → Create (flagship sentence → live board) → refine → Save →
 *   /saved reload → grounded refusal → /workspaces → /sandbox → devtools peek
 *
 * Mirrors the beats + prompts in demo/RUNBOOK.md. Asserts VISIBLE DATA
 * (CASE-#### ids) at each render so a stale/skeletal server fails loudly
 * instead of recording an empty demo (the recurring trap). Reports every
 * console/page/HTTP error on stdout.
 *
 * Prereqs: backend on :8261 (cd tambo && ./scripts/cloud/tambo-start.sh) and
 * the demo built + served on :3001 (npm run build && npx next start -p 3001).
 *
 * Run from demo/:  npx -y tsx scripts/record-walkthrough.mts
 * Output: demo/eval/videos/canis-walkthrough-<date>.webm + per-beat PNGs.
 */
import { mkdirSync, renameSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { chromium, type Page } from "playwright";

const BASE = process.env.DEMO_URL ?? "http://localhost:3001";
const scriptDir = dirname(fileURLToPath(import.meta.url));
const videoDir = join(scriptDir, "..", "eval", "videos");
mkdirSync(videoDir, { recursive: true });
const date = new Date().toISOString().slice(0, 10);

const consoleErrors: string[] = [];
const pageErrors: string[] = [];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: videoDir, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();

page.on("console", async (msg) => {
  if (msg.type() !== "error") return;
  consoleErrors.push(msg.text().slice(0, 200));
});
page.on("pageerror", (err) => pageErrors.push(err.message.slice(0, 200)));
page.on("response", (res) => {
  if (res.status() >= 400)
    consoleErrors.push(`HTTP ${res.status()} ${res.request().method()} ${res.url().slice(0, 120)}`);
});

const shot = (name: string) => page.screenshot({ path: join(videoDir, `wt-${name}.png`) });
const pause = (ms: number) => page.waitForTimeout(ms);

/** Type into the /create TipTap input and submit. */
async function ask(prompt: string) {
  await page.locator('.tiptap[contenteditable="true"]').first().waitFor({ timeout: 60_000 });
  await page.evaluate(() => document.querySelector<HTMLElement>('.tiptap[contenteditable="true"]')?.focus());
  await page.keyboard.type(prompt, { delay: 14 });
  await page.keyboard.press("Enter");
}

/** Wait until at least `min` CASE-#### ids are visible — real data, not skeletons. */
async function waitForCases(min: number, timeout = 90_000) {
  await page.waitForFunction(
    (m) => (document.body.innerText.match(/CASE-\d+/g)?.length ?? 0) >= m,
    min,
    { timeout },
  );
}

async function newThread() {
  // The thread-history rail's "new thread" button; fall back to reloading /create.
  const btn = page.locator('[data-slot="thread-history-new"], button[aria-label*="ew thread" i]').first();
  if (await btn.count()) {
    await btn.click().catch(() => {});
  } else {
    await page.goto(`${BASE}/create`, { waitUntil: "domcontentloaded" });
  }
  await pause(800);
}

try {
  // Beat 1 — Landing
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await pause(2500);
  await shot("1-landing");
  await page.getByRole("link", { name: "Open Create" }).first().click();
  await page.waitForURL("**/create", { timeout: 30_000 });
  await pause(1500);
  await shot("2-create-empty");

  // Beat 2 — flagship sentence → live board
  await ask("Show high-risk cases due this month, grouped by analyst");
  await waitForCases(3);
  await pause(6000); // let streaming settle for the recording
  await shot("3-generated");
  console.log("beat 2: flagship render OK");

  // Beat 3 — refine
  await ask("Only show critical risk");
  await pause(9000);
  await shot("4-refined");
  console.log("beat 3: refine sent");

  // Beat 4 — Save
  const save = page.locator('[data-testid="save-workspace"]');
  await save.click();
  await page.locator('[data-testid="save-ok"]').waitFor({ timeout: 20_000 });
  await pause(1500);
  await shot("5-saved");
  console.log("beat 4: saved OK");

  // Beat 5 — reload with live data
  await page.getByRole("link", { name: "Saved" }).first().click();
  await page.waitForURL("**/saved", { timeout: 20_000 });
  await waitForCases(3, 30_000);
  await pause(2000);
  await shot("6-saved-reload");
  console.log("beat 5: /saved reload OK");

  // Beat 6 — grounded refusal
  await page.getByRole("link", { name: "Create" }).first().click();
  await page.waitForURL("**/create", { timeout: 20_000 });
  await newThread();
  await ask("Group high-risk cases by customer sentiment score");
  // Wait for a reject/clarify notice (pending testid holds the explanation).
  await page
    .locator('[data-testid="generated-workspace-pending"]')
    .waitFor({ timeout: 60_000 })
    .catch(() => {});
  await pause(6000);
  await shot("7-refusal");
  console.log("beat 6: refusal shown");

  // Beat 7 — curated workspaces
  await page.getByRole("link", { name: "Workspaces" }).first().click();
  await page.waitForURL("**/workspaces", { timeout: 20_000 });
  await waitForCases(3, 30_000);
  await pause(2500);
  await shot("8-workspaces");

  // Beat 8 — sandbox
  await page.getByRole("link", { name: "Sandbox" }).first().click();
  await page.waitForURL("**/sandbox", { timeout: 20_000 });
  await pause(3000);
  await shot("9-sandbox");

  console.log("walkthrough complete");
} catch (err) {
  console.error("WALKTHROUGH FAILED:", (err as Error).message);
  await shot("FAILURE");
  process.exitCode = 1;
} finally {
  const video = page.video();
  await context.close();
  if (video) {
    const src = await video.path();
    const dest = join(videoDir, `canis-walkthrough-${date}.webm`);
    try {
      renameSync(src, dest);
      console.log(`\nvideo: ${dest}`);
    } catch {
      console.log(`\nvideo: ${src}`);
    }
  }
  await browser.close();
  console.log(`console errors (${consoleErrors.length}):`);
  for (const e of [...new Set(consoleErrors)]) console.log("  -", e);
  console.log(`page errors (${pageErrors.length}):`);
  for (const e of [...new Set(pageErrors)]) console.log("  -", e);
}
