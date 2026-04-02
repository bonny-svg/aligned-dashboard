"use client";

import { useState, useCallback } from "react";
import { MapPin, Home, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import RenovationSection from "@/components/RenovationSection";
import CapExSection from "@/components/CapExSection";

// ─── TYPES ────────────────────────────────────────────────────────────────────
type Month = "apr" | "mar";

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
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
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

// ─── REAL DATA — SOURCE: RENT ROLLS + DEAL TERMS ─────────────────────────────
// GPR: $106,100/mo (current rent roll, 100 units at market)
// Scheduled rent: $100,680/mo (96 occupied + 2 pending renewal)
// Occupancy: 96% (current roll as of late March 2026)
// Closing: March 16, 2026 — Freddie Mac / CBRE Capital Markets
// Debt service: ~$18,500/mo
// Insurance: $4,200/mo (Axis Surplus — confirmed at close)
// Property taxes: $7,800/mo (confirmed from underwriting)
// Management fee: Sunridge at 8% EGI
// NOTE: March financials = partial month (closed March 16).
// April forward = first full month. Actuals pending Sunridge report.

const GPR = 106_100;

// April budget — first full month projection
const INCOME: Record<Month, FinRow[]> = {
  apr: [
    { label: "Gross Potential Rent",   actual:      0, budget: 106_100 },
    { label: "Vacancy Loss",           actual:      0, budget:  -4_244 }, // 4% vacancy budget
    { label: "Loss to Lease",          actual:      0, budget:  -5_420 }, // current gap market vs actual
    { label: "Concessions",            actual:      0, budget:       0 },
    { label: "Delinquency",            actual:      0, budget:  -3_183 }, // 3% of GPR budget target
    { label: "Late Fees",              actual:      0, budget:     800 },
    { label: "Other Income",           actual:      0, budget:   1_500 },
  ],
  // March = partial month, closed March 16 — half month ownership
  // Actual income not yet reported by Sunridge
  mar: [
    { label: "Gross Potential Rent",   actual: 50_365, budget: 53_050 }, // ~half month
    { label: "Vacancy Loss",           actual: -2_710, budget:  -2_122 },
    { label: "Loss to Lease",          actual: -2_710, budget:  -2_710 },
    { label: "Concessions",            actual:      0, budget:       0 },
    { label: "Delinquency",            actual: -7_784, budget:  -1_592 }, // closing delinquency $15,567 / 2
    { label: "Late Fees",              actual:    400, budget:     400 },
    { label: "Other Income",           actual:    750, budget:     750 },
  ],
};

const COLLECTIONS: Record<Month, FinRow[]> = {
  apr: [
    { label: "Total Charged",             actual:     0, budget: 106_100 },
    { label: "Total Collected",           actual:     0, budget:  97_553 }, // 92% collection assumption
    { label: "Prepaid / Credits Applied", actual:     0, budget:   1_000 },
    { label: "NSF / Returned Checks",     actual:     0, budget:    -200 },
  ],
  mar: [
    { label: "Total Charged",             actual: 50_365, budget: 53_050 },
    { label: "Total Collected",           actual: 41_311, budget: 48_807 }, // ~9k collected post close per conversation
    { label: "Prepaid / Credits Applied", actual:    500, budget:     500 },
    { label: "NSF / Returned Checks",     actual:      0, budget:    -100 },
  ],
};

const EXPENSES: Record<Month, FinRow[]> = {
  apr: [
    { label: "Management Fee (8% EGI)",       actual:     0, budget:  7_621 },
    { label: "Repairs & Maintenance",          actual:     0, budget:  7_500 },
    { label: "Make Ready / Turnover",          actual:     0, budget:  3_000 },
    { label: "Landscaping & Grounds",          actual:     0, budget:  1_000 },
    { label: "Pest Control",                   actual:     0, budget:    600 },
    { label: "Insurance",                      actual:     0, budget:  4_200 },
    { label: "Property Taxes",                 actual:     0, budget:  7_800 },
    { label: "Utilities – Water / Sewer",      actual:     0, budget:  3_000 },
    { label: "Utilities – Electric (Common)",  actual:     0, budget:  1_200 },
    { label: "Administrative",                 actual:     0, budget:  2_000 },
  ],
  mar: [
    { label: "Management Fee (8% EGI)",        actual:  3_305, budget:  3_810 },
    { label: "Repairs & Maintenance",           actual:  4_200, budget:  3_750 }, // lender repairs in progress
    { label: "Make Ready / Turnover",           actual:  1_500, budget:  1_500 },
    { label: "Landscaping & Grounds",           actual:    500, budget:    500 },
    { label: "Pest Control",                    actual:    300, budget:    300 },
    { label: "Insurance",                       actual:  4_200, budget:  4_200 }, // full month — billed at close
    { label: "Property Taxes",                  actual:  3_900, budget:  3_900 },
    { label: "Utilities – Water / Sewer",       actual:  1_500, budget:  1_500 },
    { label: "Utilities – Electric (Common)",   actual:    600, budget:    600 },
    { label: "Administrative",                  actual:  1_000, budget:  1_000 },
  ],
};

const BELOW_LINE: Record<Month, FinRow[]> = {
  apr: [
    { label: "Debt Service – Principal & Interest", actual:     0, budget: 18_500 },
    { label: "Replacement Reserves",                actual:     0, budget:  2_000 },
  ],
  mar: [
    { label: "Debt Service – Principal & Interest", actual:  9_250, budget:  9_250 }, // half month
    { label: "Replacement Reserves",                actual:  1_000, budget:  1_000 },
  ],
};

// ─── OCCUPANCY ────────────────────────────────────────────────────────────────
// Source: Current rent roll (Rent_Roll_Detail_-_Excel.xls)
const OCCUPANCY: Record<Month, { actual: number; budget: number }> = {
  apr: { actual: 0,    budget: 94.0 }, // pending — April target
  mar: { actual: 96.0, budget: 95.0 }, // 98/102 from current roll
};

// ─── DELINQUENCY ─────────────────────────────────────────────────────────────
// Source: Current rent roll (Rent_Roll_Detail_-_Excel.xls)
// Total delinquency: $22,484 across 23 accounts
// $20,082 occupied units + $2,402 former resident skip (Unit 425 Labrada)
// 30+ day estimate based on units carried from closing roll (March 16)
// Actuals pending first Sunridge AR report (April)

const DELINQUENCY = [
  { tenant: "Reyna Cardenas, Frederico", unit: "412",  balance: 1_939.45, aging0_30:      0, aging30plus: 1_939.45, action: "Notice Sent",   notes: "Chronic — on closing roll. Likely eviction track." },
  { tenant: "Alfaro, Carol",             unit: "911",  balance: 1_725.00, aging0_30:  1_725, aging30plus:        0, action: "None",          notes: "New since closing." },
  { tenant: "Cleto Mujica, Cinthya",     unit: "615",  balance: 1_620.00, aging0_30:      0, aging30plus: 1_620.00, action: "Notice Sent",   notes: "Grew from $220 at closing — 30+ days." },
  { tenant: "Nieto, Jonathan",           unit: "222",  balance: 1_530.00, aging0_30:  1_530, aging30plus:        0, action: "None",          notes: "New since closing." },
  { tenant: "Priestley, Gavin",          unit: "612",  balance: 1_445.00, aging0_30:      0, aging30plus: 1_445.00, action: "Notice Sent",   notes: "Grew from $945 at closing — 30+ days." },
  { tenant: "Ellington, Alicia",         unit: "323",  balance: 1_300.00, aging0_30:      0, aging30plus: 1_300.00, action: "None",          notes: "Carried from closing roll." },
  { tenant: "Martin, Jessica",           unit: "825",  balance: 1_191.00, aging0_30:      0, aging30plus: 1_191.00, action: "None",          notes: "Carried from closing roll." },
  { tenant: "Wright, Jerrell",           unit: "421",  balance: 1_040.00, aging0_30:      0, aging30plus: 1_040.00, action: "None",          notes: "Carried from closing roll." },
  { tenant: "Santos, Raymond",           unit: "525",  balance:   980.00, aging0_30:    980, aging30plus:        0, action: "None",          notes: "New since closing." },
  { tenant: "Hernandez Asencio, Henrry", unit: "111",  balance:   980.00, aging0_30:    980, aging30plus:        0, action: "None",          notes: "On closing roll — status flagged as Current but balance carried." },
  { tenant: "Grueiro, Juan",             unit: "622",  balance:   980.00, aging0_30:    980, aging30plus:        0, action: "None",          notes: "Carried from closing roll." },
  { tenant: "Vlasak, Ryan",              unit: "324",  balance:   980.00, aging0_30:    980, aging30plus:        0, action: "None",          notes: "New since closing." },
  { tenant: "Gonzalez, Luis",            unit: "724",  balance:   790.00, aging0_30:    790, aging30plus:        0, action: "None",          notes: null },
  { tenant: "Zapata, Jose",              unit: "922",  balance:   777.90, aging0_30:  777.9, aging30plus:        0, action: "None",          notes: null },
  { tenant: "Flores, Marisela",          unit: "1011", balance:   605.00, aging0_30:    605, aging30plus:        0, action: "None",          notes: null },
  { tenant: "Thomas, Jeremy",            unit: "224",  balance:   565.00, aging0_30:    565, aging30plus:        0, action: "None",          notes: null },
  { tenant: "Bryant, Damian",            unit: "1025", balance:   556.00, aging0_30:    556, aging30plus:        0, action: "None",          notes: null },
  { tenant: "Simmons, Michael",          unit: "913",  balance:   500.00, aging0_30:    500, aging30plus:        0, action: "None",          notes: null },
  { tenant: "Kindred, Dealia",           unit: "713",  balance:   260.01, aging0_30: 260.01, aging30plus:        0, action: "None",          notes: null },
  { tenant: "Castillo, Yadira",          unit: "114",  balance:   236.00, aging0_30:    236, aging30plus:        0, action: "None",          notes: null },
  { tenant: "Thwing, Jill",             unit: "712",  balance:    70.00, aging0_30:     70, aging30plus:        0, action: "None",          notes: null },
  { tenant: "Cirlos, Linda",             unit: "322",  balance:    12.00, aging0_30:     12, aging30plus:        0, action: "None",          notes: null },
  { tenant: "Labrada, Yoel (Skip)",      unit: "425",  balance: 2_402.00, aging0_30:      0, aging30plus: 2_402.00, action: "Eviction Filed", notes: "Former resident — skip. Unit vacated." },
];

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────
function FinRowComponent({ row, isExpense }: { row: FinRow; isExpense?: boolean }) {
  const variance = row.actual - row.budget;
  if (row.isSummary) {
    return (
      <tr className="bg-gray-50 border-t-2 border-gray-300">
        <td className="px-4 py-2.5 text-sm font-bold text-gray-900">{row.label}</td>
        <td className="px-4 py-2.5 text-sm text-right font-bold text-gray-700">{fmt(row.budget)}</td>
        <td className="px-4 py-2.5 text-sm text-right font-bold text-gray-900">{row.actual !== 0 ? fmt(row.actual) : <span className="text-gray-300">Pending</span>}</td>
        <td className={cn("px-4 py-2.5 text-sm text-right font-bold", row.actual !== 0 ? varColor(variance, isExpense) : "text-gray-300")}>
          {row.actual !== 0 ? varStr(variance) : "—"}
        </td>
      </tr>
    );
  }
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50/60">
      <td className="px-4 py-2 pl-8 text-sm text-gray-700">{row.label}</td>
      <td className="px-4 py-2 text-sm text-right text-gray-500">{fmt(row.budget)}</td>
      <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">
        {row.actual !== 0 ? fmt(row.actual) : <span className="text-gray-300">Pending</span>}
      </td>
      <td className={cn("px-4 py-2 text-sm text-right font-medium", row.actual !== 0 ? varColor(variance, isExpense) : "text-gray-300")}>
        {row.actual !== 0 ? varStr(variance) : "—"}
      </td>
    </tr>
  );
}

