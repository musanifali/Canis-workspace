/**
 * Phase 0 "sentence → screen" quality log (Trello ticket #4).
 *
 * Headless harness that mirrors what the chat UI does: for each prompt it
 * calls POST /threads/advancestream with the registered components + client
 * tools, executes requested tools locally, appends the results, and repeats
 * until the model produces a component decision. Results land in
 * demo/eval/phase0-quality-log.json (+ .md summary) as the seed of the
 * Phase 3 eval dataset.
 *
 * Run from demo/:  npx -y tsx scripts/eval-prompts.mts [count]
 * Reads NEXT_PUBLIC_TAMBO_API_KEY / NEXT_PUBLIC_TAMBO_URL from .env.local.
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { schemaToJsonSchema } from "@tambo-ai/client";
import type { TamboComponent, TamboTool } from "@tambo-ai/react";

// @tambo-ai/react's voice support spins up a web Worker at import time, which
// doesn't exist in Node — stub it (never used headlessly), then import.
class WorkerStub {
  postMessage() {}
  addEventListener() {}
  removeEventListener() {}
  terminate() {}
}
(globalThis as Record<string, unknown>).Worker ??= WorkerStub;

const { components, tools } = (await import("../src/lib/tambo")) as {
  components: TamboComponent[];
  tools: TamboTool[];
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const envFile = readFileSync(join(scriptDir, "..", ".env.local"), "utf8");
const apiKey = envFile.match(/NEXT_PUBLIC_TAMBO_API_KEY=(.*)/)?.[1]?.trim();
const tamboUrl =
  envFile.match(/NEXT_PUBLIC_TAMBO_URL=(.*)/)?.[1]?.trim() ??
  "http://localhost:8261";
if (!apiKey) {
  throw new Error("NEXT_PUBLIC_TAMBO_API_KEY not found in .env.local");
}

interface EvalPrompt {
  prompt: string;
  expected: string[];
}

const EVAL_PROMPTS: EvalPrompt[] = [
  { prompt: "Show high-risk cases due this month, grouped by analyst", expected: ["GroupedBoard"] },
  { prompt: "List all critical fraud cases", expected: ["CasesTable"] },
  { prompt: "How many cases are overdue right now?", expected: ["KpiCards"] },
  { prompt: "What should I work on today?", expected: ["CaseQueue"] },
  { prompt: "Show the number of cases per analyst as a bar chart", expected: ["Graph"] },
  { prompt: "Break down our total dollar exposure by category", expected: ["Graph", "KpiCards"] },
  { prompt: "Show me Amara Okafor's open cases", expected: ["CasesTable"] },
  { prompt: "Give me a filterable view of escalated cases", expected: ["FilterBar", "CasesTable"] },
  { prompt: "Which analyst has the biggest open workload?", expected: ["KpiCards", "Graph", "CasesTable"] },
  { prompt: "Show sanctions cases sorted by exposure, largest first", expected: ["CasesTable"] },
  { prompt: "Kanban view of open and escalated cases by status", expected: ["GroupedBoard"] },
  { prompt: "Average risk score by category", expected: ["Graph", "KpiCards"] },
  { prompt: "Top 5 most urgent cases I should triage", expected: ["CaseQueue", "CasesTable"] },
  { prompt: "Give me an overview of our current case load", expected: ["KpiCards", "Graph"] },
  { prompt: "Show KYC cases due in the next 7 days", expected: ["CasesTable"] },
  { prompt: "How are chargeback cases distributed across statuses?", expected: ["Graph", "GroupedBoard"] },
  { prompt: "Who are our analysts and what does each specialize in?", expected: ["CasesTable", "KpiCards"] },
  { prompt: "Show low risk cases that are already resolved", expected: ["CasesTable"] },
  { prompt: "Build a triage queue of critical cases ordered by due date", expected: ["CaseQueue"] },
  { prompt: "Pie chart of cases by risk level", expected: ["Graph"] },
];

// ---------------------------------------------------------------------------
// Registry → API payload conversion (mirrors the react SDK)
// ---------------------------------------------------------------------------

function toAvailableComponent(component: TamboComponent) {
  return {
    name: component.name,
    description: component.description,
    contextTools: [],
    props: schemaToJsonSchema(component.propsSchema),
  };
}

function toClientTool(tool: TamboTool) {
  const inputJsonSchema = schemaToJsonSchema(tool.inputSchema) as {
    properties?: Record<string, { type?: string; description?: string }>;
    required?: string[];
  };
  const properties = inputJsonSchema.properties ?? {};
  const required = new Set(inputJsonSchema.required ?? []);
  return {
    name: tool.name,
    description: tool.description,
    parameters: Object.entries(properties).map(([name, schema]) => ({
      name,
      type: schema.type ?? "object",
      description: schema.description ?? "",
      isRequired: required.has(name),
      schema,
    })),
  };
}

const availableComponents = components.map(toAvailableComponent);
const clientTools = tools.map(toClientTool);
const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));

// ---------------------------------------------------------------------------
// advancestream loop
// ---------------------------------------------------------------------------

interface StreamResult {
  threadId: string;
  message: {
    tool_call_id?: string;
    toolCallRequest?: {
      toolName: string;
      parameters: { parameterName: string; parameterValue: unknown }[];
    };
    component?: { componentName?: string | null; props?: unknown };
    content: { type: string; text?: string }[];
  };
  generationStage: string;
}

async function advance(
  path: string,
  messageToAppend: Record<string, unknown>,
): Promise<StreamResult> {
  const response = await fetch(`${tamboUrl}${path}`, {
    method: "POST",
    headers: { "x-api-key": apiKey!, "Content-Type": "application/json" },
    body: JSON.stringify({ messageToAppend, availableComponents, clientTools }),
  });
  if (!response.ok) {
    throw new Error(`${path} → HTTP ${response.status}: ${await response.text()}`);
  }
  const raw = await response.text();
  const dataLines = raw
    .split("\n")
    .filter((line) => line.startsWith("data: ") && !line.includes('"DONE"'))
    .filter((line) => line.trim() !== "data: DONE");
  const last = dataLines[dataLines.length - 1];
  if (!last) {
    throw new Error(`${path} → empty stream`);
  }
  const payload = JSON.parse(last.slice(6));
  return {
    threadId: payload.responseMessageDto.threadId,
    message: payload.responseMessageDto,
    generationStage: payload.generationStage,
  };
}

interface DecisionMessage {
  toolCallRequest?: { toolName: string };
  component?: { componentName?: string | null; props?: unknown };
}

/**
 * Polls the thread until generation is idle (or timeout), then returns the
 * last server-handled show_component_* message, if any.
 *
 * @returns The decision message, or undefined when the model answered with text only
 */
