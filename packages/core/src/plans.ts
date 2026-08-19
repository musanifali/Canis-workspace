/**
 * Plan tiers (#94). The single source of truth for what each tier allows —
 * the DB's usage ledger enforces `generationsPerMonth` (no second code path),
 * the dashboard renders usage-vs-cap from here, and the public "Plans &
 * limits" docs page is verified against this table (synced, not copied).
 *
 * Pure data, so it lives in core: no payment processor at launch, the tier is
 * just a label driving these caps. `null` means unlimited.
 */
export type Plan = "free" | "pro" | "internal";

export interface PlanCaps {
  /** Generation events per calendar month; null = unlimited. ENFORCED. */
  generationsPerMonth: number | null;
  /** Soft cap surfaced in the UI/docs; enforcement is a documented follow-up. */
  maxWorkspaces: number | null;
  /** Telemetry retention window in days; null = indefinite. Documented. */
  telemetryRetentionDays: number | null;
}

export const PLANS: readonly Plan[] = ["free", "pro", "internal"] as const;

export const PLAN_CAPS: Record<Plan, PlanCaps> = {
  free: {
    generationsPerMonth: 25,
    maxWorkspaces: 3,
    telemetryRetentionDays: 7,
  },
  pro: {
    generationsPerMonth: 2000,
    maxWorkspaces: 100,
    telemetryRetentionDays: 90,
  },
  internal: {
    generationsPerMonth: null,
    maxWorkspaces: null,
    telemetryRetentionDays: null,
  },
};

/** Human-facing label for a plan (dashboard, docs, CTA copy). */
export const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  pro: "Pro",
  internal: "Internal",
};

/** True for a valid plan id — guards raw SQL/admin plan changes. */
export function isPlan(value: string): value is Plan {
  return (PLANS as readonly string[]).includes(value);
}