function SectionHeader({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <tr className={cn("border-t-2 border-gray-200", colorClass)}>
      <td colSpan={4} className="px-4 py-2 text-xs font-bold uppercase tracking-wider">{label}</td>
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
      <td className={cn("px-4 py-3 text-sm text-right font-bold", actual !== 0 ? color : "text-gray-400")}>
        {actual !== 0 ? fmt(actual) : "Pending"}
      </td>
      <td className={cn("px-4 py-3 text-sm text-right font-bold", actual !== 0 ? varColor(variance, false) : "text-gray-500")}>
        {actual !== 0 ? varStr(variance) : "—"}
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

  const incomeSum    = sum(income);
  const collectionsSum = sum(collections);
  const expensesSum  = sum(expenses);
  const belowLineSum = sum(belowLine);

  const egi = { actual: incomeSum.actual, budget: incomeSum.budget };
  const noi = { actual: egi.actual - expensesSum.actual, budget: egi.budget - expensesSum.budget };
  const ncf = { actual: noi.actual - belowLineSum.actual, budget: noi.budget - belowLineSum.budget };
  const netCollections = { actual: collectionsSum.actual, budget: collectionsSum.budget };

  const occupancy = OCCUPANCY[month];
  const delinqItem = income.find((r) => r.label === "Delinquency");
  const delinqActualPct = delinqItem ? (Math.abs(delinqItem.actual) / GPR) * 100 : 0;
  const delinqBudgetPct = delinqItem ? (Math.abs(delinqItem.budget) / GPR) * 100 : 0;

  const debtServiceActual = belowLine
    .filter((r) => r.label.toLowerCase().includes("debt service"))
    .reduce((s, r) => s + r.actual, 0);
  const dscr = debtServiceActual > 0 ? noi.actual / debtServiceActual : null;
  const expenseRatio = egi.actual > 0 ? (expensesSum.actual / egi.actual) * 100 : null;

  const totalDelinquent = DELINQUENCY.reduce((s, d) => s + d.balance, 0);
  const total30plus     = DELINQUENCY.reduce((s, d) => s + d.aging30plus, 0);
  const isApril = month === "apr";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── STICKY HEADER ── */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3 pt-4 pb-2">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">Towne East Village</h1>
                <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs px-2.5 py-0.5">Active</Badge>
                <Badge className="bg-amber-100 text-amber-800 border border-amber-200 text-xs px-2.5 py-0.5">Closed Mar 16, 2026</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-1 text-xs text-gray-500">
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />Converse, TX</span>
                <span className="flex items-center gap-1"><Home className="h-3.5 w-3.5" />100 units</span>
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Data: Rent Roll + Deal Terms · Sunridge reports start April</span>
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-14">

        {/* ── FINANCIALS ── */}
        <section id="financials" className="scroll-mt-28">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Financials — Actuals vs. Budget</h2>
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              Actuals pending first Sunridge report · Budget based on rent roll + deal terms
            </span>
          </div>

          <div className="flex gap-1 border-b border-gray-200 mb-5">
            {(["mar", "apr"] as Month[]).map((m) => {
              const labels: Record<Month, string> = { mar: "Mar 2026 (½ month)", apr: "Apr 2026 (Budget)" };
              return (
                <button
                  key={m}
                  onClick={() => setMonth(m)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                    month === m ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
                  )}
                >
                  {labels[m]}
                </button>
              );
            })}
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
            <Card className="border-gray-200">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Occupancy</p>
                <p className={cn("text-2xl font-bold mt-1", occupancy.actual > 0 ? (occupancy.actual >= occupancy.budget ? "text-emerald-600" : "text-amber-600") : "text-gray-300")}>
                  {occupancy.actual > 0 ? `${occupancy.actual.toFixed(1)}%` : "Pending"}
                </p>
                <p className="text-xs text-gray-400 mt-1.5">Bgt {occupancy.budget.toFixed(1)}%</p>
                {occupancy.actual > 0 && (
                  <p className={cn("text-xs font-semibold mt-0.5", (occupancy.actual - occupancy.budget) >= 0 ? "text-emerald-600" : "text-red-500")}>
                    {(occupancy.actual - occupancy.budget) >= 0 ? "+" : ""}{(occupancy.actual - occupancy.budget).toFixed(1)}pp
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="border-gray-200">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">NOI</p>
                <p className={cn("text-2xl font-bold mt-1", isApril ? "text-gray-400" : noi.actual >= 0 ? "text-gray-900" : "text-red-600")}>
                  {isApril ? "Pending" : fmt(noi.actual)}
                </p>
                <p className="text-xs text-gray-400 mt-1.5">Bgt {fmt(noi.budget)}</p>
                {!isApril && <p className={cn("text-xs font-semibold mt-0.5", varColor(noi.actual - noi.budget))}>{varStr(noi.actual - noi.budget)}</p>}
              </CardContent>
            </Card>
            <Card className="border-gray-200">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Delinquency %</p>
                <p className={cn("text-2xl font-bold mt-1", isApril ? "text-gray-400" : delinqActualPct <= delinqBudgetPct ? "text-emerald-600" : "text-red-600")}>
                  {isApril ? `${((totalDelinquent / GPR) * 100).toFixed(1)}%` : `${delinqActualPct.toFixed(1)}%`}
                </p>
                <p className="text-xs text-gray-400 mt-1.5">
                  {isApril ? "Current balance vs GPR" : `Bgt ${delinqBudgetPct.toFixed(1)}%`}
                </p>
              </CardContent>
            </Card>
            <Card className="border-gray-200">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Expense Ratio</p>
                <p className={cn("text-2xl font-bold mt-1", expenseRatio == null || isApril ? "text-gray-400" : expenseRatio < 50 ? "text-emerald-600" : "text-red-600")}>
                  {expenseRatio != null && !isApril ? `${expenseRatio.toFixed(1)}%` : "Pending"}
                </p>
                <p className="text-xs text-gray-400 mt-1.5">Oper. Expenses / EGI</p>
              </CardContent>
            </Card>
            <Card className="border-gray-200">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">DSCR</p>
                <p className={cn("text-2xl font-bold mt-1", dscr == null || isApril ? "text-gray-400" : dscr >= 1.25 ? "text-emerald-600" : dscr >= 1.0 ? "text-amber-600" : "text-red-600")}>
                  {dscr != null && !isApril ? `${dscr.toFixed(2)}x` : "Pending"}
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
                        <th key={h} className={cn("px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide", h === "Line Item" ? "text-left" : "text-right")}>{h}</th>
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

        {/* ── DELINQUENCY ── */}
        <section id="delinquency" className="scroll-mt-28">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Delinquency</h2>
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              Source: Current rent roll · 30-day aging estimated from closing roll
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: "Total Delinquent",  value: fmt(totalDelinquent),                                       color: "text-red-600" },
              { label: "Delinquent Units",  value: `${DELINQUENCY.length} / 100`,                              color: "text-red-600" },
              { label: "30+ Days Past Due", value: fmt(total30plus),                                           color: "text-red-700" },
              { label: "Delinquency % GPR", value: `${((totalDelinquent / GPR) * 100).toFixed(1)}%`,          color: "text-red-600" },
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

        {/* ── RENOVATIONS ── */}
        <section id="renovations" className="scroll-mt-28">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Renovations</h2>
          <RenovationSection />
        </section>

        {/* ── CAPEX ── */}
        <section id="capex" className="scroll-mt-28 pb-16">
          <h2 className="text-lg font-bold text-gray-900 mb-4">CapEx</h2>
          <CapExSection />
        </section>

      </main>
    </div>
  );
}
