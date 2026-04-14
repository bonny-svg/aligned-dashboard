"use client";

import { useState } from "react";
import { MapPin, Home, Clock, CheckCircle2, Circle, Target, TrendingUp, Shield, Wrench, AlertTriangle, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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

// ─── SECTION 1: STABILIZATION CHECKLIST ──────────────────────────────────────
const STABILIZATION_ITEMS = [
  { label: "Receive COO", done: true },
  { label: "Payment from Seller on outstanding closing items", done: true },
  { label: "Confirm stair rebuild compliance", done: false },
  { label: "Confirm road 1516 rebuild and plan", done: false },
  { label: "Plumbing repair complete", done: false },
  { label: "Tenant letters sent out", done: true },
];

// ─── SECTION 2: COLLECTIONS & RENEWALS (from flash report) ───────────────────
// April Wk 1 & Wk 2 data from the Weekly Flash Report
const COLLECTIONS_DATA = {
  wk1: {
    current0_30: 34_368,
    days31_60: 11_556,
    days61_90: 0,
    days90plus: 0,
    totalDelinquent: 47_478,
    delinquencyPctGPR: 73.2,
    evictionsFiled: 0,
    evictionsCompleted: 0,
  },
  wk2: {
    current0_30: 25_506,
    days31_60: 4_219,
    days61_90: 0,
    days90plus: 0,
    totalDelinquent: 29_726,
    delinquencyPctGPR: 73.4,
    evictionsFiled: 0,
    evictionsCompleted: 0,
  },
};

const RENEWALS_DATA = {
  leasesExpiringThisMonth: 3,
  renewalOffersSent: 6,
  renewalsSigned: 0,
  renewalRate: 0,
  avgRenewalIncrease: 30,
  nonRenewals: 2,
};

// ─── SECTION 3: LEASING VELOCITY (April Flash Report) ────────────────────────
const LEASING_APRIL = {
  wk1: {
    leads: 2, tours: 1, applications: 1, approvals: 1, newLeases: 1, moveIns: 0, moveOuts: 3,
  },
  wk2: {
    leads: 0, tours: 0, applications: 0, approvals: 0, newLeases: 0, moveIns: 1, moveOuts: 3,
  },
  mtd: {
    leads: 2, tours: 1, applications: 1, approvals: 1, newLeases: 1, moveIns: 1, moveOuts: 6,
  },
  occupancy: { physical: 91, economic: 73.3 },
  netAbsorption: -5,
  vacantRentReady: 1,
  vacantDown: 8,
  unitsOnNotice: 3,
  preLeased: 0,
  gpr: 106_100,
  avgEffectiveRent: 1_061,
  concessions: 150,
};

// ─── SECTION 4: 90-DAY PCA REPAIRS (LENDER COMPLIANCE) ──────────────────────
const PCA_REPAIRS = [
  { id: 1, item: "Drainage / Erosion Repair", location: "Buildings 1, 2, 6, 7 — slab edge erosion, foundation undermining", estimate: 7_500, status: "Bids Requested" },
  { id: 2, item: "Asphalt — Sectional Replacement", location: "SW portions — drive lanes & parking near Buildings 7, 8, 10", estimate: 10_600, status: "Bids Requested" },
  { id: 3, item: "Sidewalks — Trip Hazard Repair", location: "3 locations: (2) panels near Bldg 10, (1) near Bldg 6", estimate: 1_500, status: "Bids Requested" },
  { id: 4, item: "Sidewalks — Handrail Installation", location: "East Pool Gate entry + Building 7 steps", estimate: 0, status: "Bids Requested", note: "Incl. in sidewalk line" },
  { id: 5, item: "Pool Resurfacing", location: "Pool plaster/lining — visible delamination", estimate: 7_000, status: "Bids Requested" },
  { id: 6, item: "Stair Tread Repair — Building 9", location: "Broken stair tread at Bldg 9 exterior stairs", estimate: 1_500, status: "Bids Requested" },
  { id: 7, item: "Mold / Water Damage Repair", location: "Bldg 6 storage room + Unit 811 restroom", estimate: 1_500, status: "Bids Requested", priority: true },
  { id: 8, item: "ADA Compliance", location: "Leasing office: accessible restroom, door hardware, parking signage", estimate: 2_500, status: "Bids Requested" },
];

// ─── EXISTING DASHBOARD DATA (carried over) ──────────────────────────────────
type Month = "mar" | "feb" | "jan";

interface FinRow {
  label: string;
  actual: number;
  budget: number;
  isSummary?: boolean;
  isExpense?: boolean;
}

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
    { label: "Total Charged",           actual:  89_000, budget:  89_000 },
    { label: "Total Collected",         actual:  75_900, budget:  80_100 },
    { label: "Prepaid / Credits Applied", actual: 1_200, budget:   1_000 },
    { label: "NSF / Returned Checks",   actual:    -450, budget:    -200 },
  ],
  feb: [
    { label: "Total Charged",           actual:  89_000, budget:  89_000 },
    { label: "Total Collected",         actual:  77_800, budget:  80_100 },
    { label: "Prepaid / Credits Applied", actual:   950, budget:   1_000 },
    { label: "NSF / Returned Checks",   actual:    -300, budget:    -200 },
  ],
  jan: [
    { label: "Total Charged",           actual:  89_000, budget:  89_000 },
    { label: "Total Collected",         actual:  79_500, budget:  80_100 },
    { label: "Prepaid / Credits Applied", actual: 1_000, budget:   1_000 },
    { label: "NSF / Returned Checks",   actual:    -200, budget:    -200 },
  ],
};

