// Local demo data — a real SPA would call your API from the contract fetch.
export const TICKETS = Array.from({ length: 18 }, (_, i) => ({
  id: `T-${200 + i}`,
  subject: `Ticket ${i + 1}`,
  priority: (["low", "normal", "urgent"] as const)[i % 3]!,
  assignee: ["ana", "ben", "chao"][i % 3]!,
  ageHours: ((i * 7) % 90) + 2,
  opened: `2026-07-${String((i % 28) + 1).padStart(2, "0")}`,
}));
