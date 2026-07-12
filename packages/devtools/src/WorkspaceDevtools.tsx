"use client";

/**
 * Workspace devtools panel (card #44) — inspectability for the generative loop.
 *
 * A floating, dev-only overlay with three tabs, fed entirely by the devtools bus:
 *   - Spec:     the current WorkspaceSpec + the history of every spec generated.
 *   - Verdicts: every validator verdict with its per-field reasons (build /
 *               clarify / reject) — so a developer can tell a contract problem
 *               from a model problem.
 *   - Queries:  the binding → fetch → rows timeline, with client-observed timing.
 *
 * Returns null in production so it (and its imports) tree-shake out of prod
 * bundles — mount it unconditionally; it costs nothing when built for prod.
 */
import { useState, type CSSProperties } from "react";
import { clearDevtoolsLog, useDevtoolsLog, type DevtoolsEvent } from "./bus";

// Minimal, dependency-free `process` shape (no @types/node in this package).
declare const process: { env?: { NODE_ENV?: string } } | undefined;

type Tab = "spec" | "verdicts" | "queries";

const isProd =
  typeof process !== "undefined" && process?.env?.NODE_ENV === "production";

const shell: CSSProperties = {
  position: "fixed",
  bottom: 12,
  right: 12,
  zIndex: 99999,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12,
  color: "#e5e7eb",
};

const panel: CSSProperties = {
  width: 460,
  maxWidth: "calc(100vw - 24px)",
  height: 420,
  maxHeight: "70vh",
  display: "flex",
  flexDirection: "column",
  background: "#0b1020",
  border: "1px solid #263041",
  borderRadius: 10,
  boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
  overflow: "hidden",
};

