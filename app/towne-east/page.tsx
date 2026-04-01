"use client";

import { useState, useCallback } from "react";
import { MapPin, Home, Clock, CheckCircle2, AlertCircle, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import RenovationSection from "@/components/RenovationSection";

// ─── TYPES ────────────────────────────────────────────────────────────────────
type Month = "mar" | "feb" | "jan";

interface FinRow {
  label: string;
  actual: number;
  budget: number;
  isSummary?: boolean;
  isExpense?: boolean;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function varStr(v: number): string {
  if (Math.abs(v) < 0.5) return "—";
  return `${v > 0 ? "+" : ""}${fmt(v)}`;
}

function varColor(v: number, isExpense = false): string {
  if (Math.abs(v) < 0.5) return "text-gray-400";
  const good = isExpense ? v < 0 : v > 0;
  return good ? "text-emerald-600" : "text-red-500";
}

function sum(rows: FinRow[]): { actual: number; budget: number } {
  return rows.reduce(
    (acc, r) => ({ actual: acc.actual + r.actual, budget: acc.budget + r.budget }),
    { actual: 0, budget: 0 }
  );
}

// ─── PLACEHOLDER DATA ─────────────────────────────────────────────────────────

const INCOME: Record<Month, FinRow[]> = {
  mar: [
    { label: "Gross Potential Rent",   actual:  89_000, budget:  89_000 },
    { label: "Vacancy Loss",           actual:  -7_120, budget:  -5_340 },
    { label: "Loss to Lease",          actual:  -2_670, budget:  -1_780 },
    { label: "Concessions",            actual:    -890, budget:    -445 },
    { label: "Delinquency",            actual:  -3_560, budget:  -1_780 },
    { label: "Late Fees",              actual:   1_245, budget:   1_000 },
    { label: "Other Income",           actual:   2_100, budget:   1_800 },
  ],
  feb: [
    { label: "Gross Potential Rent",   actual:  89_000, budget:  89_000 },
    { label: "Vacancy Loss",           actual:  -6_230, budget:  -5_340 },
    { label: "Loss to Lease",          actual:  -2_450, budget:  -1_780 },
    { label: "Concessions",            actual:    -500, budget:    -445 },
    { label: "Delinquency",            actual:  -2_890, budget:  -1_780 },
    { label: "Late Fees",              actual:   1_100, budget:   1_000 },
    { label: "Other Income",           actual:   1_950, budget:   1_800 },
  ],
  jan: [
    { label: "Gross Potential Rent",   actual:  89_000, budget:  89_000 },
    { label: "Vacancy Loss",           actual:  -5_340, budget:  -5_340 },
    { label: "Loss to Lease",          actual:  -1_780, budget:  -1_780 },
    { label: "Concessions",            actual:    -445, budget:    -445 },
    { label: "Delinquency",            actual:  -1_780, budget:  -1_780 },
    { label: "Late Fees",              actual:     980, budget:   1_000 },
    { label: "Other Income",           actual:   1_800, budget:   1_800 },
  ],
};

const COLLECTIONS: Record<Month, FinRow[]> = {
  mar: [
    { label: "Total Charged",             actual:  89_000, budget:  89_000 },
    { label: "Total Collected",           actual:  75_900, budget:  80_100 },
    { label: "Prepaid / Credits Applied", actual:   1_200, budget:   1_000 },
    { label: "NSF / Returned Checks",     actual:    -450, budget:    -200 },
  ],
  feb: [
    { label: "Total Charged",             actual:  89_000, budget:  89_000 },
    { label: "Total Collected",           actual:  77_800, budget:  80_100 },
    { label: "Prepaid / Credits Applied", actual:     950, budget:   1_000 },
    { label: "NSF / Returned Checks",     actual:    -300, budget:    -200 },
  ],
  jan: [
    { label: "Total Charged",             actual:  89_000, budget:  89_000 },
    { label: "Total Collected",           actual:  79_500, budget:  80_100 },
    { label: "Prepaid / Credits Applied", actual:   1_000, budget:   1_000 },
    { label: "NSF / Returned Checks",     actual:    -200, budget:    -200 },
  ],
};

const EXPENSES: Record<Month, FinRow[]> = {
  mar: [
    { label: "Management Fee",                actual:  7_100, budget:  7_120 },
    { label: "Repairs & Maintenance",         actual:  8_450, budget:  7_500 },
    { label: "Make Ready / Turnover",         actual:  3_200, budget:  2_800 },
    { label: "Landscaping & Grounds",         actual:  1_100, budget:  1_000 },
    { label: "Pest Control",                  actual:    650, budget:    600 },
    { label: "Insurance",                     actual:  4_200, budget:  4_200 },
    { label: "Property Taxes",                actual:  7_800, budget:  7_800 },
    { label: "Utilities – Water / Sewer",     actual:  3_100, budget:  2_800 },
    { label: "Utilities – Electric (Common)", actual:  1_450, budget:  1_200 },
    { label: "Administrative",                actual:  2_200, budget:  2_000 },
  ],
  feb: [
    { label: "Management Fee",                actual:  7_120, budget:  7_120 },
    { label: "Repairs & Maintenance",         actual:  7_800, budget:  7_500 },
    { label: "Make Ready / Turnover",         actual:  2_500, budget:  2_800 },
    { label: "Landscaping & Grounds",         actual:  1_000, budget:  1_000 },
    { label: "Pest Control",                  actual:    600, budget:    600 },
    { label: "Insurance",                     actual:  4_200, budget:  4_200 },
    { label: "Property Taxes",                actual:  7_800, budget:  7_800 },
    { label: "Utilities – Water / Sewer",     actual:  2_900, budget:  2_800 },
    { label: "Utilities – Electric (Common)", actual:  1_300, budget:  1_200 },
    { label: "Administrative",                actual:  2_050, budget:  2_000 },
  ],
  jan: [
    { label: "Management Fee",                actual:  7_120, budget:  7_120 },
    { label: "Repairs & Maintenance",         actual:  7_500, budget:  7_500 },
    { label: "Make Ready / Turnover",         actual:  2_800, budget:  2_800 },
    { label: "Landscaping & Grounds",         actual:  1_000, budget:  1_000 },
    { label: "Pest Control",                  actual:    600, budget:    600 },
    { label: "Insurance",                     actual:  4_200, budget:  4_200 },
    { label: "Property Taxes",                actual:  7_800, budget:  7_800 },
    { label: "Utilities – Water / Sewer",     actual:  2_800, budget:  2_800 },
    { label: "Utilities – Electric (Common)", actual:  1_200, budget:  1_200 },
    { label: "Administrative",                actual:  2_000, budget:  2_000 },
  ],
};

const BELOW_LINE: Record<Month, FinRow[]> = {
  mar: [
    { label: "Debt Service – Principal & Interest", actual: 18_500, budget: 18_500 },
    { label: "Replacement Reserves",                actual:  2_000, budget:  2_000 },
  ],
  feb: [
    { label: "Debt Service – Principal & Interest", actual: 18_500, budget: 18_500 },
    { label: "Replacement Reserves",                actual:  2_000, budget:  2_000 },
  ],
  jan: [
    { label: "Debt Service – Principal & Interest", actual: 18_500, budget: 18_500 },
    { label: "Replacement Reserves",                actual:  2_000, budget:  2_000 },
  ],
};

// ─── DELINQUENCY DATA ─────────────────────────────────────────────────────────
const DELINQUENCY = [
  { tenant: "Maria Santos",    unit: "114A", balance: 5_820, aging0_30:     0, aging30plus: 5_820, action: "Eviction Filed", notes: "Filed 2/28. Court date 3/22." },
  { tenant: "Linda Tran",      unit: "308B", balance: 3_750, aging0_30:     0, aging30plus: 3_750, action: "Eviction Filed", notes: "Second filing this lease term." },
  { tenant: "James Whitfield", unit: "203B", balance: 3_200, aging0_30: 1_600, aging30plus: 1_600, action: "Payment Plan",   notes: "Paying $400/mo extra since 3/1." },
  { tenant: "Ashley Reyes",    unit: "241C", balance: 2_670, aging0_30:   670, aging30plus: 2_000, action: "Payment Plan",   notes: null },
  { tenant: "Brittany Moore",  unit: "118C", balance: 2_450, aging0_30: 2_450, aging30plus:     0, action: "Notice Sent",    notes: null },
  { tenant: "Kevin Okafor",    unit: "215A", balance: 2_100, aging0_30: 2_100, aging30plus:     0, action: "Notice Sent",    notes: null },
  { tenant: "Darnell Brooks",  unit: "122A", balance: 1_980, aging0_30: 1_980, aging30plus:     0, action: "None",           notes: null },
  { tenant: "Marcus Hill",     unit: "317A", balance: 1_480, aging0_30: 1_480, aging30plus:     0, action: "None",           notes: null },
];

// ─── OCCUPANCY DATA ───────────────────────────────────────────────────────────
const OCCUPANCY: Record<Month, { actual: number; budget: number }> = {
  mar: { actual: 91.0, budget: 93.0 },
  feb: { actual: 92.0, budget: 93.0 },
  jan: { actual: 93.5, budget: 93.0 },
};

// ─── CAPEX DATA ───────────────────────────────────────────────────────────────
const CAPEX_PROJECTS = [
  { item: "Building C Roof Replacement",  budget: 45_000, spent: 38_250, pct: 85,  status: "In Progress" },
  { item: "HVAC Replacements (5 units)",  budget: 18_500, spent: 18_500, pct: 100, status: "Completed"   },
  { item: "Security Camera System",       budget: 12_000, spent: 12_000, pct: 100, status: "Completed"   },
  { item: "Pool Resurfacing & Equipment", budget: 22_000, spent:  3_200, pct: 15,  status: "In Progress" },
  { item: "Parking Lot Seal & Stripe",    budget:  8_500, spent:      0, pct: 0,   status: "On Hold"     },
];

const WORK_ORDERS = [
  { wo: "WO-2001", unit: "114B", cat: "HVAC",       desc: "AC not cooling — possible refrigerant leak", vendor: "6/1 HVAC Services",  cost: 380,   status: "In Progress" },
  { wo: "WO-2002", unit: "228A", cat: "Plumbing",    desc: "Leak under kitchen sink",                   vendor: "SplashPro Plumbing", cost: 175,   status: "Open"        },
  { wo: "WO-2003", unit: "301C", cat: "Electrical",  desc: "GFCI outlet replacement (bathroom)",        vendor: "QuickFix Electric",  cost: 120,   status: "Completed"   },
  { wo: "WO-2004", unit: "105A", cat: "Appliance",   desc: "Dishwasher not draining",                   vendor: "All Pro Appliance",  cost: 250,   status: "Open"        },
  { wo: "WO-2005", unit: "210B", cat: "Make Ready",  desc: "Full unit turn — paint, clean, carpet",     vendor: "In-house",           cost: 1_200, status: "In Progress" },
  { wo: "WO-2006", unit: "317A", cat: "Plumbing",    desc: "Running toilet, slow drain in master bath", vendor: "SplashPro Plumbing", cost: 195,   status: "Open"        },
];

// ─── STATUS HELPERS ───────────────────────────────────────────────────────────
function capexStatusBadge(s: string): string {
  switch (s) {
    case "Completed":   return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "In Progress": return "bg-blue-100 text-blue-800 border-blue-200";
    case "On Hold":     return "bg-gray-100 text-gray-600 border-gray-200";
    default:            return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

function woStatusBadge(s: string): string {
  switch (s) {
    case "Completed":   return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "In Progress": return "bg-amber-100 text-amber-800 border-amber-200";
    case "Open":        return "bg-blue-100 text-blue-800 border-blue-200";
    default:            return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────
function FinRowComponent({ row, isExpense }: { row: FinRow; isExpense?: boolean }) {
  const variance = row.actual - row.budget;
  if (row.isSummary) {
    return (
      <tr className="bg-gray-50 border-t-2 border-gray-300">
        <td className="px-4 py-2.5 text-sm font-bold text-gray-900">{row.label}</td>
        <td className="px-4 py-2.5 text-sm text-right font-bold text-gray-700">{fmt(row.budget)}</td>
        <td className="px-4 py-2.5 text-sm text-right font-bold text-gray-900">{fmt(row.actual)}</td>
        <td className={cn("px-4 py-2.5 text-sm text-right font-bold", varColor(variance, isExpense))}>
          {varStr(variance)}
        </td>
      </tr>
    );
  }
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50/60">
      <td className="px-4 py-2 pl-8 text-sm text-gray-700">{row.label}</td>
      <td className="px-4 py-2 text-sm text-right text-gray-500">{fmt(row.budget)}</td>
      <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">{fmt(row.actual)}</td>
      <td className={cn("px-4 py-2 text-sm text-right font-medium", varColor(variance, isExpense))}>
        {varStr(variance)}
      </td>
    </tr>
  );
}

function SectionHeader({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <tr className={cn("border-t-2 border-gray-200", colorClass)}>
      <td colSpan={4} className="px-4 py-2 text-xs font-bold uppercase tracking-wider">
        {label}
      </td>
    </tr>
  );
}

function SummaryRow({ label, actual, budget }: { label: string; actual: number; budget: number }) {
  const variance = actual - budget;
  const color = actual >= 0 ? "text-emerald-700" : "text-red-600";
  return (
    <tr className="bg-gray-800 border-t-2 border-gray-400">
      <td className="px-4 py-3 text-sm font-bold text-white">{label}</td>
      <td className="px-4 py-3 text-sm text-right font-bold text-gray-300">{fmt(budget)}</td>
      <td className={cn("px-4 py-3 text-sm text-right font-bold", color)}>{fmt(actual)}</td>
      <td className={cn("px-4 py-3 text-sm text-right font-bold", varColor(variance, false))}>
        {varStr(variance)}
      </td>
    </tr>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function TowneEastPage() {
  const [month, setMonth] = useState<Month>("mar");

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const income      = INCOME[month];
  const collections = COLLECTIONS[month];
  const expenses    = EXPENSES[month];
  const belowLine   = BELOW_LINE[month];

  const incomeSum      = sum(income);
  const collectionsSum = sum(collections);
  const expensesSum    = sum(expenses);
  const belowLineSum   = sum(belowLine);

  const egi            = { actual: incomeSum.actual,      budget: incomeSum.budget };
  const noi            = { actual: egi.actual - expensesSum.actual, budget: egi.budget - expensesSum.budget };
  const ncf            = { actual: noi.actual - belowLineSum.actual, budget: noi.budget - belowLineSum.budget };
  const netCollections = { actual: collectionsSum.actual, budget: collectionsSum.budget };

  const occupancy       = OCCUPANCY[month];
  const gpr             = 89_000;
  const delinqItem      = income.find((r) => r.label === "Delinquency");
  const delinqActualPct = delinqItem ? (Math.abs(delinqItem.actual)  / gpr) * 100 : 0;
  const delinqBudgetPct = delinqItem ? (Math.abs(delinqItem.budget) / gpr) * 100 : 0;

  const debtServiceActual = belowLine
    .filter((r) => r.label.toLowerCase().includes("debt service"))
    .reduce((s, r) => s + r.actual, 0);
  const dscr         = debtServiceActual > 0 ? noi.actual / debtServiceActual : null;
  const expenseRatio = egi.actual > 0 ? (expensesSum.actual / egi.actual) * 100 : null;

  const totalDelinquent  = DELINQUENCY.reduce((s, d) => s + d.balance, 0);
  const total30plus      = DELINQUENCY.reduce((s, d) => s + d.aging30plus, 0);
  const totalCapexBudget = CAPEX_PROJECTS.reduce((s, p) => s + p.budget, 0);
  const totalCapexSpent  = CAPEX_PROJECTS.reduce((s, p) => s + p.spent, 0);
  const openWOs          = WORK_ORDERS.filter((w) => w.status !== "Completed").length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── STICKY HEADER ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3 pt-4 pb-2">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">Towne East Village</h1>
                <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs px-2.5 py-0.5">
                  Active
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-1 text-xs text-gray-500">
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />Converse, TX</span>
                <span className="flex items-center gap-1"><Home className="h-3.5 w-3.5" />100 units</span>
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Updated Mar 18, 2025 9:30 AM</span>
              </div>
            </div>
          </div>
          <nav className="flex gap-0 -mb-px overflow-x-auto">
            {(["Financials", "Delinquency", "Renovations", "CapEx"] as const).map((label) => (
              <button
                key={label}
                onClick={() => scrollTo(label.toLowerCase())}
                className="px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-blue-600 border-b-2 border-transparent hover:border-blue-500 whitespace-nowrap transition-colors"
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* ── PAGE CONTENT ───────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-14">

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 1 · FINANCIALS
        ══════════════════════════════════════════════════════════════════ */}
        <section id="financials" className="scroll-mt-28">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Financials — Actuals vs. Budget</h2>

          <div className="flex gap-1 border-b border-gray-200 mb-5">
            {(["mar", "feb", "jan"] as Month[]).map((m) => {
              const labels: Record<Month, string> = { mar: "Mar 2025", feb: "Feb 2025", jan: "Jan 2025" };
              return (
                <button
                  key={m}
                  onClick={() => setMonth(m)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                    month === m
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  )}
                >
                  {labels[m]}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
            <Card className="border-gray-200">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Occupancy</p>
                <p className={cn("text-2xl font-bold mt-1", occupancy.actual >= occupancy.budget ? "text-emerald-600" : "text-amber-600")}>
                  {occupancy.actual.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-400 mt-1.5">Bgt {occupancy.budget.toFixed(1)}%</p>
                <p className={cn("text-xs font-semibold mt-0.5", (occupancy.actual - occupancy.budget) >= 0 ? "text-emerald-600" : "text-red-500")}>
                  {(occupancy.actual - occupancy.budget) >= 0 ? "+" : ""}{(occupancy.actual - occupancy.budget).toFixed(1)}pp
                </p>
              </CardContent>
            </Card>

            <Card className="border-gray-200">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">NOI</p>
                <p className={cn("text-2xl font-bold mt-1", noi.actual >= 0 ? "text-gray-900" : "text-red-600")}>
                  {fmt(noi.actual)}
                </p>
                <p className="text-xs text-gray-400 mt-1.5">Bgt {fmt(noi.budget)}</p>
                <p className={cn("text-xs font-semibold mt-0.5", varColor(noi.actual - noi.budget, false))}>
                  {varStr(noi.actual - noi.budget)}
                </p>
              </CardContent>
            </Card>

            <Card className="border-gray-200">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Delinquency %</p>
                <p className={cn("text-2xl font-bold mt-1", delinqActualPct <= delinqBudgetPct ? "text-emerald-600" : "text-red-600")}>
                  {delinqActualPct.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-400 mt-1.5">Bgt {delinqBudgetPct.toFixed(1)}%</p>
                <p className={cn("text-xs font-semibold mt-0.5", (delinqActualPct - delinqBudgetPct) <= 0 ? "text-emerald-600" : "text-red-500")}>
                  {(delinqActualPct - delinqBudgetPct) >= 0 ? "+" : ""}{(delinqActualPct - delinqBudgetPct).toFixed(1)}pp
                </p>
              </CardContent>
            </Card>

            <Card className="border-gray-200">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Expense Ratio</p>
                <p className={cn("text-2xl font-bold mt-1",
                  expenseRatio == null ? "text-gray-400" : expenseRatio < 50 ? "text-emerald-600" : "text-red-600"
                )}>
                  {expenseRatio != null ? `${expenseRatio.toFixed(1)}%` : "—"}
                </p>
                <p className="text-xs text-gray-400 mt-1.5">Oper. Expenses / EGI</p>
              </CardContent>
            </Card>

            <Card className="border-gray-200">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">DSCR</p>
                <p className={cn("text-2xl font-bold mt-1",
                  dscr == null ? "text-gray-400" : dscr >= 1.25 ? "text-emerald-600" : dscr >= 1.0 ? "text-amber-600" : "text-red-600"
                )}>
                  {dscr != null ? `${dscr.toFixed(2)}x` : "—"}
                </p>
                <p className="text-xs text-gray-400 mt-1.5">NOI / Debt Service</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-gray-200">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {["Line Item", "Budget", "Actual", "Variance"].map((h) => (
                        <th key={h} className={cn("px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide", h === "Line Item" ? "text-left" : "text-right")}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <SectionHeader label="Income" colorClass="bg-blue-50/70 text-blue-700" />
                    {income.map((r) => <FinRowComponent key={r.label} row={r} />)}
                    <FinRowComponent row={{ label: "Total Effective Gross Income", actual: egi.actual, budget: egi.budget, isSummary: true }} />

                    <SectionHeader label="Collections" colorClass="bg-teal-50/60 text-teal-700" />
                    {collections.map((r) => <FinRowComponent key={r.label} row={r} />)}
                    <FinRowComponent row={{ label: "Net Collections", actual: netCollections.actual, budget: netCollections.budget, isSummary: true }} />

                    <SectionHeader label="Operating Expenses" colorClass="bg-amber-50/60 text-amber-700" />
                    {expenses.map((r) => <FinRowComponent key={r.label} row={r} isExpense />)}
                    <FinRowComponent row={{ label: "Total Operating Expenses", actual: expensesSum.actual, budget: expensesSum.budget, isSummary: true }} isExpense />

                    <SummaryRow label="Net Operating Income (NOI)" actual={noi.actual} budget={noi.budget} />

                    <SectionHeader label="Below the Line" colorClass="bg-slate-50/60 text-slate-600" />
                    {belowLine.map((r) => <FinRowComponent key={r.label} row={r} isExpense />)}
                    <FinRowComponent row={{ label: "Total Below the Line", actual: belowLineSum.actual, budget: belowLineSum.budget, isSummary: true }} isExpense />

                    <SummaryRow label="Net Cash Flow" actual={ncf.actual} budget={ncf.budget} />
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 2 · DELINQUENCY
        ══════════════════════════════════════════════════════════════════ */}
        <section id="delinquency" className="scroll-mt-28">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Delinquency</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: "Total Delinquent",  value: fmt(totalDelinquent),                                    color: "text-red-600" },
              { label: "Delinquent Units",  value: `${DELINQUENCY.length} / 100`,                           color: "text-red-600" },
              { label: "30+ Days Past Due", value: fmt(total30plus),                                        color: "text-red-700" },
              { label: "Delinquency Rate",  value: `${((totalDelinquent / 89_000) * 100).toFixed(1)}%`,     color: "text-red-600" },
            ].map(({ label, value, color }) => (
              <Card key={label} className="border-red-100 bg-red-50/40">
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs font-medium text-red-500">{label}</p>
                  <p className={cn("text-xl font-bold mt-0.5", color)}>{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-gray-200">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {["Tenant", "Unit", "Balance", "0–30 Days", "30+ Days", "Action Status"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {DELINQUENCY.map((d) => (
                      <>
                        <tr key={d.unit} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900">{d.tenant}</td>
                          <td className="px-4 py-3 text-gray-600 font-mono text-xs">{d.unit}</td>
                          <td className="px-4 py-3 font-bold text-red-600">{fmt(d.balance)}</td>
                          <td className="px-4 py-3 text-gray-600">{d.aging0_30 > 0 ? fmt(d.aging0_30) : <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3">{d.aging30plus > 0 ? <span className="font-semibold text-red-600">{fmt(d.aging30plus)}</span> : <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3">
                            <Badge className={cn("text-xs border", {
                              "bg-red-100 text-red-800 border-red-200":       d.action === "Eviction Filed",
                              "bg-amber-100 text-amber-800 border-amber-200": d.action === "Payment Plan",
                              "bg-blue-100 text-blue-800 border-blue-200":    d.action === "Notice Sent",
                              "bg-gray-100 text-gray-600 border-gray-200":    d.action === "None",
                            })}>
                              {d.action}
                            </Badge>
                          </td>
                        </tr>
                        {d.notes && (
                          <tr key={`${d.unit}-notes`} className="bg-amber-50/40">
                            <td /><td colSpan={5} className="px-4 py-1.5 text-xs text-gray-500 italic">{d.notes}</td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td colSpan={2} className="px-4 py-2.5 text-xs font-bold text-gray-600 uppercase">Total</td>
                      <td className="px-4 py-2.5 font-bold text-red-700">{fmt(totalDelinquent)}</td>
                      <td className="px-4 py-2.5 font-bold text-gray-700">{fmt(DELINQUENCY.reduce((s, d) => s + d.aging0_30, 0))}</td>
                      <td className="px-4 py-2.5 font-bold text-red-700">{fmt(total30plus)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 3 · RENOVATIONS — LIVE FROM GOOGLE SHEETS
        ══════════════════════════════════════════════════════════════════ */}
        <section id="renovations" className="scroll-mt-28">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Renovations</h2>
          <RenovationSection />
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 4 · CAPEX
        ══════════════════════════════════════════════════════════════════ */}
        <section id="capex" className="scroll-mt-28 pb-16">
          <h2 className="text-lg font-bold text-gray-900 mb-4">CapEx</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: "CapEx Budget",     value: fmt(totalCapexBudget),                color: "text-gray-900" },
              { label: "CapEx Spent",      value: fmt(totalCapexSpent),                 color: totalCapexSpent > totalCapexBudget ? "text-red-600" : "text-gray-900" },
              { label: "Remaining",        value: fmt(totalCapexBudget - totalCapexSpent), color: "text-blue-700" },
              { label: "Open Work Orders", value: `${openWOs} open`,                    color: openWOs > 3 ? "text-amber-600" : "text-gray-900" },
            ].map(({ label, value, color }) => (
              <Card key={label} className="border-gray-200">
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs font-medium text-gray-500">{label}</p>
                  <p className={cn("text-xl font-bold mt-0.5", color)}>{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-gray-200 mb-5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Capital Projects</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {CAPEX_PROJECTS.map((p) => (
                <div key={p.item}>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{p.item}</span>
                      <Badge className={cn("text-xs border", capexStatusBadge(p.status))}>{p.status}</Badge>
                    </div>
                    <span className="text-xs text-gray-500">{fmt(p.spent)} / {fmt(p.budget)} · {p.pct}%</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", {
                        "bg-emerald-500": p.pct >= 100,
                        "bg-blue-500":    p.pct >= 50 && p.pct < 100,
                        "bg-amber-500":   p.pct >= 20 && p.pct < 50,
                        "bg-gray-300":    p.pct < 20,
                      })}
                      style={{ width: `${Math.min(100, p.pct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-gray-200">
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700">Work Orders</CardTitle>
                <span className="text-xs text-gray-400">{openWOs} open</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {["WO #", "Unit", "Category", "Description", "Vendor", "Est. Cost", "Status"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {WORK_ORDERS.map((wo) => (
                      <tr key={wo.wo} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{wo.wo}</td>
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold text-gray-800">{wo.unit}</td>
                        <td className="px-4 py-2.5 text-gray-600">{wo.cat}</td>
                        <td className="px-4 py-2.5 text-gray-800 max-w-[220px] truncate">{wo.desc}</td>
                        <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{wo.vendor}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{fmt(wo.cost)}</td>
                        <td className="px-4 py-2.5">
                          <Badge className={cn("text-xs border", woStatusBadge(wo.status))}>{wo.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
