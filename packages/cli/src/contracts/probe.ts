/**
 * Capability-vs-fetch conformance probes (card #49): run sample queries
 * through the vendor's REAL `fetch` and verify it honors every capability it
 * declared with `execution: "server"`. Client-mode capabilities need no probe
 * — the in-memory engine enforces those regardless of what fetch returns.
 * Server-mode ones are trusted blindly at render time, so a fetch that
 * ignores them ships silently wrong screens; this is where that surfaces.
 *
 * Findings share the LintFinding shape so `lint --probe` and `dev` merge them
 * into one report and one exit code.
 */
import type { EntityContract } from "@workspace-engine/core";
import type { LintFinding } from "./lint.js";

export interface ProbeOptions {
  /** Passed straight through as the vendor fetch's `auth` argument. */
  auth?: unknown;
  /** Rows fetched per probe query (kept small — these hit the vendor API). */
  sampleLimit?: number;
}

type Row = Record<string, unknown>;

/** Order-comparable projection per field kind (mirrors the engine's compare). */
function comparable(value: unknown): number | string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  return String(value);
}

function isSorted(rows: Row[], field: string): boolean {
  let previous: number | string | null = null;
  for (const row of rows) {
    const current = comparable(row[field]);
    if (current === null) continue; // nulls have no defined position — skip
    if (previous !== null) {
      if (typeof previous === "number" && typeof current === "number") {
        if (current < previous) return false;
      } else if (String(current) < String(previous)) {
        return false;
      }
    }
    previous = current;
  }
  return true;
}

async function probeEntity(
  contract: EntityContract,
  options: Required<ProbeOptions>,
): Promise<LintFinding[]> {
  const findings: LintFinding[] = [];
  const entity = contract.name;
  const { execution } = contract.capabilities;
  const push = (
    severity: LintFinding["severity"],
    code: string,
    message: string,
    field?: string,
  ) => findings.push({ entity, severity, code, message, ...(field ? { field } : {}) });

  const serverOps = (["filter", "sort", "group", "aggregate"] as const).filter(
    (op) => execution[op] === "server",
  );
  if (serverOps.length === 0) return findings; // engine enforces everything

  const fetchRows = async (query: Record<string, unknown>): Promise<Row[]> =>
    (await contract.fetch({
      query: { filters: [], sort: [], limit: options.sampleLimit, ...query } as never,
      auth: options.auth,
    })) as Row[];

  let baseline: Row[];
  try {
    baseline = await fetchRows({});
  } catch (error) {
    push(
      "error",
      "probe_fetch_failed",
      `baseline fetch threw: ${error instanceof Error ? error.message : String(error)}`,
    );
    return findings;
  }
  if (baseline.length < 2) {
    push(
      "warning",
      "probe_insufficient_rows",
      `fetch returned ${baseline.length} row(s) — need at least 2 to verify ` +
        `server-side ${serverOps.join("/")}; point the probe at data`,
    );
    return findings;
  }

  // group/aggregate return shaped payloads we cannot generically compare —
  // say so instead of pretending they were verified.
  for (const op of serverOps) {
    if (op === "group" || op === "aggregate") {
      push(
        "warning",
        "probe_unverified_server_op",
        `execution.${op}="server" cannot be auto-probed — verify the fetch's ` +
          `${op} handling with an integration test on your side`,
      );
    }
  }

  if (execution.sort === "server") {
    for (const field of contract.capabilities.sortable) {
      try {
        const rows = await fetchRows({ sort: [{ field, dir: "asc" }] });
        if (!isSorted(rows, field)) {
          push(
            "error",
            "server_sort_unimplemented",
            `declared sortable "${field}" with execution.sort="server", but the ` +
              `fetch returned rows out of order — the engine trusts server sort ` +
              `and renders them as-is`,
            field,
          );
        }
      } catch (error) {
        push(
          "error",
          "probe_fetch_failed",
          `sort probe on "${field}" threw: ${error instanceof Error ? error.message : String(error)}`,
          field,
        );
      }
    }
  }

  if (execution.filter === "server") {
    for (const field of contract.capabilities.filterable) {
      const kind = contract.fields[field];
      // date kinds take date-value ops (on/before/…) — not probeable with eq.
      if (kind === "date" || kind === "datetime") continue;
      const sample = baseline.find((row) => {
        const v = row[field];
        return v !== null && v !== undefined;
      })?.[field];
      if (sample === undefined) continue; // no sample value to filter by
      try {
        const rows = await fetchRows({ filters: [{ field, op: "eq", value: sample }] });
        const offenders = rows.filter((row) => row[field] !== sample);
        if (offenders.length > 0) {
          push(
            "error",
            "server_filter_unimplemented",
            `declared filterable "${field}" with execution.filter="server", but ` +
              `filtering ${field} = ${JSON.stringify(sample)} returned ` +
              `${offenders.length} non-matching row(s) — the engine trusts ` +
              `server filters and renders them as-is`,
            field,
          );
        }
      } catch (error) {
        push(
          "error",
          "probe_fetch_failed",
          `filter probe on "${field}" threw: ${error instanceof Error ? error.message : String(error)}`,
          field,
        );
      }
    }
  }

  return findings;
}

/**
 * Probe every contract's server-mode capabilities against its real fetch.
 * @returns Findings in the LintFinding shape (empty = everything conforms).
 */
export async function probeContracts(
  contracts: readonly EntityContract[],
  options: ProbeOptions = {},
): Promise<LintFinding[]> {
  const resolved: Required<ProbeOptions> = {
    auth: options.auth ?? null,
    sampleLimit: options.sampleLimit ?? 50,
  };
  const results: LintFinding[] = [];
  for (const contract of contracts) {
    results.push(...(await probeEntity(contract, resolved)));
  }
  return results;
}
