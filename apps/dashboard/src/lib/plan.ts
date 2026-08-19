/**
 * Plan + usage for the dashboard's "Plan & usage" view (#94). Fetched directly
 * (not via the typed client) so it always reflects the live allowance fields.
 */
import { getSession } from "@/lib/session";

export interface Allowance {
  plan: "free" | "pro" | "internal";
  monthlyCap: number | null;
  usedThisMonth: number;
  remainingThisMonth: number | null;
  remainingThisMinute: number;
  allowed: boolean;
}

function apiBase(): string {
  return (process.env.WORKSPACE_API_URL ?? "http://localhost:8270").replace(/\/+$/, "");
}

/** The tenant's current plan + month-to-date usage, or null if unavailable. */
export async function getAllowance(): Promise<Allowance | null> {
  const apiKey = process.env.WORKSPACE_API_KEY;
  const session = await getSession();
  if (!apiKey || !session) return null;
  const res = await fetch(`${apiBase()}/v1/usage/allowance`, {
    headers: { "x-api-key": apiKey, "x-user-id": session.userId },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as Allowance;
}