export function WorkspaceDevtools({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [tab, setTab] = useState<Tab>("spec");
  const events = useDevtoolsLog();

  if (isProd) return null;

  if (!open) {
    return (
      <div style={shell}>
        <button
          type="button"
          data-testid="devtools-toggle"
          onClick={() => setOpen(true)}
          style={{
            background: "#0b1020",
            color: "#e5e7eb",
            border: "1px solid #263041",
            borderRadius: 8,
            padding: "6px 10px",
            cursor: "pointer",
          }}
        >
          🛠 Workspace Devtools{" "}
          <span style={{ color: "#7c8aa5" }}>({events.length})</span>
        </button>
      </div>
    );
  }

  const specs = events.filter((e) => e.kind === "spec");
  const verdicts = events.filter((e) => e.kind === "verdict");
  const queries = events.filter((e) => e.kind === "query");

  return (
    <div style={shell}>
      <div style={panel} data-testid="devtools-panel">
        <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid #263041" }}>
          {(["spec", "verdicts", "queries"] as const).map((t) => (
            <button
              key={t}
              type="button"
              data-testid={`devtools-tab-${t}`}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: "8px 6px",
                background: tab === t ? "#141c30" : "transparent",
                color: tab === t ? "#e5e7eb" : "#7c8aa5",
                border: "none",
                borderBottom: tab === t ? "2px solid #5b8def" : "2px solid transparent",
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {t}{" "}
              <span style={{ color: "#4b5772" }}>
                {t === "spec" ? specs.length : t === "verdicts" ? verdicts.length : queries.length}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={clearDevtoolsLog}
            title="Clear"
            style={{ padding: "8px 10px", background: "transparent", color: "#7c8aa5", border: "none", cursor: "pointer" }}
          >
            clear
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            title="Close"
            style={{ padding: "8px 10px", background: "transparent", color: "#7c8aa5", border: "none", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>

        <div style={{ overflow: "auto", padding: 10, flex: 1 }}>
          {tab === "spec" && <SpecTab specs={specs} />}
          {tab === "verdicts" && <VerdictsTab verdicts={verdicts} />}
          {tab === "queries" && <QueriesTab queries={queries} />}
        </div>
      </div>
    </div>
  );
}

type SpecEvent = Extract<DevtoolsEvent, { kind: "spec" }>;
type VerdictEvent = Extract<DevtoolsEvent, { kind: "verdict" }>;
type QueryEvent = Extract<DevtoolsEvent, { kind: "query" }>;

const time = (at: number) => new Date(at).toLocaleTimeString();
const muted: CSSProperties = { color: "#7c8aa5" };
const row: CSSProperties = { padding: "6px 0", borderBottom: "1px solid #1b2437" };

function Empty({ what }: { what: string }) {
  return <div style={muted}>No {what} yet — generate a workspace on the left.</div>;
}

function SpecTab({ specs }: { specs: SpecEvent[] }) {
  const current = specs[specs.length - 1];
  if (!current) return <Empty what="specs" />;
  return (
    <div data-testid="devtools-spec">
      <div style={{ marginBottom: 6 }}>
        <strong>{current.title}</strong> <span style={muted}>· {current.blockCount} blocks · {time(current.at)}</span>
      </div>
      <pre
        style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#cdd6e4", background: "#070b16", padding: 8, borderRadius: 6 }}
      >
        {JSON.stringify(current.spec, null, 2)}
      </pre>
      {specs.length > 1 && (
        <div style={{ marginTop: 10 }}>
          <div style={muted}>History ({specs.length})</div>
          {specs.slice(0, -1).reverse().map((s) => (
            <div key={s.id} style={row}>
              <span style={muted}>{time(s.at)}</span> {s.title}{" "}
              <span style={muted}>· {s.blockCount} blocks</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const verdictColor = { build: "#3fb950", clarify: "#d29922", reject: "#f85149" } as const;

function VerdictsTab({ verdicts }: { verdicts: VerdictEvent[] }) {
  if (verdicts.length === 0) return <Empty what="verdicts" />;
  return (
    <div data-testid="devtools-verdicts">
      {[...verdicts].reverse().map((v) => (
        <div key={v.id} style={row}>
          <span style={{ color: verdictColor[v.status], fontWeight: 700 }}>{v.status.toUpperCase()}</span>{" "}
          <span style={muted}>{time(v.at)}</span>
          <div style={{ color: "#cdd6e4" }}>{v.summary}</div>
          {v.reasons.map((r, i) => (
            <div key={i} style={{ marginTop: 2, paddingLeft: 8, borderLeft: "2px solid #263041" }}>
              {r.path && <code style={{ color: "#5b8def" }}>{r.path}</code>} <span>{r.message}</span>
              {r.fix && <div style={muted}>→ {r.fix}</div>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function QueriesTab({ queries }: { queries: QueryEvent[] }) {
  if (queries.length === 0) return <Empty what="queries" />;
  const statusColor = { loading: "#d29922", success: "#3fb950", error: "#f85149" } as const;
  return (
    <div data-testid="devtools-queries">
      {[...queries].reverse().map((q) => (
        <div key={q.id} style={row}>
          <span style={{ color: statusColor[q.status], fontWeight: 700 }}>{q.status}</span>{" "}
          <code style={{ color: "#5b8def" }}>{q.blockId}</code> <span style={muted}>{q.entity}</span>
          <span style={{ float: "right", ...muted }}>
            {q.rows !== null ? `${q.rows} rows` : ""} {q.ms !== null ? `· ${q.ms}ms` : ""}
          </span>
          <div style={{ ...muted, wordBreak: "break-word" }}>{summarizeQuery(q.query)}</div>
        </div>
      ))}
    </div>
  );
}

function summarizeQuery(q: unknown): string {
  if (!q || typeof q !== "object") return "";
  const o = q as Record<string, unknown>;
  const parts: string[] = [];
  const filters = o.filters as { field?: string }[] | undefined;
  if (filters?.length) parts.push(`filter ${filters.map((f) => f.field).join(", ")}`);
  if (o.groupBy) parts.push(`groupBy ${String(o.groupBy)}`);
  const aggs = o.aggregations as { fn?: string; field?: string }[] | undefined;
  if (aggs?.length) parts.push(`agg ${aggs.map((a) => `${a.fn}(${a.field ?? ""})`).join(", ")}`);
  const sort = o.sort as { field?: string }[] | undefined;
  if (sort?.length) parts.push(`sort ${sort.map((s) => s.field).join(", ")}`);
  return parts.join(" · ") || "all rows";
}