const EXPENSES: Record<Month, FinRow[]> = {
  mar: [
    { label: "Management Fee",               actual:  7_100, budget:  7_120 },
    { label: "Repairs & Maintenance",        actual:  8_450, budget:  7_500 },
    { label: "Make Ready / Turnover",        actual:  3_200, budget:  2_800 },
    { label: "Landscaping & Grounds",        actual:  1_100, budget:  1_000 },
    { label: "Pest Control",                 actual:    650, budget:    600 },
    { label: "Insurance",                    actual:  4_200, budget:  4_200 },
    { label: "Property Taxes",               actual:  7_800, budget:  7_800 },
    { label: "Utilities – Water / Sewer",    actual:  3_100, budget:  2_800 },
    { label: "Utilities – Electric (Common)", actual: 1_450, budget:  1_200 },
    { label: "Administrative",               actual:  2_200, budget:  2_000 },
  ],
  feb: [
    { label: "Management Fee",               actual:  7_120, budget:  7_120 },
    { label: "Repairs & Maintenance",        actual:  7_800, budget:  7_500 },
    { label: "Make Ready / Turnover",        actual:  2_500, budget:  2_800 },
    { label: "Landscaping & Grounds",        actual:  1_000, budget:  1_000 },
    { label: "Pest Control",                 actual:    600, budget:    600 },
    { label: "Insurance",                    actual:  4_200, budget:  4_200 },
    { label: "Property Taxes",               actual:  7_800, budget:  7_800 },
    { label: "Utilities – Water / Sewer",    actual:  2_900, budget:  2_800 },
    { label: "Utilities – Electric (Common)", actual: 1_300, budget:  1_200 },
    { label: "Administrative",               actual:  2_050, budget:  2_000 },
  ],
  jan: [
    { label: "Management Fee",               actual:  7_120, budget:  7_120 },
    { label: "Repairs & Maintenance",        actual:  7_500, budget:  7_500 },
    { label: "Make Ready / Turnover",        actual:  2_800, budget:  2_800 },
    { label: "Landscaping & Grounds",        actual:  1_000, budget:  1_000 },
    { label: "Pest Control",                 actual:    600, budget:    600 },
    { label: "Insurance",                    actual:  4_200, budget:  4_200 },
    { label: "Property Taxes",               actual:  7_800, budget:  7_800 },
    { label: "Utilities – Water / Sewer",    actual:  2_800, budget:  2_800 },
    { label: "Utilities – Electric (Common)", actual: 1_200, budget:  1_200 },
    { label: "Administrative",               actual:  2_000, budget:  2_000 },
  ],
};

