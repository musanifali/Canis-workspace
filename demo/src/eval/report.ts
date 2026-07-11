/**
 * Eval reporting + trend "dashboard" (card #22).
 *
 * Each live run writes a full JSON report, appends one line to a JSONL trend
 * log, and regenerates a markdown dashboard of metrics over time. The dashboard
 * is deliberately a committed markdown table (not a hosted app): it diffs in PRs,
 * so a prompt/model change that moves valid-spec or parse-failure rate is visible
 * in review, and the history is the record of the eval-driven loop.
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { pct, type CaseRun, type Metrics } from "./metrics";

export interface TrendEntry {
  at: string;
  promptVersion: string;
  metrics: Metrics;
}

export interface RunReport extends TrendEntry {
  runs: CaseRun[];
}

export interface ReportPaths {
  reportPath: string;
  trendPath: string;
  dashboardPath: string;
}

export function recordRun(report: RunReport, paths: ReportPaths): void {
  ensureDir(paths.reportPath);
  writeFileSync(paths.reportPath, JSON.stringify(report, null, 2));
  ensureDir(paths.trendPath);
  const { runs: _omit, ...trendEntry } = report;
  appendFileSync(paths.trendPath, JSON.stringify(trendEntry) + "\n");
  ensureDir(paths.dashboardPath);
  writeFileSync(paths.dashboardPath, renderDashboard(readTrend(paths.trendPath)));
}

export function readTrend(path: string): TrendEntry[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as TrendEntry);
}

export function renderDashboard(trend: readonly TrendEntry[]): string {
  const rows = trend.map(
    (e) =>
      `| ${e.at} | \`${e.promptVersion}\` | ${pct(e.metrics.validSpecRate)} | ${pct(e.metrics.falseBuildRate)} | ${pct(e.metrics.parseFailureRate)} | ${pct(e.metrics.clarifyRate)} | ${e.metrics.total} |`,
  );
  return [
    "# Generation eval — metric trend (card #22)",
    "",
    "Appended by `npm run eval` (headline metrics from `src/eval/metrics.ts`).",
    "Newest run last. Valid-spec and parse-failure track review P1 #70.",
    "",
    "| Run (UTC) | Prompt | Valid-spec | False-build | Parse-fail | Clarify | N |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
