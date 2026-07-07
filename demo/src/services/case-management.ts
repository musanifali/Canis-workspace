/**
 * @file case-management.ts
 * @description Seeded case-management dataset + query tools for the Phase 0 demo.
 *
 * This is the vertical-slice data layer: ~240 deterministic compliance cases and
 * three query functions (search/filter, aggregate/group, list analysts). The Zod
 * schemas here are the single source of truth for the tool contracts registered
 * in src/lib/tambo.ts — the prototype for what data contracts later compile into.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Schemas (source of truth for tool inputs/outputs)
// ---------------------------------------------------------------------------

export const riskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export const caseStatusSchema = z.enum([
  "open",
  "in_review",
  "escalated",
  "resolved",
  "closed",
]);
export const caseCategorySchema = z.enum([
  "fraud",
  "aml",
  "kyc",
  "sanctions",
  "chargeback",
]);

export const caseSchema = z.object({
  id: z.string().describe("Case identifier, e.g. CASE-1042"),
  title: z.string(),
  customer: z.string().describe("Customer or account the case concerns"),
  risk: riskLevelSchema,
  riskScore: z.number().min(0).max(100).describe("0 (benign) to 100 (severe)"),
  status: caseStatusSchema,
  category: caseCategorySchema,
  analyst: z.string().describe("Full name of the assigned analyst"),
  openedDate: z.string().describe("ISO date the case was opened"),
  dueDate: z.string().describe("ISO date the case is due"),
  amountUsd: z.number().describe("Monetary exposure in USD"),
});
export type Case = z.infer<typeof caseSchema>;

export const analystSchema = z.object({
  name: z.string(),
  team: z.string(),
  specialty: caseCategorySchema,
  openCaseCount: z.number(),
});
export type Analyst = z.infer<typeof analystSchema>;

export const caseFilterSchema = z.object({
  query: z
    .string()
    .optional()
    .describe("Free-text match against title and customer"),
  risk: z.array(riskLevelSchema).optional(),
  status: z.array(caseStatusSchema).optional(),
  category: z.array(caseCategorySchema).optional(),
  analyst: z.string().optional().describe("Filter to one analyst by name"),
  // Models sometimes send full datetimes for date fields; truncating keeps
  // boundary comparisons against date-only dueDate values inclusive
  dueAfter: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}/, "expected an ISO date (YYYY-MM-DD)")
    .transform((value) => value.slice(0, 10))
    .optional()
    .describe("ISO date YYYY-MM-DD, inclusive"),
  dueBefore: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}/, "expected an ISO date (YYYY-MM-DD)")
    .transform((value) => value.slice(0, 10))
    .optional()
    .describe("ISO date YYYY-MM-DD, inclusive"),
  overdueOnly: z.boolean().optional(),
});
export type CaseFilter = z.infer<typeof caseFilterSchema>;

export const searchCasesInputSchema = caseFilterSchema.extend({
  sortBy: z
    .enum(["dueDate", "riskScore", "amountUsd", "openedDate"])
    .optional(),
  order: z.enum(["asc", "desc"]).optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(240)
    .optional()
    .describe("Max cases to return (1-240), default 50"),
});
export type SearchCasesInput = z.infer<typeof searchCasesInputSchema>;

export const searchCasesOutputSchema = z.object({
  total: z.number().describe("Matches before limit was applied"),
  cases: z.array(caseSchema),
});

export const aggregateCasesInputSchema = z.object({
  groupBy: z.enum(["analyst", "risk", "status", "category"]),
  metric: z
    .enum(["count", "totalAmountUsd", "avgRiskScore"])
    .optional()
    .describe("Defaults to count"),
  filter: caseFilterSchema
    .optional()
    .describe("Only aggregate cases matching this filter"),
});
export type AggregateCasesInput = z.infer<typeof aggregateCasesInputSchema>;

export const aggregateCasesOutputSchema = z.array(
  z.object({
    group: z.string(),
    value: z.number(),
  }),
);

// ---------------------------------------------------------------------------
// Deterministic dataset
// ---------------------------------------------------------------------------

const ANALYSTS: readonly { name: string; team: string; specialty: Case["category"] }[] =
  [
    { name: "Amara Okafor", team: "Financial Crimes", specialty: "aml" },
    { name: "Dmitri Volkov", team: "Financial Crimes", specialty: "sanctions" },
    { name: "Priya Raman", team: "Fraud Ops", specialty: "fraud" },
    { name: "Jonas Lindqvist", team: "Fraud Ops", specialty: "chargeback" },
    { name: "Lucía Fernández", team: "Onboarding Risk", specialty: "kyc" },
    { name: "Kenji Watanabe", team: "Onboarding Risk", specialty: "kyc" },
    { name: "Sarah Mitchell", team: "Fraud Ops", specialty: "fraud" },
    { name: "Omar Haddad", team: "Financial Crimes", specialty: "aml" },
  ];

const CUSTOMERS = [
  "Northwind Traders",
  "Acme Logistics",
  "Blue Harbor Capital",
  "Vertex Payments",
  "Solstice Retail Group",
  "Kite & Anchor Imports",
  "Meridian Health Supply",
  "Falcon Freight Ltd",
  "Aurora Fintech",
  "Cobalt Mining Co",
  "Juniper Marketplaces",
  "Atlas Travel Partners",
];

const TITLE_TEMPLATES: Record<Case["category"], string[]> = {
  fraud: [
    "Suspicious card testing burst",
    "Account takeover pattern detected",
    "Velocity spike on new device",
    "Mismatched billing fingerprint",
  ],
  aml: [
    "Structuring pattern across accounts",
    "Rapid pass-through transfers",
    "Unusual cross-border flow",
    "High-risk jurisdiction exposure",
  ],
  kyc: [
    "Document verification mismatch",
    "Beneficial ownership unclear",
    "Expired identity documents",
    "PEP screening hit review",
  ],
  sanctions: [
    "Potential watchlist name match",
    "Vessel screening alert",
    "Counterparty sanctions exposure",
    "Payment routed via flagged bank",
  ],
  chargeback: [
    "Chargeback ratio breach",
    "Friendly-fraud dispute cluster",
    "Duplicate dispute filings",
    "Unrecognized recurring charges",
  ],
};

const STATUSES = caseStatusSchema.options;
const CATEGORIES = caseCategorySchema.options;
const CASE_COUNT = 240;

/** Small deterministic PRNG so the dataset is identical on every load. */
function mulberry32(seed: number) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function riskFromScore(score: number): Case["risk"] {
  if (score >= 85) return "critical";
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
}