const BELOW_LINE: Record<Month, FinRow[]> = {
  mar: [
    { label: "Debt Service – Principal & Interest", actual: 18_500, budget: 18_500 },
    { label: "Replacement Reserves",               actual:  2_000, budget:  2_000 },
  ],
  feb: [
    { label: "Debt Service – Principal & Interest", actual: 18_500, budget: 18_500 },
    { label: "Replacement Reserves",               actual:  2_000, budget:  2_000 },
  ],
  jan: [
    { label: "Debt Service – Principal & Interest", actual: 18_500, budget: 18_500 },
    { label: "Replacement Reserves",               actual:  2_000, budget:  2_000 },
  ],
};

const DELINQUENCY = [
  { tenant: "Maria Santos",     unit: "114A", balance: 5_820, aging0_30:     0, aging30plus: 5_820, action: "Eviction Filed",  notes: "Filed 2/28. Court date 3/22." },
  { tenant: "Linda Tran",       unit: "308B", balance: 3_750, aging0_30:     0, aging30plus: 3_750, action: "Eviction Filed",  notes: "Second filing this lease term." },
  { tenant: "James Whitfield",  unit: "203B", balance: 3_200, aging0_30: 1_600, aging30plus: 1_600, action: "Payment Plan",   notes: "Paying $400/mo extra since 3/1." },
  { tenant: "Ashley Reyes",     unit: "241C", balance: 2_670, aging0_30:   670, aging30plus: 2_000, action: "Payment Plan",   notes: null },
  { tenant: "Brittany Moore",   unit: "118C", balance: 2_450, aging0_30: 2_450, aging30plus:     0, action: "Notice Sent",   notes: null },
  { tenant: "Kevin Okafor",     unit: "215A", balance: 2_100, aging0_30: 2_100, aging30plus:     0, action: "Notice Sent",   notes: null },
  { tenant: "Darnell Brooks",   unit: "122A", balance: 1_980, aging0_30: 1_980, aging30plus:     0, action: "None",          notes: null },
  { tenant: "Marcus Hill",      unit: "317A", balance: 1_480, aging0_30: 1_480, aging30plus:     0, action: "None",          notes: null },
];

const OCCUPANCY: Record<Month, { actual: number; budget: number }> = {
  mar: { actual: 91.0, budget: 93.0 },
  feb: { actual: 92.0, budget: 93.0 },
  jan: { actual: 93.5, budget: 93.0 },
};

const RENO_SCOPES = [
  { scope: "Kitchen Updates",     budget: 120_000, spent:  75_000, unitsTotal: 40, unitsDone: 25 },
  { scope: "Bathroom Refresh",    budget:  80_000, spent:  50_000, unitsTotal: 40, unitsDone: 25 },
  { scope: "Flooring (LVP)",      budget:  60_000, spent:  40_500, unitsTotal: 40, unitsDone: 25 },
  { scope: "Paint & Fixtures",    budget:  40_000, spent:  25_000, unitsTotal: 40, unitsDone: 25 },
  { scope: "Appliance Package",   budget:  80_000, spent:  28_250, unitsTotal: 40, unitsDone: 10 },
];

const CAPEX_PROJECTS = [
  { item: "Building C Roof Replacement", budget: 45_000, spent: 38_250, pct: 85, status: "In Progress" },
  { item: "HVAC Replacements (5 units)", budget: 18_500, spent: 18_500, pct: 100, status: "Completed"  },
  { item: "Security Camera System",      budget: 12_000, spent: 12_000, pct: 100, status: "Completed"  },
  { item: "Pool Resurfacing & Equipment",budget: 22_000, spent:  3_200, pct: 15,  status: "In Progress" },
  { item: "Parking Lot Seal & Stripe",   budget:  8_500, spent:      0, pct: 0,   status: "On Hold"     },
];

