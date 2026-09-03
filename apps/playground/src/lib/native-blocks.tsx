"use client";

/**
 * The partner proof (#113): a second, visually distinct component set over the
 * SAME contract and the SAME spec.
 *
 * "Northwind" is an invented product identity — deliberately not a real
 * company's branding, and it implies no partnership. It exists only to show
 * what "renders in the host's design language" means when you can see two
 * treatments of identical data side by side.
 *
 * Nothing here imports @ticora/ui: these are "their" components.
 */
import type { BlockComponentProps } from "@ticora/react";

interface Row {
  id: string;
  name: string;
  status: string;
  team: string;
  effort: number;
}

/** Northwind's table: dense, monospaced ids, status pills. */
export function NwTable({ block, data, status }: BlockComponentProps) {
  const rows = (data as Row[] | undefined) ?? [];
  const title = (block.config as { title?: string }).title ?? "Items";
  if (status === "loading") return <div className="nw-skeleton" />;
  return (
    <section className="nw-card">
      <header className="nw-card__head">{title}</header>
      <table className="nw-table">
        <tbody>
          {rows.slice(0, 8).map((r) => (
            <tr key={r.id}>
              <td className="nw-id">{r.id}</td>
              <td>{r.name}</td>
              <td>
                <span className={`nw-pill nw-pill--${r.status}`}>{r.status}</span>
              </td>
              <td className="nw-effort">{r.effort}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Northwind's board: columns with count chips. */
export function NwBoard({ block, data, status }: BlockComponentProps) {
  const groups = (data as { group: string; rows: Row[] }[] | undefined) ?? [];
  const title = (block.config as { title?: string }).title ?? "Board";
  if (status === "loading") return <div className="nw-skeleton" />;
  return (
    <section className="nw-card">
      <header className="nw-card__head">{title}</header>
      <div className="nw-board">
        {groups.map((g) => (
          <div className="nw-col" key={g.group}>
            <div className="nw-col__head">
              {g.group} <span className="nw-chip">{g.rows.length}</span>
            </div>
            {g.rows.slice(0, 4).map((r) => (
              <article className="nw-tile" key={r.id}>
                <span className="nw-id">{r.id}</span>
                {r.name}
              </article>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Northwind's KPIs: big numerals, label underneath. */
export function NwKpis({ block, data, status }: BlockComponentProps) {
  // An "aggregate" binding yields ONE row of aliased values, not a flat map —
  // same shape the default KpiCards reads.
  const agg = ((data as Record<string, number>[] | undefined) ?? [])[0] ?? {};
  const cards = (block.config as { cards?: { alias: string; label: string }[] }).cards ?? [];
  if (status === "loading") return <div className="nw-skeleton" />;
  return (
    <section className="nw-kpis">
      {cards.map((c) => (
        <div className="nw-kpi" key={c.alias}>
          <div className="nw-kpi__value">{agg[c.alias] ?? "—"}</div>
          <div className="nw-kpi__label">{c.label}</div>
        </div>
      ))}
    </section>
  );
}
