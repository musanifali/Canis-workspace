"use client";

import {
  isOverdue,
  riskBadgeClass,
} from "@/components/workspace/case-visuals";
import { caseSchema } from "@/services/case-management";
import { useTamboComponentState } from "@tambo-ai/react";
import { z } from "zod";

export const caseQueueSchema = z.object({
  title: z.string().optional().describe("Heading, e.g. 'Today's queue'"),
  cases: z
    .array(caseSchema)
    .describe(
      "Work items in priority order (pass them pre-sorted, e.g. by riskScore desc)",
    ),
});
export type CaseQueueProps = z.infer<typeof caseQueueSchema>;

/**
 * Prioritized work queue. Items can be checked off; progress syncs to Tambo state.
 */
export function CaseQueue({ title, cases }: CaseQueueProps) {
  // Props stream in progressively — cases may be missing mid-generation
  const rows = Array.isArray(cases) ? cases.filter((c) => c?.id) : [];
  const [doneIds, setDoneIds] = useTamboComponentState<string[]>(
    "doneCaseIds",
    [],
  );

  const toggleDone = (id: string) => {
    setDoneIds((prev = []) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  };

  const remaining = rows.filter((c) => !doneIds?.includes(c.id)).length;

  return (
    <div className="w-full rounded-lg border border-border bg-background p-4">
      <div className="flex items-baseline justify-between pb-3">
        <h3 className="text-sm font-semibold">{title ?? "Case queue"}</h3>
        <span className="text-xs text-muted-foreground">
          {remaining} of {rows.length} remaining
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((item) => {
          const isDone = doneIds?.includes(item.id) ?? false;
          return (
            <li
              key={item.id}
              className={`flex items-center gap-3 rounded-md border border-border/60 px-3 py-2 ${
                isDone ? "opacity-50" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={isDone}
                onChange={() => toggleDone(item.id)}
                aria-label={`Mark ${item.id} done`}
                className="size-4 accent-foreground"
              />
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm ${isDone ? "line-through" : ""}`}
                >
                  <span className="font-medium">{item.id}</span> — {item.title}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.customer} · {item.analyst} · due{" "}
                  <span className={isOverdue(item) ? "text-red-600" : ""}>
                    {item.dueDate}
                  </span>
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${riskBadgeClass[item.risk]}`}
              >
                {item.risk}
              </span>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Queue is empty.
        </p>
      )}
    </div>
  );
}
