/**
 * Drives the demo chat with Playwright, records a video, and reports every
 * console error — both a demo recorder (ticket #4) and a live diagnostic.
 *
 * Run from demo/:  npx -y tsx scripts/record-demo.mts
 * Output: demo/eval/videos/<hash>.webm + console report on stdout.
 */
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const videoDir = join(scriptDir, "..", "eval", "videos");
mkdirSync(videoDir, { recursive: true });

const PROMPTS = [
  "Show high-risk cases due this month, grouped by analyst",
  "How many cases are overdue right now?",
  "Pie chart of cases by risk level",
];

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
  const args = await Promise.all(
    msg.args().map(async (a) => {
      try {
        return String(await a.jsonValue());
      } catch {
        return "?";
      }
    }),
  );
  consoleErrors.push((args.join(" ") || msg.text()).slice(0, 300));
});
page.on("pageerror", (err) => pageErrors.push(err.message.slice(0, 200)));
page.on("response", (res) => {
  if (res.status() >= 400) {
    consoleErrors.push(`HTTP ${res.status()} ${res.request().method()} ${res.url().slice(0, 150)}`);
  }
});

await page.goto("http://localhost:3001/chat", { waitUntil: "domcontentloaded" });
try {
  await page
    .locator('.tiptap[contenteditable="true"]')
    .first()
    .waitFor({ timeout: 60_000 });
} catch {
  await page.screenshot({ path: join(videoDir, "load-failure.png") });
  console.log("input never appeared; body text:");
  console.log((await page.evaluate(() => document.body.innerText)).slice(0, 500));
  await context.close();
  await browser.close();
  process.exit(1);
}

for (const [index, prompt] of PROMPTS.entries()) {
  console.log(`[${index + 1}/${PROMPTS.length}] "${prompt}"`);
  // The template's input is a TipTap ProseMirror contenteditable div;
  // headless click actionability is flaky on it, so focus programmatically
  await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(
      '.tiptap[contenteditable="true"]',
    );
    el?.focus();
  });
  await page.keyboard.type(prompt, { delay: 15 });
  await page.keyboard.press("Enter");

  // Wait for generation to finish: a rendered block (case id, table, or
  // chart svg) appearing after this prompt, then a settle pause
  try {
    await page.waitForFunction(
      (expectedMinimum) => {
        const caseIds = document.body.innerText.match(/CASE-\d+/g)?.length ?? 0;
        const svgs = document.querySelectorAll(".recharts-wrapper").length;
        const cards = document.querySelectorAll("[class*='rounded-lg border']").length;
        return caseIds + svgs * 10 + cards > expectedMinimum;
      },
      index * 2, // demand a little more content after each prompt
      { timeout: 90_000 },
    );
  } catch {
    console.log("    (timed out waiting for a rendered block — continuing)");
  }
  // Let streaming finish + UI settle for the recording
  await page.waitForTimeout(10_000);
  await page.evaluate(() => {
    const scroller = [...document.querySelectorAll("*")].find(
      (el) => el.scrollHeight > el.clientHeight + 100,
    );
    scroller?.scrollTo({ top: scroller.scrollHeight });
  });
  await page.waitForTimeout(1_500);
  await page.screenshot({
    path: join(videoDir, `prompt-${index + 1}.png`),
    fullPage: false,
  });
}

await page.waitForTimeout(2_000);
const video = page.video();
await context.close();
await browser.close();

const videoPath = video ? await video.path() : "(no video)";
console.log(`\nvideo: ${videoPath}`);
console.log(`\nconsole errors (${consoleErrors.length}):`);
for (const e of [...new Set(consoleErrors)]) console.log("  -", e);
console.log(`page errors (${pageErrors.length}):`);
for (const e of [...new Set(pageErrors)]) console.log("  -", e);
