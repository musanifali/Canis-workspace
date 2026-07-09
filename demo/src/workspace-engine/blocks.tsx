"use client";

/**
 * Workspace Engine demo blocks — thin, headless-friendly adapters that render a
 * block's query `data` into UI. No Tambo dependency (the workspace read path is
 * LLM-free): they take BlockComponentProps and reuse the shared case-visuals
 * helpers. The polished, themeable default block set is card #39.
 */
import type { BlockComponentProps } from "@workspace-engine/react";
import {
  formatUsd,
  isOverdue,
  riskBadgeClass,
  statusLabel,
} from "@/components/workspace/case-visuals";
import type { Case } from "@/services/case-management";

function heading(config: Record<string, unknown>): string | undefined {
  return typeof config.title === "string" ? config.title : undefined;
}

export function CasesTableBlock({ block, data }: BlockComponentProps) {
  const rows = (data as Case[] | undefined) ?? [];
  const title = heading(block.config);
  return (
    <div data-block="CasesTable" className="flex h-full flex-col overflow-hidden rounded-lg border border-black/10 bg-white">
      {title && <div className="border-b border-black/10 px-3 py-2 text-sm font-semibold">{title}</div>}
      <div className="overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-black/50">
            <tr>
              <th className="px-3 py-1.5">Case</th>
              <th className="px-3 py-1.5">Risk</th>
              <th className="px-3 py-1.5">Status</th>
              <th className="px-3 py-1.5">Analyst</th>
              <th className="px-3 py-1.5">Due</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-black/5">
                <td className="px-3 py-1.5 font-medium">{c.id}</td>
                <td className="px-3 py-1.5">
                  <span className={`rounded px-1.5 py-0.5 ${riskBadgeClass[c.risk]}`}>{c.risk}</span>
                </td>
                <td className="px-3 py-1.5">{statusLabel[c.status]}</td>
                <td className="px-3 py-1.5">{c.analyst}</td>
                <td className={`px-3 py-1.5 ${isOverdue(c) ? "font-semibold text-red-600" : ""}`}>{c.dueDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="px-3 py-4 text-xs text-black/40">No cases.</div>}
      </div>
    </div>
  );
}

interface KpiConfigCard {
  alias: string;
  label: string;
  intent?: "positive" | "negative" | "neutral";
}

export function KpiCardsBlock({ block, data }: BlockComponentProps) {
  const values = ((data as Record<string, number>[] | undefined) ?? [{}])[0] ?? {};
  const cards = (block.config.cards as KpiConfigCard[] | undefined) ?? [];
  return (
    <div data-block="KpiCards" className="grid h-full grid-flow-col gap-3">
      {cards.map((card) => (
        <div key={card.alias} className="flex flex-col justify-center rounded-lg border border-black/10 bg-white px-4 py-3">
          <span className="text-xs text-black/50">{card.label}</span>
          <span className="text-2xl font-semibold">{values[card.alias] ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}

export function CaseQueueBlock({ block, data }: BlockComponentProps) {
  const rows = (data as Case[] | undefined) ?? [];
  const title = heading(block.config);
  return (
    <div data-block="CaseQueue" className="flex h-full flex-col overflow-hidden rounded-lg border border-black/10 bg-white">
      {title && <div className="border-b border-black/10 px-3 py-2 text-sm font-semibold">{title}</div>}
      <ul className="divide-y divide-black/5 overflow-auto">
        {rows.map((c) => (
          <li key={c.id} className="flex items-center justify-between px-3 py-2 text-xs">
            <span className="font-medium">{c.id}</span>
            <span className="truncate px-2 text-black/60">{c.title}</span>
            <span className={isOverdue(c) ? "font-semibold text-red-600" : "text-black/50"}>{c.dueDate}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface GroupData {
  group: string;
  rows: Case[];
}

export function GroupedBoardBlock({ block, data }: BlockComponentProps) {
  const groups = (data as GroupData[] | undefined) ?? [];
  const title = heading(block.config);
  return (
    <div data-block="GroupedBoard" className="flex h-full flex-col overflow-hidden rounded-lg border border-black/10 bg-white">
      {title && <div className="border-b border-black/10 px-3 py-2 text-sm font-semibold">{title}</div>}
      <div className="flex gap-3 overflow-auto p-3">
        {groups.map((g) => (
          <div key={g.group} className="min-w-40 flex-1 rounded-md bg-black/5 p-2">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold">
              <span className="capitalize">{g.group}</span>
              <span className="text-black/40">{g.rows.length}</span>
            </div>
            <ul className="space-y-1">
              {g.rows.slice(0, 6).map((c) => (
                <li key={c.id} className="rounded bg-white px-2 py-1 text-[11px]">
                  <span className="font-medium">{c.id}</span>
                  <span className="ml-1 text-black/50">{formatUsd(c.amountUsd)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
