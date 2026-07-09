import type { CSSProperties, ReactElement } from "react";
import type { BlockComponentProps } from "@workspace-engine/react";
import { tokens } from "../theme";
import { Panel, formatValue, intentColor, panelStyle } from "../primitives";

type Row = Record<string, unknown>;
const asRows = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);
const title = (config: Record<string, unknown>): string | undefined =>
  typeof config.title === "string" ? config.title : undefined;

// --- Table (block type "CasesTable", shape "rows") -------------------------

const thStyle: CSSProperties = {
  padding: `6px ${tokens.pad}`,
  color: tokens.muted,
  fontWeight: 600,
  borderBottom: `1px solid ${tokens.border}`,
  position: "sticky",
  top: 0,
  background: tokens.bg,
};
const tdStyle: CSSProperties = { padding: `6px ${tokens.pad}`, borderBottom: `1px solid ${tokens.border}` };

function columnsFor(rows: Row[], configColumns: unknown): string[] {
  if (Array.isArray(configColumns) && configColumns.length > 0) return configColumns as string[];
  const first = rows[0];
  return first ? Object.keys(first) : [];
}

export function Table({ block, data }: BlockComponentProps): ReactElement {
  const rows = asRows(data);
  const columns = columnsFor(rows, block.config.columns);
  const empty = typeof block.config.emptyMessage === "string" ? block.config.emptyMessage : "No results.";
  return (
    <Panel title={title(block.config)} testId="ui-table">
      <div style={{ overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c} scope="col" style={thStyle}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c} style={tdStyle}>
                    {formatValue(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p style={{ padding: tokens.pad, color: tokens.muted }}>{empty}</p> : null}
      </div>
    </Panel>
  );
}

// --- KpiCards (block type "KpiCards", shape "aggregate") -------------------

interface KpiConfigCard {
  alias: string;
  label: string;
  intent?: "positive" | "negative" | "neutral";
}

export function KpiCards({ block, data }: BlockComponentProps): ReactElement {
  const agg = (asRows(data)[0] ?? {}) as Record<string, unknown>;
  const cards = (block.config.cards as KpiConfigCard[] | undefined) ?? [];
  return (
    <div data-testid="ui-kpis" style={{ display: "grid", gridAutoFlow: "column", gap: tokens.gap, height: "100%" }}>
      {cards.map((card) => (
        <div key={card.alias} style={{ ...panelStyle, justifyContent: "center", padding: tokens.pad, gap: "2px" }}>
          <span style={{ color: tokens.muted }}>{card.label}</span>
          <strong style={{ fontSize: "1.8em", color: intentColor(card.intent) }}>{formatValue(agg[card.alias])}</strong>
        </div>
      ))}
    </div>
  );
}

// --- Queue (block type "CaseQueue", shape "rows") --------------------------

export function Queue({ block, data }: BlockComponentProps): ReactElement {
  const rows = asRows(data);
  return (
    <Panel title={title(block.config)} testId="ui-queue">
      <ul style={{ listStyle: "none", margin: 0, padding: 0, overflow: "auto" }}>
        {rows.map((row, i) => {
          const keys = Object.keys(row);
          const primary = "id" in row ? row.id : row[keys[0] ?? ""];
          const secondary = keys
            .filter((k) => k !== "id")
            .slice(0, 2)
            .map((k) => formatValue(row[k]))
            .join(" · ");
          return (
            <li
              key={i}
              style={{ display: "flex", justifyContent: "space-between", gap: tokens.gap, padding: tokens.pad, borderTop: `1px solid ${tokens.border}` }}
            >
              <span style={{ fontWeight: 600 }}>{formatValue(primary)}</span>
              <span style={{ color: tokens.muted, textAlign: "right" }}>{secondary}</span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

// --- Board (block type "GroupedBoard", shape "groups") ---------------------

interface Group {
  group: string;
  rows: Row[];
}

export function Board({ block, data }: BlockComponentProps): ReactElement {
  const groups = (Array.isArray(data) ? (data as Group[]) : []).filter((g) => g && Array.isArray(g.rows));
  return (
    <Panel title={title(block.config)} testId="ui-board">
      <div style={{ display: "flex", gap: tokens.gap, padding: tokens.pad, overflow: "auto", height: "100%" }}>
        {groups.map((g) => (
          <div key={g.group} style={{ minWidth: "9rem", flex: 1, background: tokens.surface, borderRadius: tokens.radius, padding: tokens.pad }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, marginBottom: tokens.gap }}>
              <span>{g.group}</span>
              <span style={{ color: tokens.muted }}>{g.rows.length}</span>
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
              {g.rows.slice(0, 8).map((row, i) => (
                <li key={i} style={{ background: tokens.bg, borderRadius: "4px", padding: "4px 6px" }}>
                  {formatValue("id" in row ? row.id : Object.values(row)[0])}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// --- Graph (block type "Graph", shape "aggregate") -------------------------

interface Series {
  label: string;
  value: number;
}

function toSeries(data: unknown): Series[] {
  const rows = asRows(data);
  if (rows.length === 0) return [];
  const first = rows[0]!;
  if (rows.length === 1 && !("group" in first)) {
    // Single aggregate object → one bar per numeric alias.
    return Object.entries(first)
      .filter(([, v]) => typeof v === "number")
      .map(([label, value]) => ({ label, value: value as number }));
  }
  // Grouped aggregate → label = group, value = first numeric alias.
  return rows.map((row) => {
    const numeric = Object.entries(row).find(([k, v]) => k !== "group" && typeof v === "number");
    return { label: String(row.group ?? ""), value: numeric ? (numeric[1] as number) : 0 };
  });
}

export function Graph({ block, data }: BlockComponentProps): ReactElement {
  const series = toSeries(data);
  const kind = block.config.kind === "line" ? "line" : "bar";
  const max = Math.max(1, ...series.map((s) => s.value));
  const label = `${kind} chart: ${series.map((s) => `${s.label} ${s.value}`).join(", ") || "no data"}`;

  return (
    <Panel title={title(block.config)} testId="ui-graph">
      <div role="img" aria-label={label} data-graph-kind={kind} style={{ padding: tokens.pad, display: "flex", flexDirection: "column", gap: "6px", overflow: "auto" }}>
        {series.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: tokens.gap }}>
            <span style={{ width: "6rem", color: tokens.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
            <div style={{ flex: 1, background: tokens.surface, borderRadius: "4px", overflow: "hidden" }}>
              <div
                data-bar={s.label}
                style={{
                  width: `${(s.value / max) * 100}%`,
                  minWidth: "2px",
                  height: "1.1em",
                  background: tokens.accent,
                  borderRadius: "4px",
                }}
              />
            </div>
            <span style={{ width: "3.5rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatValue(s.value)}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
