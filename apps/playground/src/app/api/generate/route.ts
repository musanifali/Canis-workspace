/**
 * Playground generation endpoint (#101). Public + unauthenticated, so it's
 * hardened: a per-IP rate limit, a prompt-length cap, and a daily global budget
 * on the shared DeepSeek key. When the budget is spent (or the model errors, or
 * no key is configured), it DEGRADES to a canned replay — never a broken page.
 *
 * Every path ends at the same pure gate (validateSpec), so an exfil/injection
 * prompt is a grounded REJECT no matter how the spec was produced.
 */
import { NextResponse, type NextRequest } from "next/server";
import { CANNED_PROMPTS, cannedFor } from "@/lib/canned";
import { gate, generateSpec, toResult } from "@/lib/generate";

const PROMPT_MAX = 500;
const RATE_MAX = 8; // generations per IP per window
const RATE_WINDOW_MS = 60_000;
const DAILY_BUDGET = Number(process.env.PLAYGROUND_DAILY_BUDGET ?? 500);

// In-process state (single-instance playground). Horizontal scale → Redis.
const hits = new Map<string, number[]>();
let budgetDay = "";
let budgetUsed = 0;

function clientIp(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for") ?? "local").split(",")[0]!.trim();
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => t > now - RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function takeBudget(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== budgetDay) {
    budgetDay = today;
    budgetUsed = 0;
  }
  if (budgetUsed >= DAILY_BUDGET) return false;
  budgetUsed += 1;
  return true;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as { prompt?: unknown };
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return NextResponse.json({ error: "empty prompt" }, { status: 400 });
  if (prompt.length > PROMPT_MAX) {
    return NextResponse.json({ error: `prompt too long (max ${PROMPT_MAX})` }, { status: 400 });
  }
  if (rateLimited(clientIp(request))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // 1. Suggested prompts are canned (deterministic + free) — gated live.
  const canned = cannedFor(prompt);
  let candidate: unknown;
  let source: "canned" | "live" | "replay" = "canned";

  if (canned) {
    candidate = canned.spec;
  } else {
    const key = process.env.DEEPSEEK_API_KEY;
    // 2. Live generation when we have a key AND budget; else graceful replay.
    if (key && takeBudget()) {
      try {
        candidate = await generateSpec(prompt, { apiKey: key });
        source = "live";
      } catch {
        candidate = CANNED_PROMPTS[0]!.spec;
        source = "replay";
      }
    } else {
      candidate = CANNED_PROMPTS[0]!.spec;
      source = "replay";
    }
  }

  const result = toResult(gate(candidate));
  return NextResponse.json({ ...result, source });
}
