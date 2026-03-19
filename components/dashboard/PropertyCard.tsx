"use client";

import { useRouter } from "next/navigation";
import { MapPin, Home, TrendingDown } from "lucide-react";
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

interface Props {
  property: Property;
}

export default function PropertyCard({ property: p }: Props) {
  const router = useRouter();
  const { state } = useAppState();

  const { noi, cashFlow, month } = computePropertyFinancials(state.financials, p.id);

  const occBg     = occupancyBg(p.occupancyPct);
  const statColor = statusColor(p.status);

  return (
    <Card
      onClick={() => router.push(`/property/${p.id}`)}
      className="hover:scale-[1.01] transition-transform cursor-pointer"
    >
      <CardContent className="pt-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0 pr-2">
            <h3 className="font-semibold text-gray-900 text-base leading-tight truncate">
              {p.name}
            </h3>
            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span>{p.city}, {p.state}</span>
            </div>
          </div>
          <Badge className={`${statColor} border flex-shrink-0 text-xs`}>
            {p.status}
          </Badge>
        </div>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Home className="h-3 w-3" />
            {p.units} units
          </span>
          <span className="text-gray-300 text-xs">·</span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border ${platformColor(p.platform)}`}>
            {p.platform}
          </span>
          <span className="text-xs text-gray-400">{p.platformAccount}</span>
        </div>

        {/* Operational stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-0.5">Occupancy</p>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${occBg}`}>
              {formatPct(p.occupancyPct)}
            </span>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-0.5">Collected MTD</p>
            <p className="text-sm font-bold text-gray-900">{formatCurrency(p.collectedMTD)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-0.5">Delinquency</p>
            <div className="flex items-center justify-center gap-0.5">
              {p.delinquencyPct > 4 && <TrendingDown className="h-3 w-3 text-red-500" />}
              <p className={`text-sm font-bold ${p.delinquencyPct < 3 ? "text-green-600" : p.delinquencyPct < 6 ? "text-amber-600" : "text-red-600"}`}>
                {formatPct(p.delinquencyPct)}
              </p>
            </div>
          </div>
        </div>

        {/* Financial stats — only when income statement data exists */}
        {month && (
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100">
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-0.5">
                NOI <span className="text-gray-400">({monthLabel(month)})</span>
              </p>
              <p className={`text-sm font-bold ${noi >= 0 ? "text-green-700" : "text-red-600"}`}>
                {formatCurrency(noi)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-0.5">Cash Flow</p>
              <p className={`text-sm font-bold ${cashFlow >= 0 ? "text-green-700" : "text-red-600"}`}>
                {formatCurrency(cashFlow)}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
