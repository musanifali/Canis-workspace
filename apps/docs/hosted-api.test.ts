/**
 * The quickstart's hosted base URL must match the single source
 * (hosted-api.json), so the docs can never advertise a stale service URL.
 * Update hosted-api.json when the API moves; this test fails until the
 * quickstart follows (and vice versa).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const hosted = JSON.parse(
  readFileSync(join(__dirname, "hosted-api.json"), "utf8"),
) as { apiUrl: string };

describe("quickstart hosted API URL ↔ hosted-api.json", () => {
  const quickstart = readFileSync(
    join(__dirname, "content/quickstart.mdx"),
    "utf8",
  );
  const block = quickstart.slice(
    quickstart.indexOf("{/* hosted-api:start"),
    quickstart.indexOf("{/* hosted-api:end"),
  );

  it("the marked block advertises exactly the configured base URL", () => {
    expect(block).not.toBe("");
    expect(block).toContain(`baseUrl: "${hosted.apiUrl}"`);
    // Guard against a second, drifted URL sneaking into the block.
    const urls = block.match(/https?:\/\/[^\s"']+/g) ?? [];
    expect(urls).toEqual([hosted.apiUrl]);
  });

  it("the configured URL is https", () => {
    expect(hosted.apiUrl).toMatch(/^https:\/\//);
  });
});
