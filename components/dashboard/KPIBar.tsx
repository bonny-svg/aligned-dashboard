"use client";

import { useAppState } from "@/lib/store";
import { formatCurrency, formatPct, computePropertyFinancials } from "@/lib/utils";
import { Building2, Users, DollarSign, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

export default function KPIBar() {
  const { state } = useAppState();
  const props = state.properties;

  const totalUnits    = props.reduce((s, p) => s + p.units, 0);
  const avgOccupancy  =
    totalUnits > 0
      ? props.reduce((s, p) => s + p.occupancyPct * p.units, 0) / totalUnits
      : 0;
  const totalCollected   = props.reduce((s, p) => s + p.collectedMTD, 0);
  const totalDelinquency = props.reduce((s, p) => s + (p.delinquencyPct * p.collectedMTD) / 100, 0);
  const delinquencyPct   = totalCollected > 0 ? (totalDelinquency / totalCollected) * 100 : 0;

  // Portfolio NOI and Cash Flow — sum each property's most-recent-month figures
  let portfolioNOI       = 0;
  let portfolioCashFlow  = 0;
  let hasFinancials      = false;
  for (const p of props) {
    const { noi, cashFlow, month } = computePropertyFinancials(state.financials, p.id);
    if (month) {
      portfolioNOI      += noi;
      portfolioCashFlow += cashFlow;
      hasFinancials      = true;
    }
  }

  const kpis = [
    {
      label: "Total Units",
      value: totalUnits.toString(),
      icon: Building2,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Avg Occupancy",
      value: formatPct(avgOccupancy),
      icon: Users,
      color: avgOccupancy >= 93 ? "text-green-600" : avgOccupancy >= 85 ? "text-amber-600" : "text-red-600",
      bg:    avgOccupancy >= 93 ? "bg-green-50"   : avgOccupancy >= 85 ? "bg-amber-50"   : "bg-red-50",
    },
    {
      label: "Collected MTD",
      value: formatCurrency(totalCollected),
      icon: DollarSign,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Delinquency %",
      value: formatPct(delinquencyPct),
      icon: AlertTriangle,
      color: delinquencyPct < 3 ? "text-green-600" : delinquencyPct < 6 ? "text-amber-600" : "text-red-600",
      bg:    delinquencyPct < 3 ? "bg-green-50"    : delinquencyPct < 6 ? "bg-amber-50"    : "bg-red-50",
    },
    ...(hasFinancials
      ? [
          {
            label: "Portfolio NOI",
            value: formatCurrency(portfolioNOI),
            icon: TrendingUp,
            color: portfolioNOI >= 0 ? "text-green-600" : "text-red-600",
            bg:    portfolioNOI >= 0 ? "bg-green-50"    : "bg-red-50",
          },
          {
            label: "Portfolio Cash Flow",
            value: formatCurrency(portfolioCashFlow),
            icon: portfolioCashFlow >= 0 ? TrendingUp : TrendingDown,
            color: portfolioCashFlow >= 0 ? "text-green-600" : "text-red-600",
            bg:    portfolioCashFlow >= 0 ? "bg-green-50"    : "bg-red-50",
          },
        ]
      : []),
  ];

  const colsMap: Record<number, string> = {
    4: "lg:grid-cols-4",
    5: "lg:grid-cols-5",
    6: "lg:grid-cols-6",
  };
  const cols = colsMap[kpis.length] ?? "lg:grid-cols-4";

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 ${cols} gap-3`}>
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="rounded-xl border border-gray-200 bg-white px-4 py-4 flex items-center gap-3 shadow-sm"
        >
          <div className={`rounded-lg p-2 ${kpi.bg}`}>
            <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">{kpi.label}</p>
            <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
