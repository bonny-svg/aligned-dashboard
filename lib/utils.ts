import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { FinancialLineItem } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function occupancyColor(pct: number): string {
  if (pct >= 93) return "text-green-600";
  if (pct >= 85) return "text-amber-600";
  return "text-red-600";
}

export function occupancyBg(pct: number): string {
  if (pct >= 93) return "bg-green-100 text-green-800 border-green-200";
  if (pct >= 85) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-red-100 text-red-800 border-red-200";
}

export function varianceColor(value: number, invert = false): string {
  const good = invert ? value > 0 : value < 0;
  if (Math.abs(value) < 0.5) return "text-gray-600";
  return good ? "text-green-600" : "text-red-600";
}

export function statusColor(status: string): string {
  switch (status) {
    case "Active":
      return "bg-green-100 text-green-800 border-green-200";
    case "Stabilizing":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "Under Contract":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "Remediation":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

export function agingColor(bucket: string): string {
  switch (bucket) {
    case "0-30": return "bg-yellow-100 text-yellow-800";
    case "31-60": return "bg-orange-100 text-orange-800";
    case "61-90": return "bg-red-100 text-red-800";
    case "90+": return "bg-red-200 text-red-900 font-bold";
    default: return "";
  }
}

export function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => JSON.stringify(row[h] ?? "")).join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function isLeaseExpiringSoon(leaseEnd: string, days: number): boolean {
  if (!leaseEnd) return false;
  const end = new Date(leaseEnd);
  const now = new Date();
  const diff = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
}

// ─── Financial summary helper ─────────────────────────────────────────────────

export interface PropertyFinancials {
  noi: number;
  cashFlow: number;
  month: string | null;
}

/**
 * Compute NOI and Net Cash Flow for a property from its most recent month of
 * income statement data.
 *   NOI       = Income − Expenses
 *   Cash Flow = NOI − CapEx − Debt Service − Professional Fees
 */
export function computePropertyFinancials(
  financials: FinancialLineItem[],
  propertyId: string
): PropertyFinancials {
  const propFins = financials.filter((f) => f.propertyId === propertyId);
  const latestMonth =
    propFins
      .filter((f) => f.category === "Income" && f.actual > 0)
      .map((f) => f.month)
      .sort()
      .pop() ?? null;

  if (!latestMonth) return { noi: 0, cashFlow: 0, month: null };

  const items = propFins.filter((f) => f.month === latestMonth);
  const sum = (cat: string) =>
    items.filter((f) => f.category === cat).reduce((s, f) => s + f.actual, 0);

  // Use stored NOI when available (Resman provides it directly)
  const noiItem  = items.find((f) => f.isNOI);
  const noi      = noiItem ? noiItem.actual : sum("Income") - sum("Expenses");

  // Use stored Net Income when available (Resman's Net Income = Cash Flow)
  const netItem  = items.find((f) => f.isNetCashFlow);
  const cashFlow = netItem
    ? netItem.actual
    : noi - sum("CapEx") - sum("Debt Service") - sum("Professional Fees");

  return { noi, cashFlow, month: latestMonth };
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
