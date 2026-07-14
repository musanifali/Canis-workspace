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
import { checkThresholds, pct, type CaseRun, type Metrics } from "./metrics";

export interface TrendEntry {
  at: string;
  promptVersion: string;
  /** Which cases ran — "full(30)" or "ids:p0-01,rj-02…" — so a smoke and a
   * full run are never mistaken for each other on the dashboard (review P2 #72). */
  subset: string;
  metrics: Metrics;
  /** Too few cases were measured (infra down/flaky) — see review P2 #74.
   * Recorded so a dead run is visible on the dashboard and never mistaken for
   * a real full-corpus result by the drift baseline. */
  inconclusive: boolean;
}

/** Label a run by the case ids it covered vs the full corpus. */
export function subsetLabel(ranIds: readonly string[], corpusSize: number): string {
  if (ranIds.length === corpusSize) return `full(${corpusSize})`;
  const shown = ranIds.slice(0, 6).join(",");
  return `ids:${shown}${ranIds.length > 6 ? `+${ranIds.length - 6}` : ""} (${ranIds.length}/${corpusSize})`;
}

/** `inconclusive` is derived from `metrics`, not supplied — recordRun computes it. */
export interface RunReport extends Omit<TrendEntry, "inconclusive"> {
  runs: CaseRun[];
}

export interface ReportPaths {
  reportPath: string;
  trendPath: string;
  dashboardPath: string;
}

export function recordRun(report: RunReport, paths: ReportPaths): void {
  const full = { ...report, inconclusive: checkThresholds(report.metrics).inconclusive };
  ensureDir(paths.reportPath);
  writeFileSync(paths.reportPath, JSON.stringify(full, null, 2));
  ensureDir(paths.trendPath);
  const { runs: _omit, ...trendEntry } = full;
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
  const rows = trend.map((e) =>
    e.inconclusive
      ? `| ${e.at} | \`${e.promptVersion}\` | ${e.subset ?? "?"} | **INCONCLUSIVE (infra down)** | — | — | — | ${e.metrics.total} |`
      : `| ${e.at} | \`${e.promptVersion}\` | ${e.subset ?? "?"} | ${pct(e.metrics.validSpecRate)} | ${pct(e.metrics.falseBuildRate)} | ${pct(e.metrics.parseFailureRate)} | ${pct(e.metrics.clarifyRate)} | ${e.metrics.total} |`,
  );
  return [
    "# Generation eval — metric trend (card #22)",
    "",
    "Appended by `npm run eval` (headline metrics from `src/eval/metrics.ts`).",
    "Newest run last. Valid-spec and parse-failure track review P1 #70. The Subset",
    "column names which cases ran — a smoke and a full run are not comparable (P2 #72).",
    "A row marked INCONCLUSIVE means too few cases were measured (infra was down or",
    "flaky, review P2 #74) — it is never treated as a pass or as a drift baseline.",
    "",
    "| Run (UTC) | Prompt | Subset | Valid-spec | False-build | Parse-fail | Clarify | N |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
