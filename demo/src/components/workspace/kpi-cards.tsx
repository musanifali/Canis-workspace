"use client";

import { z } from "zod";

export const kpiCardsSchema = z.object({
  metrics: z
    .array(
      z.object({
        label: z.string().describe("Short metric name, e.g. 'Overdue cases'"),
        value: z.union([z.number(), z.string()]),
        unit: z.string().optional().describe("Suffix, e.g. '%' or 'USD'"),
        caption: z
          .string()
          .optional()
          .describe("One-line context under the value"),
        intent: z
          .enum(["neutral", "positive", "negative"])
          .optional()
          .describe("Colors the value: negative=red, positive=green"),
      }),
    )
    .describe("One card per metric, laid out in a responsive row"),
});
export type KpiCardsProps = z.infer<typeof kpiCardsSchema>;

const intentClass = {
  neutral: "",
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-red-600 dark:text-red-400",
};

/**
 * Row of KPI stat cards for headline numbers (counts, totals, averages).
 */
export function KpiCards({ metrics }: KpiCardsProps) {
  // Props stream in progressively — metrics may be missing mid-generation
  const items = Array.isArray(metrics) ? metrics.filter((m) => m?.label) : [];
  return (
    <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((metric) => (
        <div
          key={metric.label}
          className="rounded-lg border border-border bg-background p-4"
        >
          <p className="text-xs font-medium uppercase text-muted-foreground">
            {metric.label}
          </p>
          <p
            className={`pt-1 text-2xl font-semibold tabular-nums ${intentClass[metric.intent ?? "neutral"]}`}
          >
            {metric.value}
            {metric.unit && (
              <span className="pl-1 text-sm font-normal text-muted-foreground">
                {metric.unit}
              </span>
            )}
          </p>
          {metric.caption && (
            <p className="pt-1 text-xs text-muted-foreground">
              {metric.caption}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
