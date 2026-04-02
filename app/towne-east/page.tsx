"use client";

import { useCallback } from "react";
import { MapPin, Home, Clock, Users, ArrowRight, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import RenovationSection from "@/components/RenovationSection";
import CapExSection from "@/components/CapExSection";

function fmt(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

const OCCUPANCY = { occupied: 97, vacant: 3, inReno: 2, ready: 1, total: 100, pct: 97 };

const MARCH_COLLECTIONS = {
  prorations:       44_476.38,
  prepaidRents:      2_107.20,
  ptpCredit:         9_000.00,
  totalReceived:    55_583.58,
  scheduledHalfMo:  53_050.00,
  collectionPct:    104.8,
  note: "Includes $44,476 rent proration + $2,107 prepaid rents (settlement statement) + $9,000 PTP credit from seller",
};

const OUTSTANDING = {
  total: 23_330.26,
  breakdown: [
    { label: "Paid to Previous Owner",           amount:  8_162.09, color: "bg-gray-400",  textColor: "text-gray-600",  note: "Collected pre-close — seller crediting back" },
    { label: "PTP This Weekend",                 amount:  3_520.00, color: "bg-amber-400", textColor: "text-amber-700", note: "Promise to pay — expected this weekend" },
    { label: "Skip — Unit 425 (Labrada)",        amount:  1_400.00, color: "bg-red-500",   textColor: "text-red-700",   note: "Former resident — eviction filed" },
    { label: "In Eviction — Unit 412",           amount:  1_939.45, color: "bg-red-500",   textColor: "text-red-700",   note: "Eviction in progress" },
    { label: "Pending Collection / Notation",    amount:  8_308.72, color: "bg-blue-500",  textColor: "text-blue-700",  note: "Being worked by Sunridge" },
  ],
};
const NET_EXPOSURE = 23_330.26 - 8_162.09 - 3_520.00;

const LEASING = {
  applicationsReceived: 1, applicationsDenied: 1,
  moveInsMTD: 1, moveInUnit: "922", moveInDate: "3/12/2026",
  moveOutsMTD: 1, moveOutUnit: "425", moveOutReason: "Skip",
  ntvCount: 0,
};

const RENEWALS = [
  { month: "March", expirations: 15, renewed: 0, pending: 13, mtm: 7, ntv: 0 },
  { month: "April", expirations:  3, renewed: 0, pending:  3, mtm: 0, ntv: 0 },
  { month: "May",   expirations:  9, renewed: 0, pending:  9, mtm: 0, ntv: 0 },
  { month: "June",  expirations:  6, renewed: 0, pending:  6, mtm: 0, ntv: 0 },
];

const VACANT_UNITS = [
  { unit: "521",  description: "Classic — leasing as-is",    status: "Ready"   },
  { unit: "722",  description: "Renovation started 3/23/26", status: "In Reno" },
  { unit: "1024", description: "Renovation started 3/23/26", status: "In Reno" },
];

const WORK_ORDERS = { total: 9, open: 3, completed: 6 };

export default function TowneEastPage() {
  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

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
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Data as of March 2026</span>
              </div>
            </div>
          </div>
          <nav className="flex gap-0 -mb-px overflow-x-auto">
            {["Overview", "Collections", "Renewals", "Renovations", "CapEx"].map((label) => (
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10">

        {/* ══ OVERVIEW ══ */}
        <section id="overview" className="scroll-mt-28">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: "Applications MTD", value: LEASING.applicationsReceived, sub: `${LEASING.applicationsDenied} denied (credit)`,            icon: <Users className="h-5 w-5 text-blue-400" />,        bg: "bg-blue-50"    },
              { label: "Move-ins MTD",      value: LEASING.moveInsMTD,           sub: `Unit ${LEASING.moveInUnit} · ${LEASING.moveInDate}`,        icon: <ArrowRight className="h-5 w-5 text-emerald-400" />, bg: "bg-emerald-50" },
              { label: "Move-outs MTD",     value: LEASING.moveOutsMTD,          sub: `Unit ${LEASING.moveOutUnit} · ${LEASING.moveOutReason}`,     icon: <ArrowRight className="h-5 w-5 text-red-400" />,     bg: "bg-red-50"     },
              { label: "NTV Count",         value: LEASING.ntvCount,             sub: "No notices to vacate",                                       icon: <Calendar className="h-5 w-5 text-gray-400" />,     bg: "bg-gray-50"    },
            ].map(({ label, value, sub, icon, bg }) => (
              <Card key={label} className="border-gray-200">
                <CardContent className="pt-4 pb-3 flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium">{label}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
                    <p className="text-xs text-gray-400 mt-1">{sub}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${bg}`}>{icon}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Occupancy donut */}
            <Card className="border-gray-200">
              <CardContent className="pt-6 pb-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Occupancy Rate</h3>
                <div className="flex items-center justify-center mb-4">
                  <div className="relative w-44 h-44">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#10b981" strokeWidth="10"
                        strokeDasharray={`${OCCUPANCY.pct * 2.513} 251.3`} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-bold text-gray-900">{OCCUPANCY.pct}%</span>
                      <span className="text-xs text-gray-400 mt-1">Occupied</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-center gap-8 mb-4">
                  <div className="text-center"><p className="text-2xl font-bold text-gray-500">{OCCUPANCY.vacant}</p><p className="text-xs text-gray-400">Vacant</p></div>
                  <div className="text-center"><p className="text-2xl font-bold text-emerald-500">{OCCUPANCY.ready}</p><p className="text-xs text-gray-400">Ready</p></div>
                  <div className="text-center"><p className="text-2xl font-bold text-amber-500">{OCCUPANCY.inReno}</p><p className="text-xs text-gray-400">In Reno</p></div>
                </div>
                <div className="border-t border-gray-100 pt-4 space-y-2">
                  {VACANT_UNITS.map((u) => (
                    <div key={u.unit} className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-semibold text-gray-800">Unit {u.unit}</span>
                        <span className="text-xs text-gray-400 ml-2">{u.description}</span>
                      </div>
                      <Badge className={cn("text-xs border", {
                        "bg-emerald-100 text-emerald-700 border-emerald-200": u.status === "Ready",
                        "bg-amber-100 text-amber-700 border-amber-200":       u.status === "In Reno",
                      })}>{u.status}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Outstanding balance */}
            <Card className="border-gray-200">
              <CardContent className="pt-6 pb-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Outstanding Balance Breakdown</h3>
                <p className="text-3xl font-bold text-gray-900 mb-1">{fmt(OUTSTANDING.total)}</p>
                <p className="text-xs text-gray-400 mb-5">
                  Net real exposure: <span className="font-semibold text-amber-600">{fmt(NET_EXPOSURE)}</span>
                  <span className="text-gray-300 mx-2">·</span>After seller credits + PTP
                </p>
                <div className="space-y-3.5">
                  {OUTSTANDING.breakdown.map((item) => (
                    <div key={item.label} className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ${item.color}`} />
                        <div>
                          <p className={`text-sm font-medium ${item.textColor}`}>{item.label}</p>
                          <p className="text-xs text-gray-400">{item.note}</p>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-gray-800 whitespace-nowrap">{fmt(item.amount)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Work Orders */}
          <Card className="border-gray-200 mt-5">
            <CardContent className="pt-4 pb-4 flex flex-wrap items-center gap-8">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Work Orders</p>
              <div className="flex gap-8">
                <div className="text-center"><p className="text-2xl font-bold text-gray-900">{WORK_ORDERS.total}</p><p className="text-xs text-gray-400">Total</p></div>
                <div className="text-center"><p className="text-2xl font-bold text-amber-500">{WORK_ORDERS.open}</p><p className="text-xs text-gray-400">Open</p></div>
                <div className="text-center"><p className="text-2xl font-bold text-emerald-500">{WORK_ORDERS.completed}</p><p className="text-xs text-gray-400">Completed</p></div>
              </div>
              <p className="text-xs text-gray-400 ml-auto">Sunridge · Cuco on-site</p>
            </CardContent>
          </Card>
        </section>

        {/* ══ COLLECTIONS ══ */}
        <section id="collections" className="scroll-mt-28">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Collections — March 16–31, 2026</h2>
          <p className="text-sm text-gray-400 mb-5">First 15 days of ownership. Full monthly reporting begins April 2026.</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            {[
              { label: "Rent Prorations (Seller)", value: fmt(MARCH_COLLECTIONS.prorations),    sub: "Mar 1–16 per settlement stmt", color: "text-emerald-600" },
              { label: "Prepaid Rents (Seller)",   value: fmt(MARCH_COLLECTIONS.prepaidRents),  sub: "Credited at closing",          color: "text-emerald-600" },
              { label: "PTP Credit (Seller)",      value: fmt(MARCH_COLLECTIONS.ptpCredit),     sub: "Pre-close collections",        color: "text-amber-600"  },
              { label: "Total Received",           value: fmt(MARCH_COLLECTIONS.totalReceived), sub: `${MARCH_COLLECTIONS.collectionPct}% of scheduled`, color: "text-blue-600" },
            ].map(({ label, value, sub, color }) => (
              <Card key={label} className="border-gray-200">
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-gray-500 font-medium">{label}</p>
                  <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
                  <p className="text-xs text-gray-400 mt-1">{sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-gray-200">
            <CardContent className="pt-4 pb-4">
              <div className="flex justify-between text-xs text-gray-500 mb-2">
                <span>March Collection Rate (15 days)</span>
                <span className="font-semibold text-emerald-600">{MARCH_COLLECTIONS.collectionPct}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div className="bg-emerald-500 h-3 rounded-full" style={{ width: "100%" }} />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-2">
                <span>{fmt(MARCH_COLLECTIONS.totalReceived)} received</span>
                <span>{fmt(MARCH_COLLECTIONS.scheduledHalfMo)} scheduled half-month</span>
              </div>
              <p className="text-xs text-gray-400 mt-3 italic">{MARCH_COLLECTIONS.note}</p>
            </CardContent>
          </Card>
        </section>

        {/* ══ RENEWALS ══ */}
        <section id="renewals" className="scroll-mt-28">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Renewal Pipeline</h2>
          <p className="text-sm text-gray-400 mb-5">All March expirations sent. April–June going out next week.</p>

          <Card className="border-gray-200">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["Month", "Expirations", "Renewed", "Pending", "MTM", "NTV"].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {RENEWALS.map((r) => (
                    <tr key={r.month} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-800">{r.month}</td>
                      <td className="px-6 py-3 text-gray-700">{r.expirations}</td>
                      <td className="px-6 py-3 text-gray-700">{r.renewed}</td>
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">{r.pending}</span>
                      </td>
                      <td className="px-6 py-3 text-gray-700">{r.mtm}</td>
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">{r.ntv}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <p className="text-xs text-amber-600 mt-3 font-medium">
            ⚠️ 15 March expirations pending — 7 currently month-to-month. Prioritize renewal outreach.
          </p>
        </section>

        {/* ══ RENOVATIONS ══ */}
        <section id="renovations" className="scroll-mt-28">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Renovations</h2>
          <RenovationSection />
        </section>

        {/* ══ CAPEX ══ */}
        <section id="capex" className="scroll-mt-28 pb-16">
          <h2 className="text-lg font-bold text-gray-900 mb-4">CapEx</h2>
          <CapExSection />
        </section>

      </main>
    </div>
  );
}
