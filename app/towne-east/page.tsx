"use client";

import React, { useState, useCallback, useEffect } from "react";
import { MapPin, Home, Clock, RefreshCw, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import RenovationSection from "@/components/RenovationSection";
import CapExSection from "@/components/CapExSection";
import type { TowneEastMetrics } from "@/lib/towne-east-metrics";

// ─── EXTRAS TYPES (from supplemental platform reports) ───────────────────────
interface DelinquencyExtras {
  currentMonthCharges: number;
  currentMonthDelinquency: number;
  collectedOnAllOpenCharges: number;
  delinquencyAllOpenCharges: number;
  aiMessagesSent: number;
  emailMessagesCount: number;
  smsMessagesCount: number;
  hoursSaved: number;
  emailEngagementRate: number;
  smsEngagementRate: number;
  openTasksCount: number;
  openTasksAmount: number;
  oldestTaskDays: number;
  unresponsiveCount: number;
  unresponsiveAmount: number;
  promiseToPayCount: number;
  promiseToPayAmount: number;
}
interface MaintenanceExtras {
  totalWorkOrdersOpened: number;
  aiWorkOrdersOpened: number;
  outstandingWorkOrders: number;
  workOrdersCompleted: number;
  completionRatePct: number;
  completedWithin2DaysPct: number;
  medianTimeToCompleteDays: number;
  completedSameDay: number;
  completed1to2Days: number;
  completed3to7Days: number;
  completedOver7Days: number;
  aiSubmissionPct: number;
}
interface LeasingExtras {
  leads: number;
  toursBooked: number;
  toursAttended: number;
  applicationsStarted: number;
  leasesSigned: number;
  aiMessages: number;
  hoursSaved: number;
  leadToSignedRate: number;
  tourToLeaseRate: number;
}
interface TowneEastExtras {
  delinquency?: DelinquencyExtras;
  maintenance?: MaintenanceExtras;
  leasing?: LeasingExtras;
}

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
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n: number) { return `${n.toFixed(1)}%`; }

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

// ─── HARDCODED FINANCIALS — March 2026 (partial month, acquired 3/16/2026) ───
const INCOME: Record<Month, FinRow[]> = {
  mar: [
    { label: "Gross Potential Rent",  actual:  46_076, budget: 109_000 },
    { label: "Loss / Gain to Leases", actual:       0, budget:  -4_850 },
    { label: "Vacancy Loss",          actual:       0, budget:  -5_450 },
    { label: "Write-Offs / Bad Debt", actual:       0, budget:  -1_562 },
    { label: "Other Revenue",         actual:       0, budget:   7_600 },
  ],
};

const EXPENSES: Record<Month, FinRow[]> = {
  mar: [
    { label: "Personnel",             actual:       0, budget: 12_514 },
    { label: "Management Fees",       actual:       0, budget:  3_142 },
    { label: "Administrative",        actual:       0, budget:  2_284 },
    { label: "Leasing",               actual:      22, budget:  2_346 },
    { label: "Utilities",             actual:      10, budget:  2_309 },
    { label: "Services",              actual:       0, budget:     42 },
    { label: "Cleaning & Decorating", actual:       0, budget:    975 },
    { label: "Repairs & Maintenance", actual:       0, budget:  2_115 },
    { label: "Property Taxes",        actual:   3_190, budget:  7_833 },
    { label: "Property Insurance",    actual:   4_010, budget:  4_867 },
  ],
};

const BELOW_LINE: Record<Month, FinRow[]> = {
  mar: [
    { label: "Debt Service – Principal & Interest", actual: 14_433, budget: 25_361 },
    { label: "Replacement Reserves",               actual:      0, budget:  2_802 },
  ],
};

const OCCUPANCY: Record<Month, { actual: number; budget: number }> = {
  mar: { actual: 96.0, budget: 95.0 },
};