const WORK_ORDERS = [
  { wo: "WO-2001", unit: "114B", cat: "HVAC",      desc: "AC not cooling — possible refrigerant leak",  vendor: "6/1 HVAC Services",   cost: 380,   status: "In Progress" },
  { wo: "WO-2002", unit: "228A", cat: "Plumbing",   desc: "Leak under kitchen sink",                    vendor: "SplashPro Plumbing",  cost: 175,   status: "Open"        },
  { wo: "WO-2003", unit: "301C", cat: "Electrical", desc: "GFCI outlet replacement (bathroom)",         vendor: "QuickFix Electric",   cost: 120,   status: "Completed"   },
  { wo: "WO-2004", unit: "105A", cat: "Appliance",  desc: "Dishwasher not draining",                    vendor: "All Pro Appliance",   cost: 250,   status: "Open"        },
  { wo: "WO-2005", unit: "210B", cat: "Make Ready", desc: "Full unit turn — paint, clean, carpet",      vendor: "In-house",            cost: 1_200, status: "In Progress" },
  { wo: "WO-2006", unit: "317A", cat: "Plumbing",   desc: "Running toilet, slow drain in master bath",  vendor: "SplashPro Plumbing",  cost: 195,   status: "Open"        },
];

// ─── FINANCIAL HELPERS ───────────────────────────────────────────────────────
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

