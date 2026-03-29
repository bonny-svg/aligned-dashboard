"use client";

import { useRouter } from "next/navigation";
import { MapPin, Home, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPct, occupancyBg, statusColor, computePropertyFinancials } from "@/lib/utils";
import { useAppState } from "@/lib/store";
import type { Platform, Property } from "@/lib/types";

function platformColor(p: Platform): string {
  switch (p) {
    case "AppFolio": return "bg-violet-100 text-violet-800 border-violet-200";
    case "RealPage": return "bg-sky-100 text-sky-800 border-sky-200";
    case "Resman":   return "bg-teal-100 text-teal-800 border-teal-200";
  }
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}

interface Props { property: Property; }

export default function PropertyCard({ property: p }: Props) {
  const router = useRouter();
  const { state } = useAppState();
  const { noi, month } = computePropertyFinancials(state.financials, p.id);

  const displayNOI   = noi ?? (p as any).lastNOI ?? null;
  const displayMonth = month ?? (p as any).lastReportMonth ?? null;

  const rrRecords  = state.rentRoll.filter(r => r.propertyId === p.id);
  const delRecords = state.delinquency.filter(d => d.propertyId === p.id);
  const gprFromRR  = rrRecords.reduce((s, r) => s + r.marketRent, 0);
  const totalDel   = delRecords.reduce((s, d) => s + d.balance, 0);
  const delPctGPR  = gprFromRR > 0 ? (totalDel / gprFromRR) * 100 : p.delinquencyPct;

  const occBg     = occupancyBg(p.occupancyPct);
  const statColor = statusColor(p.status);

  return (
    <Card onClick={() => router.push(`/property/${p.id}`)} className="hover:scale-[1.01] transition-transform cursor-pointer">
      <CardContent className="pt-5">

        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0 pr-2">
            <h3 className="font-semibold text-gray-900 text-base leading-tight truncate">{p.name}</h3>
            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span>{p.city}, {p.state}</span>
            </div>
          </div>
          <Badge className={`${statColor} border flex-shrink-0 text-xs`}>{p.status}</Badge>
        </div>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Home className="h-3 w-3" />{p.units} units
          </span>
          <span className="text-gray-300 text-xs">·</span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border ${platformColor(p.platform)}`}>
            {p.platform}
          </span>
          <span className="text-xs text-gray-400">{p.platformAccount}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">

          <div className="rounded-lg bg-gray-50 border border-gray-100 p-2.5 text-center">
            <p className="text-xs text-gray-500 font-medium mb-1">
              NOI {displayMonth ? `(${monthLabel(displayMonth)})` : ""}
            </p>
            {displayNOI != null ? (
              <>
                <p className={`text-sm font-bold ${displayNOI >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {formatCurrency(displayNOI)}
                </p>
                {p.noiBudget != null && (
                  <p className={`text-xs mt-0.5 flex items-center justify-center gap-0.5 ${displayNOI >= p.noiBudget ? "text-green-600" : "text-red-600"}`}>
                    {displayNOI >= p.noiBudget ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    vs {formatCurrency(p.noiBudget)} budget
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-gray-400 italic mt-1">Awaiting data</p>
            )}
          </div>

          <div className="rounded-lg bg-gray-50 border border-gray-100 p-2.5 text-center">
            <p className="text-xs text-gray-500 font-medium mb-1">Occupancy</p>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${occBg}`}>
              {formatPct(p.occupancyPct)}
            </span>
            {p.occupancyBudget != null && (
              <p className={`text-xs mt-1 flex items-center justify-center gap-0.5 ${p.occupancyPct >= p.occupancyBudget ? "text-green-600" : "text-amber-600"}`}>
                {p.occupancyPct >= p.occupancyBudget ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                vs {formatPct(p.occupancyBudget)}
              </p>
            )}
          </div>

          <div className="rounded-lg bg-gray-50 border border-gray-100 p-2.5 text-center">
            <p className="text-xs text-gray-500 font-medium mb-1">Delinquency</p>
            <div className="flex items-center justify-center gap-0.5">
              {delPctGPR > 4 && <TrendingDown className="h-3 w-3 text-red-500" />}
              <p className={`text-sm font-bold ${delPctGPR < 3 ? "text-green-600" : delPctGPR < 6 ? "text-amber-600" : "text-red-600"}`}>
                {formatPct(delPctGPR / 100)}
              </p>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">% of GPR</p>
          </div>

          <div className="rounded-lg bg-gray-50 border border-gray-100 p-2.5 text-center">
            <p className="text-xs text-gray-500 font-medium mb-1">Collected MTD</p>
            <p className="text-sm font-bold text-gray-900">{formatCurrency(p.collectedMTD)}</p>
            {gprFromRR > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">{formatPct(p.collectedMTD / gprFromRR)} of GPR</p>
            )}
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
