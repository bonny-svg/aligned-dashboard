"use client";

import { useAppState } from "@/lib/store";
import { formatCurrency, formatPct, occupancyBg, statusColor } from "@/lib/utils";
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

export default function OverviewTab({ propertyId }: Props) {
  const { state } = useAppState();
  const property = state.properties.find((p) => p.id === propertyId);
  if (!property) return null;

  const trend = state.occupancyTrend
    .filter((t) => t.propertyId === propertyId)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((t) => ({ month: t.month.slice(5), pct: parseFloat(t.occupancyPct.toFixed(1)) }));

  const delinquency = state.delinquency.filter((d) => d.propertyId === propertyId);
  const totalDelinq = delinquency.reduce((s, d) => s + d.balance, 0);
  const openWOs = state.workOrders.filter(
    (w) => w.propertyId === propertyId && w.status !== "Completed"
  ).length;
  const capExItems = state.capEx.filter((c) => c.propertyId === propertyId);
  const capExBudget = capExItems.reduce((s, c) => s + c.budget, 0);
  const capExSpent = capExItems.reduce((s, c) => s + c.spent, 0);

  const occBg = occupancyBg(property.occupancyPct);
  const statColor = statusColor(property.status);

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Occupancy", value: formatPct(property.occupancyPct), extra: <Badge className={`${occBg} border text-xs mt-1`}>{property.occupancyPct >= 93 ? "On Target" : property.occupancyPct >= 85 ? "Below Goal" : "Critical"}</Badge> },
          { label: "Collected MTD", value: formatCurrency(property.collectedMTD) },
          { label: "Total Delinquency", value: formatCurrency(totalDelinq), sub: `${delinquency.length} tenants` },
          { label: "Open Work Orders", value: openWOs.toString(), sub: `${formatCurrency(capExSpent)} / ${formatCurrency(capExBudget)} CapEx` },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
              {s.sub && <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>}
              {s.extra}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Occupancy trend chart */}
      <Card>
        <CardHeader>
          <CardTitle>Occupancy Trend (Last 7 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="occGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
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
                strokeWidth={2}
                fill="url(#occGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
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
