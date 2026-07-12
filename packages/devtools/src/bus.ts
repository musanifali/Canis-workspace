/**
 * Devtools event bus (card #44).
 *
 * A tiny, framework-free ring buffer that the pipeline reports into and the
 * panel reads from. Decoupling matters: the SDK never imports the panel — it
 * just calls `recordSpec` / `recordVerdict` / `recordQuery`, which are cheap
 * no-op-ish appends. The panel subscribes via `useDevtoolsLog`. This is how the
 * whole thing tree-shakes out of production: nothing references the record
 * functions unless a devtools-instrumented build wires them.
 */
import { useSyncExternalStore } from "react";

/** One reason a verdict carried, mirroring a validator error's shape. */
export interface VerdictReason {
  path?: string;
  message: string;
  fix?: string;
  code?: string;
}

export type DevtoolsEvent =
  | { kind: "spec"; id: number; at: number; title: string; blockCount: number; spec: unknown }
  | {
      kind: "verdict";
      id: number;
      at: number;
      status: "build" | "clarify" | "reject";
      summary: string;
      reasons: VerdictReason[];
    }
  | {
      kind: "query";
      id: number;
      at: number;
      blockId: string;
      entity: string;
      query: unknown;
      status: "loading" | "success" | "error";
      rows: number | null;
      ms: number | null;
    };

const MAX_EVENTS = 250;
let events: readonly DevtoolsEvent[] = [];
let seq = 0;
const listeners = new Set<() => void>();

/** Distributive Omit so each union member keeps its own keys. */
type EventInput = DevtoolsEvent extends infer T
  ? T extends DevtoolsEvent
    ? Omit<T, "id" | "at">
    : never
  : never;

function push(event: EventInput): void {
  const full = { ...event, id: ++seq, at: Date.now() } as DevtoolsEvent;
  events = [...events, full].slice(-MAX_EVENTS);
  for (const l of listeners) l();
}

export function recordSpec(spec: unknown, title: string, blockCount: number): void {
  push({ kind: "spec", title, blockCount, spec });
}

export function recordVerdict(
  status: "build" | "clarify" | "reject",
  summary: string,
  reasons: VerdictReason[] = [],
): void {
  push({ kind: "verdict", status, summary, reasons });
}

export function recordQuery(entry: {
  blockId: string;
  entity: string;
  query: unknown;
  status: "loading" | "success" | "error";
  rows: number | null;
  ms: number | null;
}): void {
  push({ kind: "query", ...entry });
}

export function clearDevtoolsLog(): void {
  events = [];
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): readonly DevtoolsEvent[] {
  return events;
}

/** React hook: the current event log, re-rendering on every new event. */
export function useDevtoolsLog(): readonly DevtoolsEvent[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