// ─── SUB COMPONENTS ──────────────────────────────────────────────────────────
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
      <td className={cn("px-4 py-3 text-sm text-right font-bold", varColor(variance, false))}>
        {varStr(variance)}
      </td>
    </tr>
  );
}

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

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────
export default function TowneEastFocusPage() {
  const [month, setMonth] = useState<Month>("mar");

  const income      = INCOME[month];
  const collections = COLLECTIONS[month];
  const expenses    = EXPENSES[month];
  const belowLine   = BELOW_LINE[month];

  const incomeSum      = sum(income);
  const collectionsSum = sum(collections);
  const expensesSum    = sum(expenses);
  const belowLineSum   = sum(belowLine);

  const egi = { actual: incomeSum.actual, budget: incomeSum.budget };
  const noi = { actual: egi.actual - expensesSum.actual, budget: egi.budget - expensesSum.budget };
  const ncf = { actual: noi.actual - belowLineSum.actual, budget: noi.budget - belowLineSum.budget };
  const netCollections = { actual: collectionsSum.actual, budget: collectionsSum.budget };

  const occupancy = OCCUPANCY[month];
  const totalDelinquent  = DELINQUENCY.reduce((s, d) => s + d.balance, 0);
  const total30plus      = DELINQUENCY.reduce((s, d) => s + d.aging30plus, 0);
  const totalRenoSpent   = RENO_SCOPES.reduce((s, r) => s + r.spent, 0);
  const totalRenoBudget  = RENO_SCOPES.reduce((s, r) => s + r.budget, 0);
  const totalCapexBudget = CAPEX_PROJECTS.reduce((s, p) => s + p.budget, 0);
  const totalCapexSpent  = CAPEX_PROJECTS.reduce((s, p) => s + p.spent, 0);
  const openWOs          = WORK_ORDERS.filter((w) => w.status !== "Completed").length;

  const stabDone = STABILIZATION_ITEMS.filter(i => i.done).length;
  const stabTotal = STABILIZATION_ITEMS.length;
  const pcaTotal = PCA_REPAIRS.reduce((s, r) => s + r.estimate, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── STICKY HEADER ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3 pt-4 pb-2">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">Towne East Village</h1>
                <Badge className="bg-amber-100 text-amber-800 border border-amber-200 text-xs px-2.5 py-0.5">
                  Stabilization
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-1 text-xs text-gray-500">
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />Converse, TX</span>
                <span className="flex items-center gap-1"><Home className="h-3.5 w-3.5" />100 units</span>
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Focus Dashboard — April 2025</span>
              </div>
            </div>
            <a
              href="/towne-east"
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"
            >
              Full Dashboard <ArrowRight className="h-3 w-3" />
            </a>
          </div>
          <nav className="flex gap-0 -mb-px overflow-x-auto">
            {(["Focus Areas", "Financials", "Delinquency", "Renovations", "CapEx"] as const).map((label) => (
              <button
                key={label}
                onClick={() => {
                  const id = label === "Focus Areas" ? "focus" : label.toLowerCase();
                  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors",
                  label === "Focus Areas"
                    ? "text-amber-700 border-amber-500"
                    : "text-gray-500 hover:text-blue-600 border-transparent hover:border-blue-500"
                )}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10">

        {/* ══════════════════════════════════════════════════════════════════
            FOCUS AREA BANNER
        ══════════════════════════════════════════════════════════════════ */}
        <section id="focus" className="scroll-mt-28">
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-bold text-gray-900">Focus Areas — What Matters Right Now</h2>
            </div>
            <p className="text-sm text-gray-600">
              These 4 priorities drive all decision-making at Towne East. Everything else is noise.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">

            {/* ── 1. STABILIZATION CHECKLIST ──────────────────────────── */}
            <Card className="border-amber-200 bg-white">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Shield className="h-4.5 w-4.5 text-amber-700" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-gray-900">1. Stabilization Checklist</CardTitle>
                      <p className="text-xs text-gray-500">Post-close critical path</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-amber-700">{stabDone}/{stabTotal}</p>
                    <p className="text-xs text-gray-400">complete</p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-2 w-full rounded-full bg-gray-100 mt-3 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all"
                    style={{ width: `${(stabDone / stabTotal) * 100}%` }}
                  />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2.5">
                  {STABILIZATION_ITEMS.map((item) => (
                    <div key={item.label} className={cn(
                      "flex items-start gap-3 py-2 px-3 rounded-lg transition-colors",
                      item.done ? "bg-emerald-50/60" : "bg-red-50/40"
                    )}>
                      {item.done ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="h-5 w-5 text-red-300 flex-shrink-0 mt-0.5" />
                      )}
                      <span className={cn(
                        "text-sm",
                        item.done ? "text-gray-500 line-through" : "text-gray-900 font-medium"
                      )}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ── 2. COLLECTIONS & RENEWALS ───────────────────────────── */}
            <Card className="border-red-200 bg-white">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="h-4.5 w-4.5 text-red-700" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-gray-900">2. Collections & Renewals</CardTitle>
                    <p className="text-xs text-gray-500">April MTD — Flash Report</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {/* Collections snapshot */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Collections (Week 2)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-red-50 rounded-lg p-3">
                      <p className="text-xs text-red-500">Total Delinquent</p>
                      <p className="text-xl font-bold text-red-700">{fmt(COLLECTIONS_DATA.wk2.totalDelinquent)}</p>
                      <p className="text-xs text-emerald-600 mt-0.5">
                        {fmt(COLLECTIONS_DATA.wk1.totalDelinquent - COLLECTIONS_DATA.wk2.totalDelinquent)} collected WoW
                      </p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3">
                      <p className="text-xs text-red-500">Delinquency % of GPR</p>
                      <p className="text-xl font-bold text-red-700">{COLLECTIONS_DATA.wk2.delinquencyPctGPR}%</p>
                      <p className="text-xs text-gray-400 mt-0.5">0–30: {fmt(COLLECTIONS_DATA.wk2.current0_30)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-xs text-gray-500">31–60 Days</p>
                      <p className="text-sm font-bold text-gray-900">{fmt(COLLECTIONS_DATA.wk2.days31_60)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-xs text-gray-500">Evictions Filed</p>
                      <p className="text-sm font-bold text-gray-900">{COLLECTIONS_DATA.wk2.evictionsFiled}</p>
                    </div>
                  </div>
                </div>
                {/* Renewals */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Renewals (April)</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <p className="text-xs text-gray-500">Expiring</p>
                      <p className="text-lg font-bold text-gray-900">{RENEWALS_DATA.leasesExpiringThisMonth}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <p className="text-xs text-gray-500">Offers Sent</p>
                      <p className="text-lg font-bold text-blue-700">{RENEWALS_DATA.renewalOffersSent}</p>
                    </div>
                    <div className={cn("rounded-lg p-2.5 text-center", RENEWALS_DATA.renewalsSigned === 0 ? "bg-red-50" : "bg-emerald-50")}>
                      <p className="text-xs text-gray-500">Signed</p>
                      <p className={cn("text-lg font-bold", RENEWALS_DATA.renewalsSigned === 0 ? "text-red-600" : "text-emerald-700")}>{RENEWALS_DATA.renewalsSigned}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                    <span>Non-Renewals / NTV: <strong className="text-red-600">{RENEWALS_DATA.nonRenewals}</strong></span>
                    <span>Avg Increase: <strong className="text-gray-700">${RENEWALS_DATA.avgRenewalIncrease}/mo</strong></span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── 3. LEASING VELOCITY ────────────────────────────────── */}
            <Card className="border-blue-200 bg-white">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <TrendingUp className="h-4.5 w-4.5 text-blue-700" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-gray-900">3. Leasing Velocity</CardTitle>
                    <p className="text-xs text-gray-500">April traffic — manual from Flash Report</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {/* Key occupancy metrics */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-blue-600">Physical Occupancy</p>
                    <p className="text-xl font-bold text-blue-800">{LEASING_APRIL.occupancy.physical}%</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-blue-600">Economic Occupancy</p>
                    <p className="text-xl font-bold text-blue-800">{LEASING_APRIL.occupancy.economic}%</p>
                  </div>
                </div>
                <div className={cn("rounded-lg p-3 text-center", LEASING_APRIL.netAbsorption < 0 ? "bg-red-50" : "bg-emerald-50")}>
                  <p className="text-xs text-gray-500">Net Absorption (MTD)</p>
                  <p className={cn("text-2xl font-bold", LEASING_APRIL.netAbsorption < 0 ? "text-red-700" : "text-emerald-700")}>
                    {LEASING_APRIL.netAbsorption}
                  </p>
                  <p className="text-xs text-gray-400">Move-ins: {LEASING_APRIL.mtd.moveIns} · Move-outs: {LEASING_APRIL.mtd.moveOuts}</p>
                </div>
                {/* Leasing funnel table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase py-2">Metric</th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase py-2">Wk 1</th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase py-2">Wk 2</th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase py-2 bg-blue-50">MTD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(["leads", "tours", "applications", "approvals", "newLeases", "moveIns", "moveOuts"] as const).map((key) => {
                        const labels: Record<string, string> = {
                          leads: "Leads / Inquiries", tours: "Tours / Showings", applications: "Applications",
                          approvals: "Approvals", newLeases: "New Leases Signed", moveIns: "Move-Ins", moveOuts: "Move-Outs",
                        };
                        return (
                          <tr key={key} className="hover:bg-gray-50">
                            <td className="py-1.5 text-sm text-gray-700">{labels[key]}</td>
                            <td className="py-1.5 text-sm text-right text-gray-600">{LEASING_APRIL.wk1[key]}</td>
                            <td className="py-1.5 text-sm text-right text-gray-600">{LEASING_APRIL.wk2[key]}</td>
                            <td className="py-1.5 text-sm text-right font-semibold text-gray-900 bg-blue-50/50">{LEASING_APRIL.mtd[key]}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                  <span>Vacant Rent Ready: <strong className="text-gray-700">{LEASING_APRIL.vacantRentReady}</strong></span>
                  <span>Down/In Turn: <strong className="text-red-600">{LEASING_APRIL.vacantDown}</strong></span>
                  <span>On Notice: <strong className="text-amber-600">{LEASING_APRIL.unitsOnNotice}</strong></span>
                </div>
              </CardContent>
            </Card>

            {/* ── 4. LENDER COMPLIANCE — PCA ITEMS ───────────────────── */}
            <Card className="border-purple-200 bg-white">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Wrench className="h-4.5 w-4.5 text-purple-700" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-gray-900">4. Lender Compliance (PCA)</CardTitle>
                      <p className="text-xs text-gray-500">90-day priority repairs — AEI Assessment</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-purple-700">{fmt(pcaTotal)}</p>
                    <p className="text-xs text-gray-400">est. total</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="overflow-x-auto -mx-6">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase py-2 pl-6">#</th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase py-2">Repair Item</th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase py-2">Estimate</th>
                        <th className="text-center text-xs font-semibold text-gray-500 uppercase py-2 pr-6">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {PCA_REPAIRS.map((r) => (
                        <tr key={r.id} className={cn("hover:bg-gray-50", r.priority && "bg-red-50/40")}>
                          <td className="py-2 pl-6 text-xs text-gray-400 font-mono">{r.id}</td>
                          <td className="py-2 pr-3">
                            <p className={cn("text-sm font-medium", r.priority ? "text-red-800" : "text-gray-800")}>
                              {r.priority && <span className="text-red-500 mr-1">!</span>}
                              {r.item}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{r.location}</p>
                            {r.note && <p className="text-xs text-gray-400 italic">{r.note}</p>}
                          </td>
                          <td className="py-2 text-right text-sm font-medium text-gray-900">
                            {r.estimate > 0 ? fmt(r.estimate) : "—"}
                          </td>
                          <td className="py-2 pr-6 text-center">
                            <Badge className="text-xs border bg-amber-100 text-amber-800 border-amber-200">
                              {r.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-gray-200">
                      <tr className="bg-gray-50">
                        <td className="py-2.5 pl-6" />
                        <td className="py-2.5 text-sm font-bold text-gray-700">Total PCA Estimate</td>
                        <td className="py-2.5 text-right text-sm font-bold text-purple-700">{fmt(pcaTotal)}</td>
                        <td className="py-2.5 pr-6 text-center text-xs text-gray-400">All bids pending</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  Source: AEI PCA Report, Project No. 521221 (Dec 17, 2025). Estimates for reference — independent bids required.
                </p>
              </CardContent>
            </Card>

          </div>
        </section>

        {/* ── DIVIDER ──────────────────────────────────────────────── */}
        <div className="border-t-2 border-gray-200 pt-4">
          <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold text-center mb-6">
            Full Property Detail
          </p>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION · FINANCIALS (from original dashboard)
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
                    month === m ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
                  )}
                >
                  {labels[m]}
                </button>
              );
            })}
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
            <Card className="border-gray-200">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Occupancy</p>
                <p className={cn("text-2xl font-bold mt-1", occupancy.actual >= occupancy.budget ? "text-emerald-600" : "text-amber-600")}>
                  {occupancy.actual.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-400 mt-1.5">Bgt {occupancy.budget.toFixed(1)}%</p>
              </CardContent>
            </Card>
            <Card className="border-gray-200">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">NOI</p>
                <p className={cn("text-2xl font-bold mt-1", noi.actual >= 0 ? "text-gray-900" : "text-red-600")}>{fmt(noi.actual)}</p>
                <p className="text-xs text-gray-400 mt-1.5">Bgt {fmt(noi.budget)}</p>
              </CardContent>
            </Card>
            <Card className="border-gray-200">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Net Cash Flow</p>
                <p className={cn("text-2xl font-bold mt-1", ncf.actual >= 0 ? "text-emerald-600" : "text-red-600")}>{fmt(ncf.actual)}</p>
                <p className="text-xs text-gray-400 mt-1.5">Bgt {fmt(ncf.budget)}</p>
              </CardContent>
            </Card>
            <Card className="border-gray-200">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reno Spent</p>
                <p className="text-2xl font-bold mt-1 text-gray-900">{fmt(totalRenoSpent)}</p>
                <p className="text-xs text-gray-400 mt-1.5">of {fmt(totalRenoBudget)}</p>
              </CardContent>
            </Card>
            <Card className="border-gray-200">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Open WOs</p>
                <p className={cn("text-2xl font-bold mt-1", openWOs > 3 ? "text-amber-600" : "text-gray-900")}>{openWOs}</p>
                <p className="text-xs text-gray-400 mt-1.5">of {WORK_ORDERS.length} total</p>
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
            SECTION · DELINQUENCY
        ══════════════════════════════════════════════════════════════════ */}
        <section id="delinquency" className="scroll-mt-28">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Delinquency</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: "Total Delinquent",   value: fmt(totalDelinquent),            color: "text-red-600"    },
              { label: "Delinquent Units",    value: `${DELINQUENCY.length} / 100`,  color: "text-red-600"    },
              { label: "30+ Days Past Due",   value: fmt(total30plus),               color: "text-red-700"    },
              { label: "Delinquency Rate",    value: `${((totalDelinquent / 89_000) * 100).toFixed(1)}%`, color: "text-red-600" },
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
                          })}>{d.action}</Badge>
                        </td>
                      </tr>
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
            SECTION · RENOVATIONS
        ══════════════════════════════════════════════════════════════════ */}
        <section id="renovations" className="scroll-mt-28">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Renovations</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: "Units Planned",    value: "40 units",          color: "text-gray-900" },
              { label: "Units Complete",   value: "25 of 40",          color: "text-emerald-600" },
              { label: "Total Budget",     value: fmt(totalRenoBudget), color: "text-gray-900" },
              { label: "Total Spent",      value: fmt(totalRenoSpent),  color: "text-blue-700" },
            ].map(({ label, value, color }) => (
              <Card key={label} className="border-gray-200">
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs font-medium text-gray-500">{label}</p>
                  <p className={cn("text-xl font-bold mt-0.5", color)}>{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700">Scope Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {RENO_SCOPES.map((r) => {
                const pct = r.budget > 0 ? (r.spent / r.budget) * 100 : 0;
                return (
                  <div key={r.scope}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700">{r.scope}</span>
                      <span className="text-xs text-gray-500">{fmt(r.spent)} / {fmt(r.budget)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div className={cn("h-full rounded-full", pct >= 90 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : "bg-amber-500")} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION · CAPEX
        ══════════════════════════════════════════════════════════════════ */}
        <section id="capex" className="scroll-mt-28 pb-16">
          <h2 className="text-lg font-bold text-gray-900 mb-4">CapEx</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: "CapEx Budget",       value: fmt(totalCapexBudget), color: "text-gray-900" },
              { label: "CapEx Spent",        value: fmt(totalCapexSpent),  color: totalCapexSpent > totalCapexBudget ? "text-red-600" : "text-gray-900" },
              { label: "Remaining",          value: fmt(totalCapexBudget - totalCapexSpent), color: "text-blue-700" },
              { label: "Open Work Orders",   value: `${openWOs} open`,    color: openWOs > 3 ? "text-amber-600" : "text-gray-900" },
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
                    <div className={cn("h-full rounded-full transition-all", {
                      "bg-emerald-500": p.pct >= 100, "bg-blue-500": p.pct >= 50 && p.pct < 100,
                      "bg-amber-500": p.pct >= 20 && p.pct < 50, "bg-gray-300": p.pct < 20,
                    })} style={{ width: `${Math.min(100, p.pct)}%` }} />
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
