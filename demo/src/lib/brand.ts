/**
 * Single swappable source of truth for the product name/tagline, per the
 * Demo Polish epic's open decision (Trello #75/#76). Confirmed as "Canis"
 * in the 2026-07-14 implementer kickoff brief (matches the git remote
 * Canis-workspace); change here if that changes.
 */
export const brand = {
  name: "Canis",
  tagline: "Natural language in. A safe, saved, native workspace out.",
  description:
    "Canis turns a plain-language request into a validated, data-backed workspace — grounded in your data contracts, safe to save, and native to your team.",
} as const;
