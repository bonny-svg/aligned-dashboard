"use client";

import { useEffect, useState } from "react";
import { useAppState } from "@/lib/store";
import { formatCurrency, formatPct, computePropertyFinancials } from "@/lib/utils";
import { Users, DollarSign, AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";

interface LiveKPIs {
  collectedMTD: number;
  gpr: number;           // used as collections "budget"
  physicalOccupancyPct: number;
  economicOccupancyPct: number;
  delinquentBalance: number;
  totalUnits: number;
}

async function fetchMetricsUrl(snapshotEndpoint: string): Promise<string | null> {
  try {
    const res = await fetch(snapshotEndpoint, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.snapshot?.metricsUrl ?? null;
  } catch { return null; }
}

async function fetchMetrics(metricsUrl: string): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(metricsUrl, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export default function KPIBar() {
  const { state } = useAppState();
  const [live, setLive] = useState<LiveKPIs | null>(null);

  useEffect(() => {
    async function load() {
      const [groveUrl, teUrl] = await Promise.all([
        fetchMetricsUrl("/api/grove/snapshot"),
        fetchMetricsUrl("/api/towne-east/snapshot"),
      ]);

      const [grove, te] = await Promise.all([
        groveUrl ? fetchMetrics(groveUrl) : Promise.resolve(null),
        teUrl    ? fetchMetrics(teUrl)    : Promise.resolve(null),
      ]);

      if (!grove && !te) return;

      const groveUnits = (grove?.unitCount ?? 0);
      const teUnits    = (te?.unitCount   ?? 0);
      const totalUnits = groveUnits + teUnits;

      setLive({
        collectedMTD:        (grove?.collectedMTD      ?? 0) + (te?.totalCollected    ?? 0),
        gpr:                  (grove?.totalChargesMTD   ?? grove?.gpr ?? 0) + (te?.gpr ?? 0),
        physicalOccupancyPct: totalUnits > 0
          ? ((grove?.physicalOccupancyPct ?? 0) * groveUnits + (te?.physicalOccupancyPct ?? 0) * teUnits) / totalUnits
          : 0,
        economicOccupancyPct: totalUnits > 0
          ? ((grove?.economicOccupancyPct ?? 0) * groveUnits + (te?.economicOccupancyPct ?? 0) * teUnits) / totalUnits
          : 0,
        delinquentBalance: (grove?.totalDelinquent ?? 0) + (te?.delinquentBalance ?? 0),
        totalUnits,
      });
    }
    load();
  }, []);

  // ── CSV fallback (when no live data) ────────────────────────────────────────
  const props         = state.properties;
  const totalUnitsCSV = props.reduce((s, p) => s + p.units, 0);
  const avgOccCSV     = totalUnitsCSV > 0
    ? props.reduce((s, p) => s + p.occupancyPct * p.units, 0) / totalUnitsCSV
    : 0;
  const totalCollCSV  = props.reduce((s, p) => s + p.collectedMTD, 0);
  const totalDelCSV   = props.reduce((s, p) => s + (p.delinquencyPct * p.collectedMTD) / 100, 0);

  let hasFinancials = false;
  let portfolioNOI  = 0;
  let portfolioCF   = 0;
  for (const p of props) {
    const { noi, cashFlow, month } = computePropertyFinancials(state.financials, p.id);
    if (month) { portfolioNOI += noi; portfolioCF += cashFlow; hasFinancials = true; }
  }

  if (live) {
    const collPct    = live.gpr > 0 ? (live.collectedMTD / live.gpr) * 100 : 0;
    const occ        = live.physicalOccupancyPct;
    const econ       = live.economicOccupancyPct;
    const del        = live.delinquentBalance;

    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* Collections MTD */}
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
          <div className="rounded-lg p-2 bg-blue-50">
            <DollarSign className="h-5 w-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 font-medium">Collections MTD</p>
            <p className="text-lg font-bold text-blue-600">{formatCurrency(live.collectedMTD)}</p>
            <p className={`text-xs mt-0.5 flex items-center gap-0.5 ${collPct >= 95 ? "text-green-600" : collPct >= 85 ? "text-amber-600" : "text-red-600"}`}>
              {collPct >= 95 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {formatPct(collPct / 100)} of {formatCurrency(live.gpr)} GPR
            </p>
          </div>
        </div>

        {/* Occupancy */}
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
          <div className={`rounded-lg p-2 ${occ >= 93 ? "bg-green-50" : occ >= 85 ? "bg-amber-50" : "bg-red-50"}`}>
            <Users className={`h-5 w-5 ${occ >= 93 ? "text-green-600" : occ >= 85 ? "text-amber-600" : "text-red-600"}`} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Occupancy</p>
            <p className={`text-lg font-bold ${occ >= 93 ? "text-green-600" : occ >= 85 ? "text-amber-600" : "text-red-600"}`}>
              {formatPct(occ / 100)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Physical · {live.totalUnits} units</p>
          </div>
        </div>

        {/* Economic Occupancy */}
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
          <div className={`rounded-lg p-2 ${econ >= 90 ? "bg-green-50" : econ >= 80 ? "bg-amber-50" : "bg-red-50"}`}>
            <TrendingUp className={`h-5 w-5 ${econ >= 90 ? "text-green-600" : econ >= 80 ? "text-amber-600" : "text-red-600"}`} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Economic Occupancy</p>
            <p className={`text-lg font-bold ${econ >= 90 ? "text-green-600" : econ >= 80 ? "text-amber-600" : "text-red-600"}`}>
              {formatPct(econ / 100)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Lease rent ÷ market rent</p>
          </div>
        </div>

        {/* Delinquent Balance */}
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
          <div className={`rounded-lg p-2 ${del < 5000 ? "bg-green-50" : del < 15000 ? "bg-amber-50" : "bg-red-50"}`}>
            <AlertTriangle className={`h-5 w-5 ${del < 5000 ? "text-green-600" : del < 15000 ? "text-amber-600" : "text-red-600"}`} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Delinquent Balance</p>
            <p className={`text-lg font-bold ${del < 5000 ? "text-green-600" : del < 15000 ? "text-amber-600" : "text-red-600"}`}>
              {formatCurrency(del)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Portfolio total</p>
          </div>
        </div>

      </div>
    );
  }

  // ── CSV fallback render ──────────────────────────────────────────────────────
  const delPct = totalCollCSV > 0 ? (totalDelCSV / totalCollCSV) * 100 : 0;
  const kpis = [
    { label: "Collected MTD",       value: formatCurrency(totalCollCSV), color: "text-blue-600",  bg: "bg-blue-50",  Icon: DollarSign },
    { label: "Avg Occupancy",       value: formatPct(avgOccCSV),         color: avgOccCSV  >= 93 ? "text-green-600" : "text-amber-600", bg: avgOccCSV  >= 93 ? "bg-green-50" : "bg-amber-50", Icon: Users },
    { label: "Delinquency %",       value: formatPct(delPct / 100),      color: delPct < 3 ? "text-green-600" : delPct < 6 ? "text-amber-600" : "text-red-600", bg: delPct < 3 ? "bg-green-50" : delPct < 6 ? "bg-amber-50" : "bg-red-50", Icon: AlertTriangle },
    ...(hasFinancials ? [{ label: "Portfolio NOI", value: formatCurrency(portfolioNOI), color: portfolioNOI >= 0 ? "text-green-600" : "text-red-600", bg: portfolioNOI >= 0 ? "bg-green-50" : "bg-red-50", Icon: portfolioCF >= 0 ? TrendingUp : TrendingDown }] : []),
  ];
  const cols = kpis.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3";

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 ${cols} gap-3`}>
      {kpis.map((k) => (
        <div key={k.label} className="rounded-xl border border-gray-200 bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
          <div className={`rounded-lg p-2 ${k.bg}`}><k.Icon className={`h-5 w-5 ${k.color}`} /></div>
          <div>
            <p className="text-xs text-gray-500 font-medium">{k.label}</p>
            <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
