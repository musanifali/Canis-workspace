"use client";

import {
  categoryLabel,
  isOverdue,
  riskBadgeClass,
  statusLabel,
} from "@/components/workspace/case-visuals";
import { caseSchema } from "@/services/case-management";
import { z } from "zod";

export const groupedBoardSchema = z.object({
  title: z.string().optional().describe("Heading shown above the board"),
  groupBy: z
    .enum(["analyst", "risk", "status", "category"])
    .describe("Field to group columns by"),
  cases: z
    .array(caseSchema)
    .describe("Cases to lay out, typically from searchCases"),
});
export type GroupedBoardProps = z.infer<typeof groupedBoardSchema>;

function groupHeading(
  groupBy: GroupedBoardProps["groupBy"],
  key: string,
): string {
  if (groupBy === "status") {
    return statusLabel[key as keyof typeof statusLabel] ?? key;
  }
  if (groupBy === "category") {
    return categoryLabel[key as keyof typeof categoryLabel] ?? key;
  }
  return key;
}

/**
 * Kanban-style board: one column per group value, cases as cards inside.
 */
export function GroupedBoard({ title, groupBy, cases }: GroupedBoardProps) {
  // Tambo streams props progressively — cases/groupBy may be missing or
  // partial while the model is still generating
  const rows = Array.isArray(cases) ? cases.filter((c) => c?.id) : [];
  const groups = new Map<string, typeof rows>();
  for (const c of rows) {
    const key = groupBy ? c[groupBy] : undefined;
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const columns = [...groups.entries()].toSorted(
    (a, b) => b[1].length - a[1].length,
  );

  return (
    <div className="w-full rounded-lg border border-border bg-background p-4">
      {title && <h3 className="pb-3 text-sm font-semibold">{title}</h3>}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map(([key, columnCases]) => (
          <div
            key={key}
            className="flex w-60 shrink-0 flex-col gap-2 rounded-md bg-muted/50 p-2"
          >
            <p className="flex items-baseline justify-between px-1 text-xs font-semibold">
              {groupHeading(groupBy, key)}
              <span className="font-normal text-muted-foreground">
                {columnCases.length}
              </span>
            </p>
            {columnCases.map((item) => (
              <div
                key={item.id}
                className="rounded-md border border-border bg-background p-2"
              >
                <p className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">{item.id}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${riskBadgeClass[item.risk]}`}
                  >
                    {item.risk}
                  </span>
                </p>
                <p className="truncate pt-1 text-xs">{item.title}</p>
                <p className="truncate pt-0.5 text-[11px] text-muted-foreground">
                  {item.customer} · due{" "}
                  <span className={isOverdue(item) ? "text-red-600" : ""}>
                    {item.dueDate}
                  </span>
                </p>
              </div>
            ))}
          </div>
        ))}
      </div>
      {rows.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nothing to show.
        </p>
      )}
    </div>
  );
}