async function waitForComponentDecision(
  threadId: string,
  timeoutMs = 60_000,
): Promise<DecisionMessage | undefined> {
  const deadline = Date.now() + timeoutMs;
  let lastDecision: DecisionMessage | undefined;
  while (Date.now() < deadline) {
    const threadResponse = await fetch(`${tamboUrl}/threads/${threadId}`, {
      headers: { "x-api-key": apiKey! },
    });
    const thread = (await threadResponse.json()) as {
      generationStage?: string;
    };
    const stage = thread.generationStage ?? "";
    const isIdle = ["COMPLETE", "ERROR", "CANCELLED", "IDLE"].includes(stage);

    const messagesResponse = await fetch(
      `${tamboUrl}/threads/${threadId}/messages`,
      { headers: { "x-api-key": apiKey! } },
    );
    const messages = (await messagesResponse.json()) as DecisionMessage[];
    lastDecision = messages.findLast((m) =>
      m.toolCallRequest?.toolName?.startsWith("show_component_"),
    );

    if (isIdle) break;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return lastDecision;
}

async function runPrompt(prompt: string, maxRounds = 6) {
  const toolCalls: { tool: string; args: Record<string, unknown> }[] = [];
  let result = await advance("/threads/advancestream", {
    role: "user",
    content: [{ type: "text", text: prompt }],
    additionalContext: {
      userTime: new Date().toISOString(),
      timezone: "local",
    },
  });

  for (let round = 0; round < maxRounds; round++) {
    const request = result.message.toolCallRequest;
    if (!request) break;

    const tool = toolsByName.get(request.toolName);
    const args = Object.fromEntries(
      request.parameters.map((p) => [p.parameterName, p.parameterValue]),
    );
    toolCalls.push({ tool: request.toolName, args });

    // Mirror the real UI: tool failures (e.g. schema rejection of bad args)
    // go back to the model as an error result so it can retry with fixed args.
    let toolResult: unknown;
    if (!tool) {
      toolResult = { error: `Unknown tool ${request.toolName}` };
    } else {
      try {
        toolResult = await (tool.tool as (input: unknown) => unknown)(
          Object.keys(args).length === 1 && "input" in args ? args.input : args,
        );
      } catch (error) {
        toolResult = {
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    result = await advance(`/threads/${result.threadId}/advancestream`, {
      role: "tool",
      tool_call_id: result.message.tool_call_id,
      content: [{ type: "text", text: JSON.stringify(toolResult) }],
    });
  }

  // The backend records the component decision as a server-handled
  // `show_component_<Name>` tool call. It can land AFTER the client tool
  // loop ends (the thread is still generating), so wait for the thread to
  // go idle before reading it off the messages.
  const decision = await waitForComponentDecision(result.threadId);

  const componentName = decision?.component?.componentName ?? null;
  const text = result.message.content
    .map((c) => c.text ?? "")
    .join("")
    .slice(0, 300);
  return { toolCalls, componentName, props: decision?.component?.props, text, stage: result.generationStage };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const count = Number(process.argv[2] ?? EVAL_PROMPTS.length);
const runs: Record<string, unknown>[] = [];

/** Gemini free tier is 10 requests/min and a prompt costs 2-3 LLM calls. */
const PACING_MS = 5_000;
const THROTTLE_COOLDOWN_MS = 65_000;

function looksThrottled(outcome: {
  componentName: string | null;
  toolCalls: unknown[];
  text: string;
}): boolean {
  return (
    !outcome.componentName &&
    outcome.toolCalls.length === 0 &&
    outcome.text.trim() === ""
  );
}

async function runPromptWithRetry(prompt: string) {
  const first = await runPrompt(prompt);
  if (!looksThrottled(first)) return first;
  console.log(`    throttled — cooling down ${THROTTLE_COOLDOWN_MS / 1000}s and retrying`);
  await new Promise((resolve) => setTimeout(resolve, THROTTLE_COOLDOWN_MS));
  return await runPrompt(prompt);
}

for (const [index, evalCase] of EVAL_PROMPTS.slice(0, count).entries()) {
  const label = `[${index + 1}/${count}]`;
  try {
    const outcome = await runPromptWithRetry(evalCase.prompt);
    const componentMatch = outcome.componentName
      ? evalCase.expected.includes(outcome.componentName)
      : false;
    runs.push({
      prompt: evalCase.prompt,
      expected: evalCase.expected,
      component: outcome.componentName,
      componentMatch,
      toolCalls: outcome.toolCalls,
      propsPreview: JSON.stringify(outcome.props)?.slice(0, 400) ?? null,
      text: outcome.text,
      stage: outcome.stage,
    });
    console.log(
      `${label} ${componentMatch ? "✓" : "✗"} "${evalCase.prompt}" → ${outcome.componentName ?? "(no component)"} via ${outcome.toolCalls.map((t) => t.tool).join(",") || "(no tools)"}`,
    );
  } catch (error) {
    runs.push({
      prompt: evalCase.prompt,
      expected: evalCase.expected,
      error: error instanceof Error ? error.message.slice(0, 300) : String(error),
    });
    console.log(`${label} ⚠ "${evalCase.prompt}" → ERROR: ${error instanceof Error ? error.message.slice(0, 120) : error}`);
  }
  // Write incrementally so a crash or timeout keeps partial results
  mkdirSync(join(scriptDir, "..", "eval"), { recursive: true });
  writeFileSync(
    join(scriptDir, "..", "eval", "phase0-quality-log.json"),
    JSON.stringify(runs, null, 2),
  );
  // Gentle pacing for the free-tier provider
  await new Promise((resolve) => setTimeout(resolve, PACING_MS));
}

const matched = runs.filter((r) => r.componentMatch).length;
const errored = runs.filter((r) => r.error).length;
const summaryLines = [
  `# Phase 0 quality log — ${new Date().toISOString().slice(0, 10)}`,
  "",
  `Model: deepseek-v4-flash via DeepSeek API (openai-compatible provider)`,
  `Result: ${matched}/${runs.length} component picks matched expectation, ${errored} errored.`,
  "",
  "| # | Prompt | Expected | Got | Tools | Match |",
  "|---|--------|----------|-----|-------|-------|",
  ...runs.map((r, i) => {
    const tools = Array.isArray(r.toolCalls)
      ? (r.toolCalls as { tool: string }[]).map((t) => t.tool).join(", ")
      : "—";
    const got = r.error ? `ERROR` : ((r.component as string) ?? "(none)");
    const mark = r.error ? "⚠" : r.componentMatch ? "✓" : "✗";
    return `| ${i + 1} | ${r.prompt} | ${(r.expected as string[]).join(" / ")} | ${got} | ${tools} | ${mark} |`;
  }),
  "",
  "Manual notes: review propsPreview in the JSON for coherence (right filters, sorting, groupBy).",
];

const evalDir = join(scriptDir, "..", "eval");
mkdirSync(evalDir, { recursive: true });
writeFileSync(join(evalDir, "phase0-quality-log.json"), JSON.stringify(runs, null, 2));
writeFileSync(join(evalDir, "phase0-quality-log.md"), summaryLines.join("\n") + "\n");
console.log(`\n${matched}/${runs.length} matched, ${errored} errors → demo/eval/phase0-quality-log.{json,md}`);
