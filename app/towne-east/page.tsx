"use client";

import React, { useState, useCallback, useEffect } from "react";
import { MapPin, Home, Clock, CheckCircle2, AlertCircle, Circle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ─── TYPES ────────────────────────────────────────────────────────────────────
type Month = "mar";

interface FinRow {
  label: string;
  actual: number;
  budget: number;
  isSummary?: boolean;
  isExpense?: boolean; // flips variance coloring
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

// ─── GOOGLE SHEET LIVE DATA ──────────────────────────────────────────────────
const SHEET_ID = "1Jt9WIaON5joUPNwduptvgRb3PyjyZmsioGGP6KJudh8";
const csvUrl = (sheet: string) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;

interface RenoUnit {
  unit: string;
  floorplan: string;
  budget: number;
  moveOut: string;
  walkDate: string;
  startDate: string;
  promiseDate: string;
  completionDate: string;
  leasedDate: string;
  daysUnder: string;
  contractor: string;
  actualSpend: number;
  pct: string;
  notes: string;
  status: "Complete" | "In Progress" | "Upcoming" | "Planned";
}

interface CapExItem {
  item: string;
  phase: string;
  proposedCost: number;
  underwriting: number;
  actual: number;
  notes: string;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === "," && !inQuotes) { cells.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    cells.push(current.trim());
    rows.push(cells);
  }
  return rows;
}

function parseMoney(s: string): number {
  if (!s) return 0;
  return parseFloat(s.replace(/[$,]/g, "")) || 0;
}

function parseRenoSheet(rows: string[][]): RenoUnit[] {
  const units: RenoUnit[] = [];
  let currentStatus: "Complete" | "In Progress" | "Upcoming" | "Planned" = "In Progress";

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const col0 = row[0] || "";
    const unitNum = (row[1] || "").trim();

    // Detect status headers
    const col2 = (row[2] || "").trim().toLowerCase();
    if (col2 === "completed" || col2 === "complete") { currentStatus = "Complete"; continue; }
    if (col2 === "work in progress") { currentStatus = "In Progress"; continue; }
    if (col2 === "upcoming") { currentStatus = "Upcoming"; continue; }
    if (col2 === "planned") { currentStatus = "Planned"; continue; }

    if (!unitNum || unitNum === "Unit") continue;

    // Skip the "not renovating" unit
    const notes = (row[14] || "").trim();
    if (notes.toLowerCase().includes("not rennovat") || notes.toLowerCase().includes("not renovat")) continue;

    units.push({
      unit: unitNum,
      floorplan: (row[2] || "").trim(),
      budget: parseMoney(row[3] || ""),
      moveOut: (row[4] || "").trim(),
      walkDate: (row[5] || "").trim(),
      startDate: (row[6] || "").trim(),
      promiseDate: (row[7] || "").trim(),
      completionDate: (row[8] || "").trim(),
      leasedDate: (row[9] || "").trim(),
      daysUnder: (row[10] || "").trim(),
      contractor: (row[11] || "").trim(),
      actualSpend: parseMoney(row[12] || ""),
      pct: (row[13] || "").trim(),
      notes,
      status: currentStatus,
    });
  }
  return units;
}

function parseCapExSheet(rows: string[][]): CapExItem[] {
  const items: CapExItem[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const item = (row[0] || "").trim();
    const phase = (row[1] || "").trim();
    const underwriting = parseMoney(row[3] || "");

    // Skip headers, subtotals, totals, legend, and empty rows
    if (!item || !phase) continue;
    if (item.toLowerCase().includes("subtotal") || item.toLowerCase().includes("total")) continue;
    if (item === "LEGEND:") continue;
    if (phase === "Phase") continue;

    items.push({
      item,
      phase,
      proposedCost: parseMoney(row[2] || ""),
      underwriting,
      actual: parseMoney(row[4] || ""),
      notes: (row[18] || row[17] || "").trim(),
    });
  }
  return items;
}

