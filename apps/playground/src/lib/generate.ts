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
import { CANNED_PROMPTS } from "@/lib/canned";
import { playgroundContract, SAMPLE_CAPS, SAMPLE_FIELDS } from "@/lib/contract";

/** Gate a candidate spec against the sample contract (pure, no IO). */
export function gate(candidate: unknown): ValidationVerdict {
  return validateSpec(candidate, { contracts: { sample: playgroundContract } });
}

/**
 * System prompt: the sample contract's fields + allowed operations, plus the
 * WorkspaceSpec shape. Reads the exported source arrays (SAMPLE_FIELDS /
 * SAMPLE_CAPS) — the SAME values the contract is built from — rather than
 * introspecting the opaque defineEntity result (whose capabilities aren't
 * re-exposed as arrays).
 */
export function systemPrompt(): string {
  // A real, gate-valid spec as the concrete example the model must match.
  const example = JSON.stringify(
    CANNED_PROMPTS.find((c) => c.id === "build")!.spec,
  );
  return [
    "You turn a user's request into a WorkspaceSpec (JSON) over ONE entity, `sample`.",
    `The sample entity has fields: ${SAMPLE_FIELDS.join(", ")}.`,
    `You may filter on: ${SAMPLE_CAPS.filterable.join(", ")}. Sort on: ${SAMPLE_CAPS.sortable.join(", ")}. Group on: ${SAMPLE_CAPS.groupable.join(", ")}.`,
    "Every block MUST have: id, type (one of KpiCards, CasesTable, GroupedBoard, Graph), frame{x,y,w,h}, config, and binding{entity:\"sample\", query:{...}}.",
    "Put filters/sort/groupBy/aggregations INSIDE binding.query — NEVER at the block top level.",
    "Never reference a field or operation not listed above; if the request needs one, still return your best spec (a validator will reject it with a reason).",
    "Match this COMPLETE valid example's exact structure:",
    example,
    "Output ONLY the JSON spec for the user's request, no prose.",
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
