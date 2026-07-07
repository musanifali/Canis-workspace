/**
 * Regression checks for the case-management tools (no test framework in the
 * demo, so this is a plain script: exits non-zero on any failure).
 *
 * Run from demo/:  npx -y tsx scripts/check-tools.mts
 */
import {
  aggregateCases,
  listAnalysts,
  searchCases,
  todayIso,
} from "../src/services/case-management";
import { isOverdue } from "../src/components/workspace/case-visuals";

let failures = 0;

function check(name: string, condition: boolean) {
  console.log(`${condition ? "✓" : "✗"} ${name}`);
  if (!condition) failures++;
}

function throws(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

// limit edge cases — invalid limits must error, never silently mangle results
check("limit -1 rejected", throws(() => searchCases({ limit: -1 })));
check("limit 0 rejected", throws(() => searchCases({ limit: 0 })));
check("limit 5.7 rejected", throws(() => searchCases({ limit: 5.7 })));
check("limit 999 rejected", throws(() => searchCases({ limit: 999 })));
check("limit 1 returns 1 row", searchCases({ limit: 1 }).cases.length === 1);
check("limit 240 allowed", searchCases({ limit: 240 }).cases.length === 240);
check("default limit is 50", searchCases({}).cases.length === 50);
check("total unaffected by limit", searchCases({ limit: 5 }).total === 240);

// empty-array filters mean "no filter" (LLMs send [] for unused filters)
check(
  "empty [] filters match everything",
  searchCases({ risk: [], status: [], category: [] }).total === 240,
);

// single clock: tool's overdue classification must agree with the UI badge
const overdue = searchCases({ overdueOnly: true }).cases;
check("overdueOnly returns cases", overdue.length > 0);
check(
  "tool and UI badge agree on overdue",
  overdue.every((c) => isOverdue(c)),
);
check("todayIso is YYYY-MM-DD", /^\d{4}-\d{2}-\d{2}$/.test(todayIso()));

// date filters: datetimes must normalize to dates so boundaries stay inclusive
const someCase = searchCases({ limit: 1 }).cases[0];
check(
  "datetime dueAfter includes same-day case (inclusive boundary)",
  searchCases({
    dueAfter: `${someCase.dueDate}T19:32:08.687Z`,
    dueBefore: someCase.dueDate,
  }).cases.some((c) => c.id === someCase.id),
);
check(
  "datetime and date dueBefore agree",
  searchCases({ dueBefore: "2026-07-31T23:59:59Z" }).total ===
    searchCases({ dueBefore: "2026-07-31" }).total,
);
check(
  "non-date string rejected",
  throws(() => searchCases({ dueAfter: "next tuesday" })),
);

// aggregation sanity
const byRisk = aggregateCases({ groupBy: "risk" });
check(
  "aggregate counts sum to dataset size",
  byRisk.reduce((sum, row) => sum + row.value, 0) === 240,
);
check("aggregate rejects bad groupBy", throws(() =>
  aggregateCases({ groupBy: "nope" as never }),
));

// analysts
check("8 analysts listed", listAnalysts().length === 8);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed");
