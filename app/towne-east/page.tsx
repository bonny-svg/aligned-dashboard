"use client";

import React, { useState, useCallback } from "react";
import { MapPin, Home, Clock, CheckCircle2, AlertCircle, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import RenovationSection from "@/components/RenovationSection";
import CapExSection from "@/components/CapExSection";

// ─── TYPES ────────────────────────────────────────────────────────────────────
type Month = "mar";

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

// ─── REAL FINANCIAL DATA — March 2026 (partial month, acquired 3/16/2026) ─────
const INCOME: Record<Month, FinRow[]> = {
  mar: [
    { label: "Gross Potential Rent",        actual:  46_076, budget: 109_000 },
    { label: "Loss / Gain to Leases",       actual:       0, budget:  -4_850 },
    { label: "Vacancy Loss",                actual:       0, budget:  -5_450 },
    { label: "Write-Offs / Bad Debt",       actual:       0, budget:  -1_562 },
    { label: "Other Revenue",               actual:       0, budget:   7_600 },
  ],
};

const EXPENSES: Record<Month, FinRow[]> = {
  mar: [
    { label: "Personnel",                   actual:       0, budget: 12_514 },
    { label: "Management Fees",             actual:       0, budget:  3_142 },
    { label: "Administrative",              actual:       0, budget:  2_284 },
    { label: "Leasing",                     actual:      22, budget:  2_346 },
    { label: "Utilities",                   actual:      10, budget:  2_309 },
    { label: "Services",                    actual:       0, budget:     42 },
    { label: "Cleaning & Decorating",       actual:       0, budget:    975 },
    { label: "Repairs & Maintenance",       actual:       0, budget:  2_115 },
    { label: "Property Taxes",              actual:   3_190, budget:  7_833 },
    { label: "Property Insurance",          actual:   4_010, budget:  4_867 },
  ],
};

const BELOW_LINE: Record<Month, FinRow[]> = {
  mar: [
    { label: "Debt Service – Principal & Interest", actual: 14_433, budget: 25_361 },
    { label: "Replacement Reserves",               actual:      0, budget:  2_802 },
  ],
};

// ─── DAILY SNAPSHOT DATA (from RealPage reports, updated Apr 12, 2026) ────────
const SNAPSHOT = {
  asOf: "Apr 12, 2026",
  occupancy: { occupied: 91, total: 100, pct: 91.0 },
  collections: {
    totalCharged: 112_486,
    totalCollected: 97_715,
    endingBalance: 34_903,
  },
  delinquency: {
    currentRent: 16_771,
    lateFees: 10_595,
    priorPeriod: 5_764,
    badDebt: 1_853,
    total: 35_021,
  },
};

// ─── LEASE EXPIRATION / RENEWAL DATA (from OneSite, as of Apr 11, 2026) ──────
const LEASING = [
  { month: "Mar 2026", expiring: 13, renewed: 7, vacating: 2, mtm: 6, unknown: 0 },
  { month: "Apr 2026", expiring:  3, renewed: 0, vacating: 1, mtm: 0, unknown: 2 },
  { month: "May 2026", expiring:  8, renewed: 0, vacating: 0, mtm: 0, unknown: 8 },
  { month: "Jun 2026", expiring:  6, renewed: 0, vacating: 0, mtm: 0, unknown: 6 },
];

// ─── OCCUPANCY DATA (for monthly financials) ─────────────────────────────────
const OCCUPANCY: Record<Month, { actual: number; budget: number }> = {
  mar: { actual: 96.0, budget: 95.0 },
};

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function FinRowComponent({ row, isExpense }: { row: FinRow; isExpense?: boolean }) {
  const variance = row.actual - row.budget;
  if (row.isSummary) {
    return (
      <tr className="bg-gray-50 border-t-2 border-gray-300">
        <td className="px-4 py-2.5 text-sm font-bold text-gray-900">{row.label}</td>
        <td className="px-4 py-2.5 text-sm text-right font-bold text-gray-700">{fmt(row.budget)}</td>
        <td className="px-4 py-2.5 text-sm text-right font-bold text-gray-900">{fmt(row.actual)}</td>
        <td className={cn("px-4 py-2.5 text-sm text-right font-bold", varColor(variance, isExpense))}>{varStr(variance)}</td>
      </tr>
    );
  }
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50/60">
      <td className="px-4 py-2 pl-8 text-sm text-gray-700">{row.label}</td>
      <td className="px-4 py-2 text-sm text-right text-gray-500">{fmt(row.budget)}</td>
      <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">{fmt(row.actual)}</td>
      <td className={cn("px-4 py-2 text-sm text-right font-medium", varColor(variance, isExpense))}>{varStr(variance)}</td>
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
      <td className={cn("px-4 py-3 text-sm text-right font-bold", color)}>{fmt(actual)}</td>
      <td className={cn("px-4 py-3 text-sm text-right font-bold", varColor(variance, false))}>{varStr(variance)}</td>
    </tr>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function TowneEastPage() {
  const [month] = useState<Month>("mar");

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const income    = INCOME[month];
  const expenses  = EXPENSES[month];
  const belowLine = BELOW_LINE[month];

  const incomeSum    = sum(income);
  const expensesSum  = sum(expenses);
  const belowLineSum = sum(belowLine);

  const egi = { actual: incomeSum.actual, budget: incomeSum.budget };
  const noi = { actual: egi.actual - expensesSum.actual, budget: egi.budget - expensesSum.budget };
  const ncf = { actual: noi.actual - belowLineSum.actual, budget: noi.budget - belowLineSum.budget };

  const occupancy = OCCUPANCY[month];

  const debtServiceActual = belowLine
    .filter((r) => r.label.toLowerCase().includes("debt service"))
    .reduce((s, r) => s + r.actual, 0);
  const dscr         = debtServiceActual > 0 ? noi.actual / debtServiceActual : null;
  const expenseRatio = egi.actual > 0 ? (expensesSum.actual / egi.actual) * 100 : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3 pt-4 pb-2">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">Towne East Village</h1>
                <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs">Active</Badge>
                <Badge className="bg-blue-100 text-blue-800 border border-blue-200 text-xs">Closed Mar 16, 2026</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-1 text-xs text-gray-500">
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />Converse, TX</span>
                <span className="flex items-center gap-1"><Home className="h-3.5 w-3.5" />100 units · Freddie Mac</span>
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Financials as of Mar 31, 2026</span>
              </div>
            </div>
          </div>
          <nav className="flex gap-0 -mb-px overflow-x-auto">
            {(["Snapshot", "Financials", "Leasing", "Renovations", "CapEx"] as const).map((label) => (
              <button key={label} onClick={() => scrollTo(label.toLowerCase())}
                className="px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-blue-600 border-b-2 border-transparent hover:border-blue-500 whitespace-nowrap transition-colors">
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-14">

        {/* ══ SECTION 1 · DAILY SNAPSHOT ══ */}
        <section id="snapshot" className="scroll-mt-28">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Property Snapshot</h2>
            <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-1">Updated {SNAPSHOT.asOf}</span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <Card className="border-gray-200"><CardContent className="pt-4 pb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Occupancy</p>
              <p className={cn("text-2xl font-bold mt-1", SNAPSHOT.occupancy.pct >= 95 ? "text-emerald-600" : "text-amber-600")}>{SNAPSHOT.occupancy.pct}%</p>
              <p className="text-xs text-gray-400 mt-1">{SNAPSHOT.occupancy.occupied} / {SNAPSHOT.occupancy.total} units</p>
            </CardContent></Card>
            <Card className="border-gray-200"><CardContent className="pt-4 pb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Charged</p>
              <p className="text-2xl font-bold mt-1 text-gray-900">{fmt(SNAPSHOT.collections.totalCharged)}</p>
              <p className="text-xs text-gray-400 mt-1">April lease charges</p>
            </CardContent></Card>
            <Card className="border-gray-200"><CardContent className="pt-4 pb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Collected</p>
              <p className="text-2xl font-bold mt-1 text-emerald-600">{fmt(SNAPSHOT.collections.totalCollected)}</p>
              <p className="text-xs text-gray-400 mt-1">{((SNAPSHOT.collections.totalCollected / SNAPSHOT.collections.totalCharged) * 100).toFixed(1)}% of charged</p>
            </CardContent></Card>
            <Card className="border-red-100 bg-red-50/30"><CardContent className="pt-4 pb-3">
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">Delinquent Balance</p>
              <p className="text-2xl font-bold mt-1 text-red-600">{fmt(SNAPSHOT.collections.endingBalance)}</p>
              <p className="text-xs text-red-400 mt-1">All outstanding balances</p>
            </CardContent></Card>
          </div>

          <Card className="border-gray-200"><CardContent className="p-0"><div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200"><tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">% of Total</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { label: "Current Month Rent Past Due", amount: SNAPSHOT.delinquency.currentRent },
                  { label: "Late Fees Outstanding",       amount: SNAPSHOT.delinquency.lateFees },
                  { label: "Prior Period Balances",       amount: SNAPSHOT.delinquency.priorPeriod },
                  { label: "Bad Debt Charges",            amount: SNAPSHOT.delinquency.badDebt },
                ].map((row) => (
                  <tr key={row.label} className="hover:bg-gray-50/60">
                    <td className="px-4 py-2.5 text-sm text-gray-700">{row.label}</td>
                    <td className="px-4 py-2.5 text-sm text-right font-medium text-red-600">{fmt(row.amount)}</td>
                    <td className="px-4 py-2.5 text-sm text-right text-gray-500">{((row.amount / SNAPSHOT.delinquency.total) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-800"><tr>
                <td className="px-4 py-2.5 text-sm font-bold text-white">Total Delinquent</td>
                <td className="px-4 py-2.5 text-sm text-right font-bold text-red-400">{fmt(SNAPSHOT.delinquency.total)}</td>
                <td className="px-4 py-2.5 text-sm text-right font-bold text-gray-300">100%</td>
              </tr></tfoot>
            </table>
          </div></CardContent></Card>
        </section>

        {/* ══ SECTION 2 · FINANCIALS (Monthly) ══ */}
        <section id="financials" className="scroll-mt-28">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Financials — Actuals vs. Budget</h2>
            <span className="text-xs text-gray-500 bg-gray-100 border border-gray-200 rounded px-2 py-1">Updated monthly — last report: March 2026</span>
          </div>
          <div className="flex items-center gap-4 border-b border-gray-200 mb-5">
            <button className="px-4 py-2 text-sm font-medium border-b-2 -mb-px border-blue-600 text-blue-600">Mar 2026</button>
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">Partial month — acquired 3/16/2026</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
            <Card className="border-gray-200"><CardContent className="pt-4 pb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Occupancy</p>
              <p className={cn("text-2xl font-bold mt-1", occupancy.actual >= occupancy.budget ? "text-emerald-600" : "text-amber-600")}>{occupancy.actual.toFixed(1)}%</p>
              <p className="text-xs text-gray-400 mt-1.5">Bgt {occupancy.budget.toFixed(1)}%</p>
              <p className={cn("text-xs font-semibold mt-0.5", (occupancy.actual - occupancy.budget) >= 0 ? "text-emerald-600" : "text-red-500")}>{(occupancy.actual - occupancy.budget) >= 0 ? "+" : ""}{(occupancy.actual - occupancy.budget).toFixed(1)}pp</p>
            </CardContent></Card>
            <Card className="border-gray-200"><CardContent className="pt-4 pb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">NOI</p>
              <p className={cn("text-2xl font-bold mt-1", noi.actual >= 0 ? "text-gray-900" : "text-red-600")}>{fmt(noi.actual)}</p>
              <p className="text-xs text-gray-400 mt-1.5">Bgt {fmt(noi.budget)}</p>
              <p className={cn("text-xs font-semibold mt-0.5", varColor(noi.actual - noi.budget, false))}>{varStr(noi.actual - noi.budget)}</p>
            </CardContent></Card>
            <Card className="border-gray-200"><CardContent className="pt-4 pb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Net Cash Flow</p>
              <p className={cn("text-2xl font-bold mt-1", ncf.actual >= 0 ? "text-emerald-600" : "text-red-600")}>{fmt(ncf.actual)}</p>
              <p className="text-xs text-gray-400 mt-1.5">Bgt {fmt(ncf.budget)}</p>
              <p className={cn("text-xs font-semibold mt-0.5", varColor(ncf.actual - ncf.budget, false))}>{varStr(ncf.actual - ncf.budget)}</p>
            </CardContent></Card>
            <Card className="border-gray-200"><CardContent className="pt-4 pb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Expense Ratio</p>
              <p className={cn("text-2xl font-bold mt-1", expenseRatio == null ? "text-gray-400" : expenseRatio < 50 ? "text-emerald-600" : "text-red-600")}>{expenseRatio != null ? `${expenseRatio.toFixed(1)}%` : "—"}</p>
              <p className="text-xs text-gray-400 mt-1.5">Oper. Expenses / EGI</p>
            </CardContent></Card>
            <Card className="border-gray-200"><CardContent className="pt-4 pb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">DSCR</p>
              <p className={cn("text-2xl font-bold mt-1", dscr == null ? "text-gray-400" : dscr >= 1.25 ? "text-emerald-600" : dscr >= 1.0 ? "text-amber-600" : "text-red-600")}>{dscr != null ? `${dscr.toFixed(2)}x` : "—"}</p>
              <p className="text-xs text-gray-400 mt-1.5">NOI / Debt Service</p>
            </CardContent></Card>
          </div>

          <Card className="border-gray-200"><CardContent className="p-0"><div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200"><tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Line Item</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Budget</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actual</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Variance</th>
              </tr></thead>
              <tbody>
                <SectionHeader label="Income" colorClass="bg-blue-50/70 text-blue-700" />
                {income.map((r) => <FinRowComponent key={r.label} row={r} />)}
                <FinRowComponent row={{ label: "Total Effective Gross Income", actual: egi.actual, budget: egi.budget, isSummary: true }} />
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
          </div></CardContent></Card>
        </section>

        {/* ══ SECTION 3 · LEASING ══ */}
        <section id="leasing" className="scroll-mt-28">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Lease Expirations & Renewals</h2>
            <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-1">Updated {SNAPSHOT.asOf}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {(() => {
              const totalExpiring = LEASING.reduce((s, l) => s + l.expiring, 0);
              const totalRenewed  = LEASING.reduce((s, l) => s + l.renewed, 0);
              const totalVacating = LEASING.reduce((s, l) => s + l.vacating, 0);
              const totalUnknown  = LEASING.reduce((s, l) => s + l.unknown, 0);
              return [
                { label: "Expiring (Mar–Jun)", value: `${totalExpiring} leases`, color: "text-gray-900" },
                { label: "Renewed",            value: `${totalRenewed}`,         color: "text-emerald-600" },
                { label: "Vacating / NTV",     value: `${totalVacating}`,        color: "text-red-600" },
                { label: "Pending / Unknown",  value: `${totalUnknown + LEASING.reduce((s, l) => s + l.mtm, 0)}`, color: "text-amber-600" },
              ];
            })().map(({ label, value, color }) => (
              <Card key={label} className="border-gray-200"><CardContent className="pt-4 pb-3">
                <p className="text-xs font-medium text-gray-500">{label}</p>
                <p className={cn("text-xl font-bold mt-0.5", color)}>{value}</p>
              </CardContent></Card>
            ))}
          </div>

          <Card className="border-gray-200"><CardContent className="p-0"><div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200"><tr>
                {["Month", "Expiring", "Renewed", "Vacating", "MTM", "Unknown"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {LEASING.map((row) => (
                  <tr key={row.month} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.month}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{row.expiring}</td>
                    <td className="px-4 py-3 text-sm">{row.renewed > 0 ? <span className="font-semibold text-emerald-600">{row.renewed}</span> : <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-sm">{row.vacating > 0 ? <span className="font-semibold text-red-600">{row.vacating}</span> : <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-sm">{row.mtm > 0 ? <span className="font-semibold text-amber-600">{row.mtm}</span> : <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-sm">{row.unknown > 0 ? <span className="font-semibold text-amber-600">{row.unknown}</span> : <span className="text-gray-300">—</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200"><tr>
                <td className="px-4 py-2.5 text-xs font-bold text-gray-600 uppercase">Total</td>
                <td className="px-4 py-2.5 font-bold text-gray-900">{LEASING.reduce((s, l) => s + l.expiring, 0)}</td>
                <td className="px-4 py-2.5 font-bold text-emerald-600">{LEASING.reduce((s, l) => s + l.renewed, 0)}</td>
                <td className="px-4 py-2.5 font-bold text-red-600">{LEASING.reduce((s, l) => s + l.vacating, 0)}</td>
                <td className="px-4 py-2.5 font-bold text-amber-600">{LEASING.reduce((s, l) => s + l.mtm, 0)}</td>
                <td className="px-4 py-2.5 font-bold text-amber-600">{LEASING.reduce((s, l) => s + l.unknown, 0)}</td>
              </tr></tfoot>
            </table>
          </div></CardContent></Card>
        </section>

        {/* ══ SECTION 4 · RENOVATIONS (Live from Google Sheets) ══ */}
        <section id="renovations" className="scroll-mt-28">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Renovations</h2>
          <RenovationSection />
        </section>

        {/* ══ SECTION 5 · CAPEX (Live from Google Sheets) ══ */}
        <section id="capex" className="scroll-mt-28 pb-16">
          <h2 className="text-lg font-bold text-gray-900 mb-4">CapEx</h2>
          <CapExSection />
        </section>

      </main>
    </div>
  );
}