function useSheetData() {
  const [renoUnits, setRenoUnits] = useState<RenoUnit[]>([]);
  const [capexItems, setCapexItems] = useState<CapExItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [renoRes, capexRes] = await Promise.all([
          fetch(csvUrl("Sheet1"), { cache: "no-store" }),
          fetch(csvUrl("Sheet2"), { cache: "no-store" }),
        ]);
        const [renoText, capexText] = await Promise.all([renoRes.text(), capexRes.text()]);
        setRenoUnits(parseRenoSheet(parseCsv(renoText)));
        setCapexItems(parseCapExSheet(parseCsv(capexText)));
      } catch (e) {
        console.error("Failed to fetch sheet data:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { renoUnits, capexItems, loading };
}

// ─── REAL FINANCIAL DATA — March 2026 (partial month, acquired 3/16/2026) ─────
// Actuals: SunRidge Management Financial Statement, March 2026
// Budget:  Towne East Village T12 Projected Operating Budget (March column)

const INCOME: Record<Month, FinRow[]> = {
  mar: [
    { label: "Gross Potential Rent",        actual:  46_076, budget: 109_000 },
    { label: "Loss / Gain to Leases",       actual:       0, budget:  -4_850 },
    { label: "Vacancy Loss",                actual:       0, budget:  -5_450 },
    { label: "Write-Offs / Bad Debt",        actual:       0, budget:  -1_562 },
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
    totalCharged: 112_486,   // Total lease charges for April fiscal period
    totalCollected: 97_715,  // Total credits (payments) received
    endingBalance: 34_903,   // Total outstanding balance
  },
  delinquency: {
    currentRent: 16_771,     // RENT past due (current period)
    lateFees: 10_595,        // Late fees outstanding
    priorPeriod: 5_764,      // Prior period balances carried forward
    badDebt: 1_853,          // Bad debt charges
    total: 35_021,           // Net delinquent total
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

// ─── RENOVATIONS & CAPEX — pulled live from Google Sheets ────────────────────
// Sheet: https://docs.google.com/spreadsheets/d/1Jt9WIaON5joUPNwduptvgRb3PyjyZmsioGGP6KJudh8

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

function renoStatusBadge(s: string): string {
  switch (s) {
    case "Complete":    return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "In Progress": return "bg-blue-100 text-blue-800 border-blue-200";
    case "Planned":     return "bg-gray-100 text-gray-600 border-gray-200";
    default:            return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

function renoStatusIcon(s: string) {
  if (s === "Complete")    return <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />;
  if (s === "In Progress") return <AlertCircle  className="h-4 w-4 text-blue-500 flex-shrink-0"    />;
  return                          <Circle       className="h-4 w-4 text-gray-300 flex-shrink-0"    />;
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function FinRow({ row, isExpense }: { row: FinRow; isExpense?: boolean }) {
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
  const [month] = useState<Month>("mar");
  const { renoUnits, capexItems, loading: sheetsLoading } = useSheetData();

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const income      = INCOME[month];
  const expenses    = EXPENSES[month];
  const belowLine   = BELOW_LINE[month];

  const incomeSum      = sum(income);
  const expensesSum    = sum(expenses);
  const belowLineSum   = sum(belowLine);

  const egi = { actual: incomeSum.actual, budget: incomeSum.budget };
  const noi = { actual: egi.actual - expensesSum.actual, budget: egi.budget - expensesSum.budget };
  const ncf = { actual: noi.actual - belowLineSum.actual, budget: noi.budget - belowLineSum.budget };

  const occupancy        = OCCUPANCY[month];

  const debtServiceActual = belowLine
    .filter((r) => r.label.toLowerCase().includes("debt service"))
    .reduce((s, r) => s + r.actual, 0);
  const dscr             = debtServiceActual > 0 ? noi.actual / debtServiceActual : null;
  const expenseRatio     = egi.actual > 0 ? (expensesSum.actual / egi.actual) * 100 : null;

  // Renovation computed values from live sheet
  const renoInProgress = renoUnits.filter((u) => u.status === "In Progress");
  const renoComplete   = renoUnits.filter((u) => u.status === "Complete");
  const renoUpcoming   = renoUnits.filter((u) => u.status === "Upcoming" || u.status === "Planned");
  const totalRenoSpent = renoUnits.reduce((s, u) => s + u.actualSpend, 0);
  const totalRenoBudget = renoUnits.reduce((s, u) => s + u.budget, 0);

  // CapEx computed values from live sheet
  const capexPhases = ["Immediate", "Unit Renovations", "Year 1", "As-Needed", "Reserves / Ongoing 12+ Months"];
  const totalCapexBudget = capexItems.reduce((s, c) => s + c.underwriting, 0);
  const totalCapexActual = capexItems.reduce((s, c) => s + c.actual, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── STICKY HEADER ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Top row */}
          <div className="flex flex-wrap items-start justify-between gap-3 pt-4 pb-2">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">Towne East Village</h1>
                <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs px-2.5 py-0.5">
                  Active
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-1 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  Converse, TX
                </span>
                <span className="flex items-center gap-1">
                  <Home className="h-3.5 w-3.5" />
                  100 units
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Financials as of Mar 31, 2026
                </span>
              </div>
            </div>
          </div>
          {/* Section nav */}
          <nav className="flex gap-0 -mb-px overflow-x-auto">
            {(["Snapshot", "Financials", "Leasing", "Renovations", "CapEx"] as const).map((label) => (
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
            SECTION 1 · DAILY SNAPSHOT
        ══════════════════════════════════════════════════════════════════ */}
        <section id="snapshot" className="scroll-mt-28">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Property Snapshot</h2>
            <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-1">
              Updated {SNAPSHOT.asOf}
            </span>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <Card className="border-gray-200">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Occupancy</p>
                <p className={cn("text-2xl font-bold mt-1", SNAPSHOT.occupancy.pct >= 95 ? "text-emerald-600" : "text-amber-600")}>
                  {SNAPSHOT.occupancy.pct}%
                </p>
                <p className="text-xs text-gray-400 mt-1">{SNAPSHOT.occupancy.occupied} / {SNAPSHOT.occupancy.total} units</p>
              </CardContent>
            </Card>

            <Card className="border-gray-200">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Charged</p>
                <p className="text-2xl font-bold mt-1 text-gray-900">{fmt(SNAPSHOT.collections.totalCharged)}</p>
                <p className="text-xs text-gray-400 mt-1">April lease charges</p>
              </CardContent>
            </Card>

            <Card className="border-gray-200">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Collected</p>
                <p className="text-2xl font-bold mt-1 text-emerald-600">{fmt(SNAPSHOT.collections.totalCollected)}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {((SNAPSHOT.collections.totalCollected / SNAPSHOT.collections.totalCharged) * 100).toFixed(1)}% of charged
                </p>
              </CardContent>
            </Card>

            <Card className="border-red-100 bg-red-50/30">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">Delinquent Balance</p>
                <p className="text-2xl font-bold mt-1 text-red-600">{fmt(SNAPSHOT.collections.endingBalance)}</p>
                <p className="text-xs text-red-400 mt-1">All outstanding balances</p>
              </CardContent>
            </Card>
          </div>

          {/* Delinquency breakdown */}
          <Card className="border-gray-200">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">% of Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      { label: "Current Month Rent Past Due", amount: SNAPSHOT.delinquency.currentRent },
                      { label: "Late Fees Outstanding",       amount: SNAPSHOT.delinquency.lateFees },
                      { label: "Prior Period Balances",        amount: SNAPSHOT.delinquency.priorPeriod },
                      { label: "Bad Debt Charges",             amount: SNAPSHOT.delinquency.badDebt },
                    ].map((row) => (
                      <tr key={row.label} className="hover:bg-gray-50/60">
                        <td className="px-4 py-2.5 text-sm text-gray-700">{row.label}</td>
                        <td className="px-4 py-2.5 text-sm text-right font-medium text-red-600">{fmt(row.amount)}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-gray-500">
                          {((row.amount / SNAPSHOT.delinquency.total) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-800">
                    <tr>
                      <td className="px-4 py-2.5 text-sm font-bold text-white">Total Delinquent</td>
                      <td className="px-4 py-2.5 text-sm text-right font-bold text-red-400">{fmt(SNAPSHOT.delinquency.total)}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-bold text-gray-300">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 2 · FINANCIALS (Monthly)
        ══════════════════════════════════════════════════════════════════ */}
        <section id="financials" className="scroll-mt-28">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Financials — Actuals vs. Budget</h2>
            <span className="text-xs text-gray-500 bg-gray-100 border border-gray-200 rounded px-2 py-1">
              Updated monthly — last report: March 2026
            </span>
          </div>

          {/* Month tabs */}
          <div className="flex items-center gap-4 border-b border-gray-200 mb-5">
            <button
              className="px-4 py-2 text-sm font-medium border-b-2 -mb-px border-blue-600 text-blue-600"
            >
              Mar 2026
            </button>
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              Partial month — acquired 3/16/2026
            </span>
          </div>

          {/* KPI cards — 5 metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">

            {/* 1 · Occupancy */}
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

            {/* 2 · NOI */}
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

            {/* 3 · Net Cash Flow */}
            <Card className="border-gray-200">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Net Cash Flow</p>
                <p className={cn("text-2xl font-bold mt-1", ncf.actual >= 0 ? "text-emerald-600" : "text-red-600")}>
                  {fmt(ncf.actual)}
                </p>
                <p className="text-xs text-gray-400 mt-1.5">Bgt {fmt(ncf.budget)}</p>
                <p className={cn("text-xs font-semibold mt-0.5", varColor(ncf.actual - ncf.budget, false))}>
                  {varStr(ncf.actual - ncf.budget)}
                </p>
              </CardContent>
            </Card>

            {/* 4 · Expense Ratio */}
            <Card className="border-gray-200">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Expense Ratio</p>
                <p className={cn("text-2xl font-bold mt-1",
                  expenseRatio == null ? "text-gray-400"
                    : expenseRatio < 50  ? "text-emerald-600"
                    : "text-red-600"
                )}>
                  {expenseRatio != null ? `${expenseRatio.toFixed(1)}%` : "—"}
                </p>
                <p className="text-xs text-gray-400 mt-1.5" title="Operating Expenses / EGI">
                  Oper. Expenses / EGI
                </p>
              </CardContent>
            </Card>

            {/* 5 · DSCR */}
            <Card className="border-gray-200">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">DSCR</p>
                <p className={cn("text-2xl font-bold mt-1",
                  dscr == null ? "text-gray-400"
                    : dscr >= 1.25 ? "text-emerald-600"
                    : dscr >= 1.0  ? "text-amber-600"
                    : "text-red-600"
                )}>
                  {dscr != null ? `${dscr.toFixed(2)}x` : "—"}
                </p>
                <p className="text-xs text-gray-400 mt-1.5" title="NOI / Debt Service">
                  NOI / Debt Service
                </p>
              </CardContent>
            </Card>

          </div>

          {/* Financials table */}
          <Card className="border-gray-200">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Line Item</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Budget</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actual</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* INCOME */}
                    <SectionHeader label="Income" colorClass="bg-blue-50/70 text-blue-700" />
                    {income.map((r) => <FinRow key={r.label} row={r} />)}
                    <FinRow
                      row={{ label: "Total Effective Gross Income", actual: egi.actual, budget: egi.budget, isSummary: true }}
                    />

                    {/* EXPENSES */}
                    <SectionHeader label="Operating Expenses" colorClass="bg-amber-50/60 text-amber-700" />
                    {expenses.map((r) => <FinRow key={r.label} row={r} isExpense />)}
                    <FinRow
                      row={{ label: "Total Operating Expenses", actual: expensesSum.actual, budget: expensesSum.budget, isSummary: true }}
                      isExpense
                    />

                    {/* NOI */}
                    <SummaryRow label="Net Operating Income (NOI)" actual={noi.actual} budget={noi.budget} />

                    {/* BELOW THE LINE */}
                    <SectionHeader label="Below the Line" colorClass="bg-slate-50/60 text-slate-600" />
                    {belowLine.map((r) => <FinRow key={r.label} row={r} isExpense />)}
                    <FinRow
                      row={{ label: "Total Below the Line", actual: belowLineSum.actual, budget: belowLineSum.budget, isSummary: true }}
                      isExpense
                    />

                    {/* NET CASH FLOW */}
                    <SummaryRow label="Net Cash Flow" actual={ncf.actual} budget={ncf.budget} />
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 3 · LEASING
        ══════════════════════════════════════════════════════════════════ */}
        <section id="leasing" className="scroll-mt-28">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Lease Expirations & Renewals</h2>
            <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-1">
              Updated {SNAPSHOT.asOf}
            </span>
          </div>

          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {(() => {
              const totalExpiring = LEASING.reduce((s, l) => s + l.expiring, 0);
              const totalRenewed  = LEASING.reduce((s, l) => s + l.renewed, 0);
              const totalVacating = LEASING.reduce((s, l) => s + l.vacating, 0);
              const totalUnknown  = LEASING.reduce((s, l) => s + l.unknown, 0);
              return [
                { label: "Expiring (Mar–Jun)",  value: `${totalExpiring} leases`, color: "text-gray-900" },
                { label: "Renewed",             value: `${totalRenewed}`,         color: "text-emerald-600" },
                { label: "Vacating / NTV",      value: `${totalVacating}`,        color: "text-red-600" },
                { label: "Pending / Unknown",   value: `${totalUnknown + LEASING.reduce((s, l) => s + l.mtm, 0)}`, color: "text-amber-600" },
              ];
            })().map(({ label, value, color }) => (
              <Card key={label} className="border-gray-200">
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs font-medium text-gray-500">{label}</p>
                  <p className={cn("text-xl font-bold mt-0.5", color)}>{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Month-by-month breakdown */}
          <Card className="border-gray-200">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {["Month", "Expiring", "Renewed", "Vacating", "MTM", "Unknown"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {LEASING.map((row) => (
                      <tr key={row.month} className="hover:bg-gray-50/60">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.month}</td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900">{row.expiring}</td>
                        <td className="px-4 py-3 text-sm">
                          {row.renewed > 0
                            ? <span className="font-semibold text-emerald-600">{row.renewed}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {row.vacating > 0
                            ? <span className="font-semibold text-red-600">{row.vacating}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {row.mtm > 0
                            ? <span className="font-semibold text-amber-600">{row.mtm}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {row.unknown > 0
                            ? <span className="font-semibold text-amber-600">{row.unknown}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td className="px-4 py-2.5 text-xs font-bold text-gray-600 uppercase">Total</td>
                      <td className="px-4 py-2.5 font-bold text-gray-900">{LEASING.reduce((s, l) => s + l.expiring, 0)}</td>
                      <td className="px-4 py-2.5 font-bold text-emerald-600">{LEASING.reduce((s, l) => s + l.renewed, 0)}</td>
                      <td className="px-4 py-2.5 font-bold text-red-600">{LEASING.reduce((s, l) => s + l.vacating, 0)}</td>
                      <td className="px-4 py-2.5 font-bold text-amber-600">{LEASING.reduce((s, l) => s + l.mtm, 0)}</td>
                      <td className="px-4 py-2.5 font-bold text-amber-600">{LEASING.reduce((s, l) => s + l.unknown, 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 4 · RENOVATIONS (Live from Google Sheets)
        ══════════════════════════════════════════════════════════════════ */}
        <section id="renovations" className="scroll-mt-28">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Unit Renovations</h2>
            <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
              Live from Google Sheets
            </span>
          </div>

          {sheetsLoading ? (
            <Card className="border-gray-200">
              <CardContent className="py-12 flex items-center justify-center gap-2 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading renovation data...</span>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                  { label: "Total Units",     value: `${renoUnits.length}`, color: "text-gray-900" },
                  { label: "In Progress",      value: `${renoInProgress.length}`, color: "text-blue-600" },
                  { label: "Upcoming",         value: `${renoUpcoming.length}`, color: "text-amber-600" },
                  { label: "Complete",         value: `${renoComplete.length}`, color: "text-emerald-600" },
                ].map(({ label, value, color }) => (
                  <Card key={label} className="border-gray-200">
                    <CardContent className="pt-4 pb-3">
                      <p className="text-xs font-medium text-gray-500">{label}</p>
                      <p className={cn("text-xl font-bold mt-0.5", color)}>{value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Unit status breakdown */}
              <Card className="border-gray-200 mb-5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-700">Status Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  {[
                    { label: "Complete",    count: renoComplete.length,   color: "bg-emerald-500" },
                    { label: "In Progress", count: renoInProgress.length, color: "bg-blue-500"    },
                    { label: "Upcoming",    count: renoUpcoming.length,   color: "bg-amber-400"   },
                  ].map(({ label, count, color }) => (
                    <div key={label} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                      <div className="flex items-center gap-2.5">
                        <div className={cn("h-3 w-3 rounded-full", color)} />
                        <span className="text-sm text-gray-700">{label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div className={cn("h-full rounded-full", color)} style={{ width: `${renoUnits.length > 0 ? (count / renoUnits.length) * 100 : 0}%` }} />
                        </div>
                        <span className="text-sm font-semibold text-gray-900 w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-gray-400 mt-3 text-center">{renoUnits.length} units in renovation pipeline</p>
                </CardContent>
              </Card>

              {/* Unit log */}
              <Card className="border-gray-200">
                <CardHeader className="pb-0">
                  <CardTitle className="text-sm font-semibold text-gray-700">Unit Renovation Log</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {["Unit", "Floorplan", "Move-Out", "Start", "Promise", "Status", "Budget", "Notes"].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {renoUnits.map((u) => (
                          <tr key={u.unit} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-mono text-xs font-semibold text-gray-800">{u.unit}</td>
                            <td className="px-4 py-2.5 text-gray-600">{u.floorplan}</td>
                            <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{u.moveOut || "—"}</td>
                            <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{u.startDate || "—"}</td>
                            <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{u.promiseDate || "—"}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1.5">
                                {renoStatusIcon(u.status)}
                                <Badge className={cn("text-xs border", renoStatusBadge(u.status))}>
                                  {u.status}
                                </Badge>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 font-medium text-gray-900">{u.budget > 0 ? fmt(u.budget) : "—"}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[250px] truncate" title={u.notes}>{u.notes || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 5 · CAPEX (Live from Google Sheets)
        ══════════════════════════════════════════════════════════════════ */}
        <section id="capex" className="scroll-mt-28 pb-16">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h2 className="text-lg font-bold text-gray-900">CapEx</h2>
            <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
              Live from Google Sheets
            </span>
          </div>

          {sheetsLoading ? (
            <Card className="border-gray-200">
              <CardContent className="py-12 flex items-center justify-center gap-2 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading CapEx data...</span>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
                {[
                  { label: "Total CapEx Budget",  value: fmt(totalCapexBudget), color: "text-gray-900" },
                  { label: "Total Actual Spent",   value: fmt(totalCapexActual), color: totalCapexActual > 0 ? "text-blue-700" : "text-gray-400" },
                  { label: "Line Items",           value: `${capexItems.length}`, color: "text-gray-900" },
                ].map(({ label, value, color }) => (
                  <Card key={label} className="border-gray-200">
                    <CardContent className="pt-4 pb-3">
                      <p className="text-xs font-medium text-gray-500">{label}</p>
                      <p className={cn("text-xl font-bold mt-0.5", color)}>{value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* CapEx items by phase */}
              <Card className="border-gray-200">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {["Item", "Phase", "Underwriting", "Actual", "Notes"].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {capexPhases.map((phase) => {
                          const phaseItems = capexItems.filter((c) => c.phase === phase);
                          if (phaseItems.length === 0) return null;
                          const phaseTotal = phaseItems.reduce((s, c) => s + c.underwriting, 0);
                          const phaseColor =
                            phase === "Immediate" ? "bg-red-50/60 text-red-700" :
                            phase === "Unit Renovations" ? "bg-blue-50/60 text-blue-700" :
                            phase === "Year 1" ? "bg-amber-50/60 text-amber-700" :
                            phase === "As-Needed" ? "bg-purple-50/60 text-purple-700" :
                            "bg-slate-50/60 text-slate-600";
                          return (
                            <React.Fragment key={phase}>
                              <tr className={cn("border-t-2 border-gray-200", phaseColor)}>
                                <td colSpan={2} className="px-4 py-2 text-xs font-bold uppercase tracking-wider">{phase}</td>
                                <td className="px-4 py-2 text-xs font-bold text-right">{fmt(phaseTotal)}</td>
                                <td colSpan={2} />
                              </tr>
                              {phaseItems.map((c) => (
                                <tr key={c.item} className="border-t border-gray-100 hover:bg-gray-50/60">
                                  <td className="px-4 py-2.5 pl-8 text-sm text-gray-700">{c.item}</td>
                                  <td className="px-4 py-2.5 text-xs text-gray-400">{c.phase}</td>
                                  <td className="px-4 py-2.5 text-sm text-right font-medium text-gray-900">{fmt(c.underwriting)}</td>
                                  <td className="px-4 py-2.5 text-sm text-right font-medium text-gray-600">{c.actual > 0 ? fmt(c.actual) : "—"}</td>
                                  <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[300px] truncate" title={c.notes}>{c.notes || "—"}</td>
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-gray-800">
                        <tr>
                          <td colSpan={2} className="px-4 py-3 text-sm font-bold text-white">Total CapEx</td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-white">{fmt(totalCapexBudget)}</td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-gray-300">{totalCapexActual > 0 ? fmt(totalCapexActual) : "—"}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
