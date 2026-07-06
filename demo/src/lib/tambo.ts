/**
 * @file tambo.ts
 * @description Central configuration file for Tambo components and tools
 *
 * This file serves as the central place to register your Tambo components and tools.
 * It exports arrays that will be used by the TamboProvider.
 *
 * Read more about Tambo at https://tambo.co/docs
 */

import { Graph, graphSchema } from "@/components/tambo/graph";
import { CaseQueue, caseQueueSchema } from "@/components/workspace/case-queue";
import {
  CasesTable,
  casesTableSchema,
} from "@/components/workspace/cases-table";
import { FilterBar, filterBarSchema } from "@/components/workspace/filter-bar";
import {
  GroupedBoard,
  groupedBoardSchema,
} from "@/components/workspace/grouped-board";
import { KpiCards, kpiCardsSchema } from "@/components/workspace/kpi-cards";
import {
  aggregateCases,
  aggregateCasesInputSchema,
  aggregateCasesOutputSchema,
  analystSchema,
  listAnalysts,
  searchCases,
  searchCasesInputSchema,
  searchCasesOutputSchema,
} from "@/services/case-management";
import type { TamboComponent } from "@tambo-ai/react";
import { TamboTool } from "@tambo-ai/react";
import { z } from "zod";

/**
 * tools
 *
 * This array contains all the Tambo tools that are registered for use within the application.
 * Each tool is defined with its name, description, and expected props. The tools
 * can be controlled by AI to dynamically fetch data based on user interactions.
 */

export const tools: TamboTool[] = [
  {
    name: "searchCases",
    description:
      "Search and filter compliance cases (fraud, AML, KYC, sanctions, chargeback). Supports free-text search, filtering by risk level, status, category, analyst, due-date range, and overdue-only, plus sorting and a result limit. Use this to fetch the rows behind any case list, queue, or table.",
    tool: searchCases,
    inputSchema: searchCasesInputSchema,
    outputSchema: searchCasesOutputSchema,
  },
  {
    name: "aggregateCases",
    description:
      "Group compliance cases by analyst, risk, status, or category and compute a metric per group (count, total USD exposure, or average risk score). Accepts the same filter as searchCases. Use this for charts, KPIs, and grouped summaries.",
    tool: aggregateCases,
    inputSchema: aggregateCasesInputSchema,
    outputSchema: aggregateCasesOutputSchema,
  },
  {
    name: "listAnalysts",
    description:
      "List all case analysts with their team, specialty, and current open-case load. Use this to resolve analyst names or show workload distribution.",
    tool: listAnalysts,
    inputSchema: z.object({}),
    outputSchema: z.array(analystSchema),
  },
  // Add more tools here
];

/**
 * components
 *
 * This array contains all the Tambo components that are registered for use within the application.
 * Each component is defined with its name, description, and expected props. The components
 * can be controlled by AI to dynamically render UI elements based on user interactions.
 */
export const components: TamboComponent[] = [
  {
    name: "CasesTable",
    description:
      "A sortable table of compliance cases with risk badges, status, and overdue highlighting. Use when the user asks to see, list, or review individual cases in detail. Fetch rows with the searchCases tool first and pass them via the cases prop. Rows are selectable.",
    component: CasesTable,
    propsSchema: casesTableSchema,
  },
  {
    name: "KpiCards",
    description:
      "A row of KPI stat cards for headline numbers — counts, totals, averages (e.g. 'overdue cases', 'total exposure'). Use for summaries and 'how many / how much' questions. Compute values with searchCases totals or aggregateCases, then pass one metric per card.",
    component: KpiCards,
    propsSchema: kpiCardsSchema,
  },
  {
    name: "CaseQueue",
    description:
      "A prioritized to-work list of cases with checkboxes to mark items done. Use when the user asks what to work on, wants a task list, or a triage queue. Pass cases pre-sorted by priority (e.g. riskScore desc or dueDate asc) from searchCases.",
    component: CaseQueue,
    propsSchema: caseQueueSchema,
  },
  {
    name: "FilterBar",
    description:
      "An interactive filter chip bar for risk, status, category, and overdue-only. Use alongside case views when the user wants to narrow or slice cases, or asks for a filterable view. Set the initially-active filters from the user's request; the user's later selections sync to component state.",
    component: FilterBar,
    propsSchema: filterBarSchema,
  },
  {
    name: "GroupedBoard",
    description:
      "A kanban-style board with one column per group (by analyst, risk, status, or category) and case cards inside. Use when the user says 'grouped by', 'per analyst', 'broken down by', or wants a board/lane view. Pass raw cases from searchCases plus the groupBy field; grouping happens in the component.",
    component: GroupedBoard,
    propsSchema: groupedBoardSchema,
  },
  {
    name: "Graph",
    description:
      "A chart (bar, line, or pie) rendered with Recharts. Use for distributions, comparisons, and trends — e.g. cases per analyst or exposure by category. Compute the numbers with the aggregateCases tool, then map its rows to chart labels and datasets.",
    component: Graph,
    propsSchema: graphSchema,
  },
  // Add more components here
];
