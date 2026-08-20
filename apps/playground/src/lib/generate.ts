/**
 * Playground generation (#101): prompt → candidate spec → the SAME pure gate
 * the product ships (`validateSpec`), against the bundled sample contract.
 *
 * The model is grounded on the sample contract + the spec shape so it emits
 * valid specs most of the time — but `validateSpec` is the authority: a spec
 * that references data outside the contract comes back REJECT with a grounded
 * reason, never a broken render. That gate is what makes exfil/injection
 * prompts safe to expose publicly.
 */
import {
  validateSpec,
  type ValidationVerdict,
} from "@workspace-engine/core";
import { playgroundContract } from "@/lib/contract";

/** Gate a candidate spec against the sample contract (pure, no IO). */
export function gate(candidate: unknown): ValidationVerdict {
  return validateSpec(candidate, { contracts: { sample: playgroundContract } });
}

/**
 * System prompt: the sample contract's fields + allowed operations, plus the
 * WorkspaceSpec shape. Kept in sync with the real contract via
 * `sampleContract` so grounding never drifts from what the gate enforces.
 */
export function systemPrompt(): string {
  const c = playgroundContract as unknown as {
    fields?: Record<string, unknown>;
    capabilities?: {
      filterable?: string[];
      sortable?: string[];
      groupable?: string[];
      aggregations?: Record<string, string[]>;
    };
  };
  const caps = c.capabilities ?? {};
  const fields = Object.keys(c.fields ?? {}).join(", ");
  return [
    "You turn a user's request into a WorkspaceSpec (JSON) over ONE entity, `sample`.",
    `The sample entity has fields: ${fields || "id, name, status, team, effort, created"}.`,
    `You may filter on: ${(caps.filterable ?? []).join(", ")}.`,
    `Sort on: ${(caps.sortable ?? []).join(", ")}. Group on: ${(caps.groupable ?? []).join(", ")}.`,
    "Never reference a field or operation not listed above — if the request needs one, still return your best spec; a validator will reject it.",
    "Block types: KpiCards, CasesTable, GroupedBoard, Graph, CaseQueue, FilterBar.",
    "A spec is: {specVersion:1, title, timezone:'UTC', layout:{columns:12}, refresh:{mode:'manual'}, blocks:[{id, type, frame:{x,y,w,h}, config, binding:{entity:'sample', query:{...}}}]}.",
    "Output ONLY the JSON spec, no prose.",
  ].join("\n");
}

export interface DeepSeekConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

/**
 * Call DeepSeek for a candidate spec. Returns the parsed JSON (unvalidated) —
 * the caller gates it. Throws on transport/parse failure so the route can fall
 * back to a canned replay.
 */
export async function generateSpec(prompt: string, cfg: DeepSeekConfig): Promise<unknown> {
  const res = await fetch(`${cfg.baseUrl ?? "https://api.deepseek.com"}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model ?? "deepseek-chat",
      temperature: 0.2,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`deepseek ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("deepseek: empty response");
  return JSON.parse(content);
}

/** The shape the UI renders: the gate verdict, plus rows for a BUILD. */
export type PlaygroundResult =
  | { verdict: "BUILD"; spec: unknown }
  | { verdict: "CLARIFY"; questions: readonly { question: string }[] }
  | { verdict: "REJECT"; reasons: readonly { message: string; fix: string }[] };

/** Map a raw gate verdict to the UI result shape. */
export function toResult(v: ValidationVerdict): PlaygroundResult {
  if (v.verdict === "BUILD") return { verdict: "BUILD", spec: v.spec };
  if (v.verdict === "CLARIFY") {
    return { verdict: "CLARIFY", questions: v.questions.map((q) => ({ question: q.question })) };
  }
  return {
    verdict: "REJECT",
    reasons: v.errors.map((e) => ({ message: e.message, fix: e.fix })),
  };
}