// ─── CACHE ───────────────────────────────────────────────────────────────────
const CACHE_KEY    = "te-metrics-cache-v1";
const CACHE_TS_KEY = "te-metrics-cache-ts-v1";

function saveCache(uploadedAt: string, metrics: TowneEastMetrics) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(metrics));
    localStorage.setItem(CACHE_TS_KEY, uploadedAt);
  } catch {}
}

function loadCache(): { metrics: TowneEastMetrics; uploadedAt: string } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const ts  = localStorage.getItem(CACHE_TS_KEY);
    if (!raw || !ts) return null;
    return { metrics: JSON.parse(raw) as TowneEastMetrics, uploadedAt: ts };
  } catch { return null; }
}

// ─── SERVER SNAPSHOT SHAPE ───────────────────────────────────────────────────
interface ServerSnapshot {
  uploadedAt: string;
  metricsUrl: string | null;
  urls: { rentRoll: string; availability: string; residentBalances: string };
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

function StatCard({ label, value, sub, color = "text-gray-900" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <Card className="border-gray-200">
      <CardContent className="pt-4 pb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
        <p className={cn("text-2xl font-bold mt-1", color)}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function TowneEastPage() {
  const [month] = useState<Month>("mar");
  const [metrics, setMetrics]         = useState<TowneEastMetrics | null>(null);
  const [extras, setExtras]           = useState<TowneEastExtras | null>(null);
  const [syncStatus, setSyncStatus]   = useState<"loading" | "idle" | "error">("loading");
  const [syncError, setSyncError]     = useState<string | null>(null);
  const [asOf, setAsOf]               = useState<string | null>(null);

  useEffect(() => {
    const cached = loadCache();
    if (cached) { setMetrics(cached.metrics); setAsOf(cached.uploadedAt); }

    (async () => {
      try {
        const res  = await fetch("/api/towne-east/snapshot", { cache: "no-store" });
        if (!res.ok) throw new Error(`Server ${res.status}`);
        const data = await res.json() as { snapshot: ServerSnapshot | null; configured?: boolean };

        if (!data.snapshot) { setSyncStatus("idle"); return; }

        setAsOf(data.snapshot.uploadedAt);

        if (cached && cached.uploadedAt === data.snapshot.uploadedAt) {
          setSyncStatus("idle");
          return;
        }

        let computed: TowneEastMetrics;
        if (data.snapshot.metricsUrl) {
          const mres  = await fetch(data.snapshot.metricsUrl);
          const mjson = await mres.json() as { uploadedAt: string; metrics: TowneEastMetrics };
          computed = mjson.metrics;
        } else {
          const { parseRentRoll, parseAvailability, parseResidentBalances } = await import("@/lib/grove-parsers");
          const { computeTowneEastMetrics } = await import("@/lib/towne-east-metrics");
          const [rr, av, rb] = await Promise.all([
            fetch(data.snapshot.urls.rentRoll).then((r) => r.arrayBuffer()),
            fetch(data.snapshot.urls.availability).then((r) => r.arrayBuffer()),
            fetch(data.snapshot.urls.residentBalances).then((r) => r.arrayBuffer()),
          ]);
          computed = computeTowneEastMetrics(parseRentRoll(rr), parseAvailability(av), parseResidentBalances(rb));
        }

        setMetrics(computed);
        saveCache(data.snapshot.uploadedAt, computed);
        setSyncStatus("idle");
      } catch (err) {
        setSyncStatus("error");
        setSyncError(err instanceof Error ? err.message : "Failed to load");
      }
    })();

    // Fetch supplemental extras (delinquency platform, maintenance, leasing CRM) in parallel
    fetch("/api/towne-east/extras", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { extras?: TowneEastExtras }) => { if (d.extras) setExtras(d.extras); })
      .catch(() => {});
  }, []);

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

  const isLoading = syncStatus === "loading" && !metrics;

  const asOfLabel = asOf
    ? new Date(asOf).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

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
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {syncStatus === "loading" && (
                <span className="flex items-center gap-1"><RefreshCw className="h-3.5 w-3.5 animate-spin" />Syncing…</span>
              )}
              {syncStatus === "error" && (
                <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="h-3.5 w-3.5" />{syncError}</span>
              )}
              {asOfLabel && syncStatus !== "loading" && (
                <span className="text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-1">Data as of {asOfLabel}</span>
              )}
            </div>
          </div>
          <nav className="flex gap-0 -mb-px overflow-x-auto">
            {(["Snapshot", "Financials", "Leasing", "Maintenance", "Renovations", "CapEx"] as const).map((label) => (
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
            {asOfLabel && <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-1">Updated {asOfLabel}</span>}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="border-gray-200"><CardContent className="pt-4 pb-3">
                  <div className="h-3 w-20 bg-gray-200 rounded animate-pulse mb-2" />
                  <div className="h-7 w-16 bg-gray-200 rounded animate-pulse" />
                </CardContent></Card>
              ))}
            </div>
          ) : metrics ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <StatCard
                  label="Occupancy"
                  value={fmtPct(metrics.physicalOccupancyPct)}
                  sub={`${metrics.occupiedCount + metrics.occupiedNTVCount} / 100 units`}
                  color={metrics.physicalOccupancyPct >= 95 ? "text-emerald-600" : "text-amber-600"}
                />
                <StatCard
                  label="Total Charged"
                  value={fmt(metrics.totalCharged)}
                  sub="Current month lease charges"
                />
                <StatCard
                  label="Collected"
                  value={fmt(metrics.totalCollected)}
                  sub={`${fmtPct(metrics.collectionRatePct)} of charged`}
                  color="text-emerald-600"
                />
                <Card className="border-red-100 bg-red-50/30">
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">Delinquent Balance</p>
                    <p className="text-2xl font-bold mt-1 text-red-600">{fmt(metrics.delinquentBalance)}</p>
                    <p className="text-xs text-red-400 mt-1">{metrics.delinquentCount} unit{metrics.delinquentCount !== 1 ? "s" : ""} past due</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-gray-200"><CardContent className="p-0"><div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200"><tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Delinquency Breakdown</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">% of Total</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {metrics.delinquentBalance > 0 && (() => {
                      const rows = [
                        { label: "Prior Period Balance (carried over)", amount: metrics.priorPeriodBalance },
                        { label: "New Delinquency This Period",         amount: metrics.newDelinquencyThisPeriod },
                      ].filter(r => r.amount > 0);
                      return rows.map((row) => (
                        <tr key={row.label} className="hover:bg-gray-50/60">
                          <td className="px-4 py-2.5 text-sm text-gray-700">{row.label}</td>
                          <td className="px-4 py-2.5 text-sm text-right font-medium text-red-600">{fmt(row.amount)}</td>
                          <td className="px-4 py-2.5 text-sm text-right text-gray-500">
                            {metrics.delinquentBalance > 0 ? `${((row.amount / metrics.delinquentBalance) * 100).toFixed(1)}%` : "—"}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                  <tfoot className="bg-gray-800"><tr>
                    <td className="px-4 py-2.5 text-sm font-bold text-white">Total Delinquent</td>
                    <td className="px-4 py-2.5 text-sm text-right font-bold text-red-400">{fmt(metrics.delinquentBalance)}</td>
                    <td className="px-4 py-2.5 text-sm text-right font-bold text-gray-300">100%</td>
                  </tr></tfoot>
                </table>
              </div></CardContent></Card>

              {metrics.topDelinquents.length > 0 && (
                <Card className="border-gray-200 mt-4"><CardContent className="p-0"><div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200"><tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Unit</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Resident</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Balance</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {metrics.topDelinquents.map((d) => (
                        <tr key={d.unit} className="hover:bg-gray-50/60">
                          <td className="px-4 py-2 text-sm font-mono font-semibold text-gray-900">{d.unit}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{d.name}</td>
                          <td className="px-4 py-2 text-sm text-right font-medium text-red-600">{fmt(d.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div></CardContent></Card>
              )}

              {/* AI Collections platform data */}
              {extras?.delinquency && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard label="Open Tasks" value={String(extras.delinquency.openTasksCount)} sub={`${fmt(extras.delinquency.openTasksAmount)} at risk · oldest ${extras.delinquency.oldestTaskDays}d`} color={extras.delinquency.openTasksCount > 10 ? "text-amber-600" : "text-gray-900"} />
                  <StatCard label="Unresponsive" value={String(extras.delinquency.unresponsiveCount)} sub={fmt(extras.delinquency.unresponsiveAmount)} color={extras.delinquency.unresponsiveCount > 0 ? "text-red-600" : "text-gray-900"} />
                  <StatCard label="Promise to Pay" value={String(extras.delinquency.promiseToPayCount)} sub={fmt(extras.delinquency.promiseToPayAmount)} color="text-amber-600" />
                  <StatCard label="AI Messages Sent" value={extras.delinquency.aiMessagesSent.toLocaleString()} sub={`${extras.delinquency.hoursSaved}h saved · SMS ${extras.delinquency.smsEngagementRate}% open`} color="text-blue-600" />
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
              No data yet — forward the three OneSite reports to your email agent to populate this section.
            </div>
          )}
        </section>

        {/* ══ SECTION 2 · FINANCIALS (Monthly, hardcoded) ══ */}
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
            {asOfLabel && <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-1">Updated {asOfLabel}</span>}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="border-gray-200"><CardContent className="pt-4 pb-3">
                  <div className="h-3 w-20 bg-gray-200 rounded animate-pulse mb-2" />
                  <div className="h-6 w-10 bg-gray-200 rounded animate-pulse" />
                </CardContent></Card>
              ))}
            </div>
          ) : metrics ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <StatCard label="Expiring (90 days)"  value={`${metrics.expiring90d} leases`} />
                <StatCard label="Signed MTD"          value={`${metrics.signedLeasesMTD}`}      color="text-emerald-600" />
                <StatCard label="Vacating / NTV"      value={`${metrics.moveOutsNTVCount}`}      color="text-red-600" />
                <StatCard label="Month-to-Month"      value={`${metrics.monthToMonthCount}`}     color="text-amber-600" />
              </div>

              <Card className="border-gray-200"><CardContent className="p-0"><div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200"><tr>
                    {["Month", "Expiring", "NTV / Vacating", "Month-to-Month"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {metrics.leaseExpirationByMonth.map((row) => (
                      <tr key={row.month} className="hover:bg-gray-50/60">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.month}</td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900">{row.expiring}</td>
                        <td className="px-4 py-3 text-sm">{row.ntv > 0 ? <span className="font-semibold text-red-600">{row.ntv}</span> : <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-sm">{row.mtm > 0 ? <span className="font-semibold text-amber-600">{row.mtm}</span> : <span className="text-gray-300">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200"><tr>
                    <td className="px-4 py-2.5 text-xs font-bold text-gray-600 uppercase">Total (6 mo)</td>
                    <td className="px-4 py-2.5 font-bold text-gray-900">{metrics.leaseExpirationByMonth.reduce((s, r) => s + r.expiring, 0)}</td>
                    <td className="px-4 py-2.5 font-bold text-red-600">{metrics.leaseExpirationByMonth.reduce((s, r) => s + r.ntv, 0)}</td>
                    <td className="px-4 py-2.5 font-bold text-amber-600">{metrics.leaseExpirationByMonth.reduce((s, r) => s + r.mtm, 0)}</td>
                  </tr></tfoot>
                </table>
              </div></CardContent></Card>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
              No leasing data yet — forward the OneSite reports to your email agent.
            </div>
          )}

          {/* CRM leasing funnel */}
          {extras?.leasing && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Leasing Funnel (CRM)</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: "Leads",        value: extras.leasing.leads },
                  { label: "Tours Booked", value: extras.leasing.toursBooked },
                  { label: "Tours Attended", value: extras.leasing.toursAttended },
                  { label: "Applications", value: extras.leasing.applicationsStarted },
                  { label: "Leases Signed", value: extras.leasing.leasesSigned, color: "text-emerald-600" },
                ].map(({ label, value, color }) => (
                  <Card key={label} className="border-gray-200">
                    <CardContent className="pt-4 pb-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
                      <p className={cn("text-2xl font-bold mt-1", color ?? "text-gray-900")}>{value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {extras.leasing.leads > 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  Lead→Signed: {extras.leasing.leadToSignedRate.toFixed(1)}% · AI Messages: {extras.leasing.aiMessages} · Hours Saved: {extras.leasing.hoursSaved}
                </p>
              )}
            </div>
          )}
        </section>

        {/* ══ SECTION 3.5 · MAINTENANCE ══ */}
        <section id="maintenance" className="scroll-mt-28">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Maintenance</h2>
            {asOfLabel && <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-1">Updated {asOfLabel}</span>}
          </div>
          {extras?.maintenance ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <StatCard
                  label="Opened This Period"
                  value={String(extras.maintenance.totalWorkOrdersOpened)}
                  sub={`${extras.maintenance.aiWorkOrdersOpened} via AI`}
                />
                <StatCard
                  label="Outstanding"
                  value={String(extras.maintenance.outstandingWorkOrders)}
                  color={extras.maintenance.outstandingWorkOrders > 5 ? "text-amber-600" : "text-gray-900"}
                />
                <StatCard
                  label="Completion Rate"
                  value={fmtPct(extras.maintenance.completionRatePct)}
                  sub={`Within 2 days: ${fmtPct(extras.maintenance.completedWithin2DaysPct)}`}
                  color={extras.maintenance.completionRatePct >= 90 ? "text-emerald-600" : "text-amber-600"}
                />
                <StatCard
                  label="Median Days to Close"
                  value={extras.maintenance.medianTimeToCompleteDays.toFixed(1)}
                  color={extras.maintenance.medianTimeToCompleteDays <= 3 ? "text-emerald-600" : "text-amber-600"}
                />
              </div>
              <Card className="border-gray-200"><CardContent className="p-0"><div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200"><tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Time to Close</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Work Orders</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">% of Completed</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {(() => {
                      const maint = extras.maintenance!;
                      return [
                        { label: "Same day",   count: maint.completedSameDay },
                        { label: "1–2 days",   count: maint.completed1to2Days },
                        { label: "3–7 days",   count: maint.completed3to7Days },
                        { label: "Over 7 days", count: maint.completedOver7Days, warn: true },
                      ].map(({ label, count, warn }) => (
                        <tr key={label} className="hover:bg-gray-50/60">
                          <td className="px-4 py-2.5 text-sm text-gray-700">{label}</td>
                          <td className="px-4 py-2.5 text-sm text-right font-medium text-gray-900">{count}</td>
                          <td className={cn("px-4 py-2.5 text-sm text-right", warn && count > 0 ? "text-red-500 font-semibold" : "text-gray-500")}>
                            {maint.workOrdersCompleted > 0
                              ? fmtPct((count / maint.workOrdersCompleted) * 100)
                              : "—"}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200"><tr>
                    <td className="px-4 py-2.5 text-xs font-bold text-gray-600 uppercase">Total Completed</td>
                    <td className="px-4 py-2.5 font-bold text-gray-900 text-right">{extras.maintenance.workOrdersCompleted}</td>
                    <td className="px-4 py-2.5 font-bold text-gray-500 text-right">100%</td>
                  </tr></tfoot>
                </table>
              </div></CardContent></Card>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
              No maintenance data yet — forward the maintenance summary export to your email agent.
            </div>
          )}
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