function isoDaysFromToday(days: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Single source of truth for "today" across tools and UI — local midnight,
 * rendered as an ISO date.
 *
 * @returns Today's date as YYYY-MM-DD
 */
export function todayIso(): string {
  return isoDaysFromToday(0);
}

function buildCases(): Case[] {
  const rand = mulberry32(20260704);
  return Array.from({ length: CASE_COUNT }, (_, i) => {
    const category = CATEGORIES[Math.floor(rand() * CATEGORIES.length)];
    const specialists = ANALYSTS.filter((a) => a.specialty === category);
    // Mostly route to a specialist, sometimes to anyone — keeps grouping interesting
    const analyst =
      rand() < 0.75 && specialists.length > 0
        ? specialists[Math.floor(rand() * specialists.length)]
        : ANALYSTS[Math.floor(rand() * ANALYSTS.length)];
    const riskScore = Math.round(rand() * 100);
    const status = STATUSES[Math.floor(rand() * STATUSES.length)];
    const openedDaysAgo = Math.floor(rand() * 60) + 5;
    // Due dates span ~5 weeks back to ~6 weeks ahead so "due this month" and
    // "overdue" prompts both have material to work with
    const dueOffset = Math.floor(rand() * 80) - 35;
    const titles = TITLE_TEMPLATES[category];

    return {
      id: `CASE-${1000 + i}`,
      title: titles[Math.floor(rand() * titles.length)],
      customer: CUSTOMERS[Math.floor(rand() * CUSTOMERS.length)],
      risk: riskFromScore(riskScore),
      riskScore,
      status,
      category,
      analyst: analyst.name,
      openedDate: isoDaysFromToday(-openedDaysAgo),
      dueDate: isoDaysFromToday(dueOffset),
      amountUsd: Math.round((rand() * 250000 + 500) / 100) * 100,
    };
  });
}

const CASES: readonly Case[] = buildCases();

// ---------------------------------------------------------------------------
// Query functions (the tools)
// ---------------------------------------------------------------------------

function applyFilter(cases: readonly Case[], filter: CaseFilter): Case[] {
  const today = todayIso();
  const query = filter.query?.toLowerCase();
  return cases.filter((c) => {
    if (
      query &&
      !c.title.toLowerCase().includes(query) &&
      !c.customer.toLowerCase().includes(query)
    ) {
      return false;
    }
    // Empty arrays mean "no filter" — LLMs often send [] for unused filters
    if (filter.risk?.length && !filter.risk.includes(c.risk)) return false;
    if (filter.status?.length && !filter.status.includes(c.status)) {
      return false;
    }
    if (filter.category?.length && !filter.category.includes(c.category)) {
      return false;
    }
    if (filter.analyst && c.analyst !== filter.analyst) return false;
    if (filter.dueAfter && c.dueDate < filter.dueAfter) return false;
    if (filter.dueBefore && c.dueDate > filter.dueBefore) return false;
    if (
      filter.overdueOnly &&
      (c.dueDate >= today || c.status === "resolved" || c.status === "closed")
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Search and filter cases with optional sorting and a result limit.
 *
 * @returns The total match count plus the (sorted, limited) matching cases.
 */
export function searchCases(input: SearchCasesInput) {
  const { sortBy, order, limit, ...filter } = searchCasesInputSchema.parse(input);
  const matches = applyFilter(CASES, filter);
  const direction = order === "desc" ? -1 : 1;
  const sorted = sortBy
    ? matches.toSorted((a, b) => {
        const left = a[sortBy];
        const right = b[sortBy];
        if (left < right) return -direction;
        if (left > right) return direction;
        return 0;
      })
    : matches;
  return {
    total: matches.length,
    cases: sorted.slice(0, limit ?? 50),
  };
}

/**
 * Group cases by a field and compute a metric per group.
 *
 * @returns One row per group, sorted by value descending.
 */
export function aggregateCases(rawInput: AggregateCasesInput) {
  const input = aggregateCasesInputSchema.parse(rawInput);
  const matches = applyFilter(CASES, input.filter ?? {});
  const groups = new Map<string, Case[]>();
  for (const c of matches) {
    const key = c[input.groupBy];
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }

  const metric = input.metric ?? "count";
  const rows = [...groups.entries()].map(([group, cases]) => {
    switch (metric) {
      case "count":
        return { group, value: cases.length };
      case "totalAmountUsd":
        return {
          group,
          value: cases.reduce((sum, c) => sum + c.amountUsd, 0),
        };
      case "avgRiskScore":
        return {
          group,
          value:
            Math.round(
              (cases.reduce((sum, c) => sum + c.riskScore, 0) / cases.length) *
                10,
            ) / 10,
        };
    }
  });
  return rows.toSorted((a, b) => b.value - a.value);
}

/**
 * List all analysts with their team, specialty, and current open-case load.
 *
 * @returns Every analyst, sorted by open-case count descending.
 */
export function listAnalysts(): Analyst[] {
  const analysts = ANALYSTS.map(({ name, team, specialty }) => ({
    name,
    team,
    specialty,
    openCaseCount: CASES.filter(
      (c) =>
        c.analyst === name && c.status !== "resolved" && c.status !== "closed",
    ).length,
  }));
  return analysts.toSorted((a, b) => b.openCaseCount - a.openCaseCount);
}
