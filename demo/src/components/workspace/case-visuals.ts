/**
 * Shared visual helpers for the workspace case blocks.
 */
import { todayIso, type Case } from "@/services/case-management";

export const riskBadgeClass: Record<Case["risk"], string> = {
  low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export const statusLabel: Record<Case["status"], string> = {
  open: "Open",
  in_review: "In Review",
  escalated: "Escalated",
  resolved: "Resolved",
  closed: "Closed",
};

export const categoryLabel: Record<Case["category"], string> = {
  fraud: "Fraud",
  aml: "AML",
  kyc: "KYC",
  sanctions: "Sanctions",
  chargeback: "Chargeback",
};

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function isOverdue(c: Pick<Case, "dueDate" | "status">): boolean {
  return (
    c.dueDate < todayIso() &&
    c.status !== "resolved" &&
    c.status !== "closed"
  );
}
