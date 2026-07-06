"use client";

import { categoryLabel, statusLabel } from "@/components/workspace/case-visuals";
import {
  caseCategorySchema,
  caseStatusSchema,
  riskLevelSchema,
} from "@/services/case-management";
import { useTamboComponentState } from "@tambo-ai/react";
import { z } from "zod";

export const filterBarSchema = z.object({
  risk: z
    .array(riskLevelSchema)
    .optional()
    .describe("Initially active risk filters"),
  status: z
    .array(caseStatusSchema)
    .optional()
    .describe("Initially active status filters"),
  category: z
    .array(caseCategorySchema)
    .optional()
    .describe("Initially active category filters"),
  overdueOnly: z.boolean().optional(),
});
export type FilterBarProps = z.infer<typeof filterBarSchema>;

interface ActiveFilters {
  risk: string[];
  status: string[];
  category: string[];
  overdueOnly: boolean;
}

function FilterChip({
  label,
  isActive,
  onToggle,
}: {
  label: string;
  isActive: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onToggle}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        isActive
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background text-muted-foreground hover:border-foreground/40"
      }`}
    >
      {label}
    </button>
  );
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((v) => v !== value)
    : [...values, value];
}

/**
 * Filter chip bar for case views. Active filters sync to Tambo state, so the
 * AI can read and update the user's current selection.
 */
export function FilterBar({
  risk,
  status,
  category,
  overdueOnly,
}: FilterBarProps) {
  const initialFilters: ActiveFilters = {
    risk: risk ?? [],
    status: status ?? [],
    category: category ?? [],
    overdueOnly: overdueOnly ?? false,
  };
  const [filters = initialFilters, setFilters] = useTamboComponentState(
    "activeFilters",
    initialFilters,
  );

  const groups = [
    {
      name: "Risk",
      options: riskLevelSchema.options.map((value) => ({
        value,
        label: value,
      })),
      active: filters.risk,
      onToggle: (value: string) =>
        setFilters({ ...filters, risk: toggleValue(filters.risk, value) }),
    },
    {
      name: "Status",
      options: caseStatusSchema.options.map((value) => ({
        value,
        label: statusLabel[value],
      })),
      active: filters.status,
      onToggle: (value: string) =>
        setFilters({ ...filters, status: toggleValue(filters.status, value) }),
    },
    {
      name: "Category",
      options: caseCategorySchema.options.map((value) => ({
        value,
        label: categoryLabel[value],
      })),
      active: filters.category,
      onToggle: (value: string) =>
        setFilters({
          ...filters,
          category: toggleValue(filters.category, value),
        }),
    },
  ];

  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-border bg-background p-4">
      {groups.map((group) => (
        <div key={group.name} className="flex flex-wrap items-center gap-2">
          <span className="w-16 shrink-0 text-xs font-medium uppercase text-muted-foreground">
            {group.name}
          </span>
          {group.options.map((option) => (
            <FilterChip
              key={option.value}
              label={option.label}
              isActive={group.active.includes(option.value)}
              onToggle={() => group.onToggle(option.value)}
            />
          ))}
        </div>
      ))}
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-xs font-medium uppercase text-muted-foreground">
          Due
        </span>
        <FilterChip
          label="Overdue only"
          isActive={filters.overdueOnly}
          onToggle={() =>
            setFilters({ ...filters, overdueOnly: !filters.overdueOnly })
          }
        />
      </div>
    </div>
  );
}
