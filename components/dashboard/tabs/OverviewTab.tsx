"use client";

import { useAppState } from "@/lib/store";
import { formatCurrency, formatPct, statusColor, computePropertyFinancials } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface Props {
  propertyId: string;
}

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthLabel(ym: string): string {
  const [yr, mo] = ym.split("-");
  return `${MONTH_ABBR[parseInt(mo) - 1]} ${yr}`;
}

export default function OverviewTab({ propertyId }: Props) {
  const { state } = useAppState();
  const property = state.properties.find((p) => p.id === propertyId);
  if (!property) return null;

  // ── Occupancy from rent roll ──────────────────────────────────────────────
  const propertyRentRoll = state.rentRoll.filter((r) => r.propertyId === propertyId);
  const hasRentRoll = propertyRentRoll.length > 0;
  const occupiedCount = propertyRentRoll.filter(
    (r) => r.status === "Occupied" || r.status === "Notice" || r.status === "Eviction"
  ).length;
  const currentOccupancy = hasRentRoll
    ? (occupiedCount / propertyRentRoll.length) * 100
    : property.occupancyPct;

  // ── Occupancy trend ───────────────────────────────────────────────────────
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const importedPoints = state.occupancyTrend
    .filter((t) => t.propertyId === propertyId && t.fromImport)
    .sort((a, b) => a.month.localeCompare(b.month));

  const trend: { month: string; pct: number }[] =
    importedPoints.length > 0
      ? importedPoints.map((t) => ({
          month: monthLabel(t.month),
          pct: parseFloat(
            (t.month === currentMonth ? currentOccupancy : t.occupancyPct).toFixed(1)
          ),
        }))
      : hasRentRoll
      ? [{ month: monthLabel(currentMonth), pct: parseFloat(currentOccupancy.toFixed(1)) }]
      : [];

  const isSinglePoint = trend.length === 1;

  // ── Financial metrics from latest month ───────────────────────────────────
  const { noi, month: finMonth } = computePropertyFinancials(state.financials, propertyId);

  const propFins = state.financials.filter((f) => f.propertyId === propertyId);
  const latestItems = finMonth ? propFins.filter((f) => f.month === finMonth && !f.isNOI) : [];

  const totalIncomeActual   = latestItems.filter((f) => f.category === "Income").reduce((s, f) => s + f.actual, 0);
  const totalExpensesActual = latestItems.filter((f) => f.category === "Expenses").reduce((s, f) => s + f.actual, 0);
  const totalDebtService    = latestItems.filter((f) => f.category === "Debt Service").reduce((s, f) => s + f.actual, 0);

  // Expense ratio: Operating Expenses / EGI
  const expenseRatio = totalIncomeActual > 0 ? (totalExpensesActual / totalIncomeActual) * 100 : null;
  // DSCR: NOI / Debt Service
  const dscr = totalDebtService > 0 ? noi / totalDebtService : null;

  // ── Delinquency %  ────────────────────────────────────────────────────────
  const delinqPct = property.delinquencyPct;

  // ── Status colors ─────────────────────────────────────────────────────────
  const statColor = statusColor(property.status);

  // ── Occupancy color ───────────────────────────────────────────────────────
  const occColor = currentOccupancy >= 93 ? "text-green-700" : currentOccupancy >= 85 ? "text-amber-600" : "text-red-600";

  return (
    <div className="space-y-6">

      {/* ── 5-Metric KPI Row ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">

        {/* 1 · Occupancy */}
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Occupancy</p>
            <p className={`text-2xl font-bold mt-1 ${occColor}`}>
              {formatPct(currentOccupancy)}
            </p>
            {property.occupancyBudget != null ? (
              <>
                <p className="text-xs text-gray-400 mt-1.5">Bgt {formatPct(property.occupancyBudget)}</p>
                <p className={`text-xs font-semibold mt-0.5 ${currentOccupancy >= property.occupancyBudget ? "text-green-600" : "text-red-500"}`}>
                  {(currentOccupancy - property.occupancyBudget) >= 0 ? "+" : ""}
                  {(currentOccupancy - property.occupancyBudget).toFixed(1)}pp
                </p>
              </>
            ) : (
              <p className="text-xs text-gray-300 mt-1.5">—</p>
            )}
          </CardContent>
        </Card>

        {/* 2 · NOI */}
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">NOI</p>
            <p className={`text-2xl font-bold mt-1 ${!finMonth ? "text-gray-400" : noi >= 0 ? "text-gray-900" : "text-red-600"}`}>
              {finMonth ? formatCurrency(noi) : "—"}
            </p>
            {finMonth && property.noiBudget != null ? (
              <>
                <p className="text-xs text-gray-400 mt-1.5">Bgt {formatCurrency(property.noiBudget)}</p>
                <p className={`text-xs font-semibold mt-0.5 ${noi >= property.noiBudget ? "text-green-600" : "text-red-500"}`}>
                  {noi >= property.noiBudget ? "+" : ""}{formatCurrency(noi - property.noiBudget)}
                </p>
              </>
            ) : finMonth ? (
              <p className="text-xs text-gray-300 mt-1.5">—</p>
            ) : (
              <p className="text-xs text-gray-400 mt-1.5">Upload financials</p>
            )}
          </CardContent>
        </Card>

        {/* 3 · Delinquency % */}
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Delinquency %</p>
            <p className={`text-2xl font-bold mt-1 ${
              property.delinquencyBudget != null
                ? delinqPct <= property.delinquencyBudget ? "text-green-700" : "text-red-600"
                : delinqPct < 3 ? "text-green-700" : delinqPct < 6 ? "text-amber-600" : "text-red-600"
            }`}>
              {formatPct(delinqPct)}
            </p>
            {property.delinquencyBudget != null ? (
              <>
                <p className="text-xs text-gray-400 mt-1.5">Bgt {formatPct(property.delinquencyBudget)}</p>
                <p className={`text-xs font-semibold mt-0.5 ${delinqPct <= property.delinquencyBudget ? "text-green-600" : "text-red-500"}`}>
                  {(delinqPct - property.delinquencyBudget) >= 0 ? "+" : ""}
                  {(delinqPct - property.delinquencyBudget).toFixed(1)}pp
                </p>
              </>
            ) : (
              <p className="text-xs text-gray-300 mt-1.5">—</p>
            )}
          </CardContent>
        </Card>

        {/* 4 · Expense Ratio */}
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Expense Ratio</p>
            <p className={`text-2xl font-bold mt-1 ${
              expenseRatio == null ? "text-gray-400"
                : expenseRatio < 50 ? "text-green-700"
                : "text-red-600"
            }`}>
              {expenseRatio != null ? formatPct(expenseRatio) : "—"}
            </p>
            <p className="text-xs text-gray-400 mt-1.5" title="Operating Expenses / EGI">
              Oper. Expenses / EGI
            </p>
          </CardContent>
        </Card>

        {/* 5 · DSCR */}
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">DSCR</p>
            <p className={`text-2xl font-bold mt-1 ${
              dscr == null ? "text-gray-400"
                : dscr >= 1.25 ? "text-green-700"
                : dscr >= 1.0  ? "text-amber-600"
                : "text-red-600"
            }`}>
              {dscr != null ? `${dscr.toFixed(2)}x` : "—"}
            </p>
            <p className="text-xs text-gray-400 mt-1.5" title="NOI / Debt Service">
              {dscr != null ? "NOI / Debt Service" : "Upload T12 to calculate"}
            </p>
          </CardContent>
        </Card>

      </div>

      {/* Occupancy trend chart */}
      <Card>
        <CardHeader>
          <CardTitle>Occupancy Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {trend.length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-sm text-gray-400">
              No rent roll data uploaded yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="occGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis domain={[70, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v) => [`${v}%`, "Occupancy"]} />
                <Area
                  type="monotone"
                  dataKey="pct"
                  stroke="#3b82f6"
                  strokeWidth={isSinglePoint ? 0 : 2}
                  fill={isSinglePoint ? "none" : "url(#occGradient)"}
                  dot={{ r: 6, fill: "#3b82f6", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 7 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
          <p className="text-xs text-gray-400 mt-3 text-center">
            Upload monthly rent rolls to build a trend over time.
          </p>
        </CardContent>
      </Card>

      {/* Property details */}
      <Card>
        <CardHeader>
          <CardTitle>Property Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            {[
              ["Address", `${property.address}, ${property.city}, ${property.state}`],
              ["Total Units", property.units],
              ["Platform", `${property.platform} — ${property.platformAccount}`],
              ["Status", <Badge key="s" className={`${statColor} border text-xs`}>{property.status}</Badge>],
              ["Last Import", property.lastImport ? new Date(property.lastImport).toLocaleDateString() : "—"],
            ].map(([label, val]) => (
              <div key={String(label)}>
                <dt className="text-gray-500 font-medium">{label}</dt>
                <dd className="text-gray-900 mt-0.5">{val}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
