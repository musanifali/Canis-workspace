"use client";

import {
  formatUsd,
  isOverdue,
  riskBadgeClass,
  statusLabel,
} from "@/components/workspace/case-visuals";
import { caseSchema } from "@/services/case-management";
import { useTamboComponentState } from "@tambo-ai/react";
import { z } from "zod";

export const casesTableSchema = z.object({
  title: z.string().optional().describe("Heading shown above the table"),
  cases: z.array(caseSchema).describe("Rows, typically from searchCases"),
  columns: z
    .array(
      z.enum([
        "id",
        "title",
        "customer",
        "risk",
        "status",
        "analyst",
        "dueDate",
        "amountUsd",
      ]),
    )
    .optional()
    .describe("Columns to show, in order. Defaults to a sensible set."),
});
export type CasesTableProps = z.infer<typeof casesTableSchema>;

const DEFAULT_COLUMNS: NonNullable<CasesTableProps["columns"]> = [
  "id",
  "title",
  "risk",
  "status",
  "analyst",
  "dueDate",
];

const COLUMN_HEADINGS: Record<string, string> = {
  id: "Case",
  title: "Title",
  customer: "Customer",
  risk: "Risk",
  status: "Status",
  analyst: "Analyst",
  dueDate: "Due",
  amountUsd: "Exposure",
};

function CellValue({
  column,
  row,
}: {
  column: NonNullable<CasesTableProps["columns"]>[number];
  row: CasesTableProps["cases"][number];
}) {
  switch (column) {
    case "risk":
      return (
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${riskBadgeClass[row.risk]}`}
        >
          {row.risk}
        </span>
      );
    case "status":
      return <span>{statusLabel[row.status]}</span>;
    case "dueDate":
      return (
        <span className={isOverdue(row) ? "text-red-600 font-medium" : ""}>
          {row.dueDate}
        </span>
      );
    case "amountUsd":
      return <span className="tabular-nums">{formatUsd(row.amountUsd)}</span>;
    default:
      return <span>{row[column]}</span>;
  }
}

/**
 * Sortable case table with a selectable row (selection syncs to Tambo state).
 */
export function CasesTable({ title, cases, columns }: CasesTableProps) {
  // Props stream in progressively — cases may be missing mid-generation
  const rows = Array.isArray(cases) ? cases.filter((c) => c?.id) : [];
  const [selectedCaseId, setSelectedCaseId] = useTamboComponentState<
    string | null
  >("selectedCaseId", null);
  const visibleColumns = Array.isArray(columns) && columns.length > 0 ? columns : DEFAULT_COLUMNS;

  return (
    <div className="w-full rounded-lg border border-border bg-background p-4">
      {title && <h3 className="pb-3 text-sm font-semibold">{title}</h3>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="w-8 px-2 py-2">
                <span className="sr-only">Select</span>
              </th>
              {visibleColumns.map((column) => (
                <th key={column} className="px-2 py-2 font-medium">
                  {COLUMN_HEADINGS[column]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={`border-b border-border/50 hover:bg-muted/60 ${
                  selectedCaseId === row.id ? "bg-muted" : ""
                }`}
              >
                <td className="px-2 py-2">
                  <input
                    type="radio"
                    name="selected-case"
                    checked={selectedCaseId === row.id}
                    onChange={() => setSelectedCaseId(row.id)}
                    onClick={() => {
                      if (selectedCaseId === row.id) setSelectedCaseId(null);
                    }}
                    aria-label={`Select ${row.id}`}
                    className="size-3.5 accent-foreground"
                  />
                </td>
                {visibleColumns.map((column) => (
                  <td key={column} className="px-2 py-2">
                    <CellValue column={column} row={row} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No cases match.
        </p>
      )}
    </div>
  );
}
