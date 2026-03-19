"use client";

import { useAppState } from "@/lib/store";
import { formatCurrency, formatPct, isLeaseExpiringSoon, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export default function LeasingTab({ propertyId }: Props) {
  const { state } = useAppState();
  const rentRoll = state.rentRoll.filter((r) => r.propertyId === propertyId);
  const property = state.properties.find((p) => p.id === propertyId);
  if (!property) return null;

  const occupied = rentRoll.filter((r) => r.status === "Occupied" || r.status === "Notice");
  const vacant = rentRoll.filter((r) => r.status === "Vacant");
  const expiring60 = occupied.filter((r) => isLeaseExpiringSoon(r.leaseEnd, 60));
  const expiring90Count = occupied.filter((r) => isLeaseExpiringSoon(r.leaseEnd, 90) && !isLeaseExpiringSoon(r.leaseEnd, 60)).length;

  const occupancyPct = ((occupied.length) / rentRoll.length) * 100;

  const trend = state.occupancyTrend
    .filter((t) => t.propertyId === propertyId)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((t) => ({ month: t.month.slice(5), pct: parseFloat(t.occupancyPct.toFixed(1)) }));

  const totalMarket = occupied.reduce((s, r) => s + r.marketRent, 0);
  const totalActual = occupied.reduce((s, r) => s + r.actualRent, 0);
  const rentVariance = totalActual - totalMarket;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Occupancy", value: formatPct(occupancyPct), color: occupancyPct >= 93 ? "text-green-600" : occupancyPct >= 85 ? "text-amber-600" : "text-red-600", sub: "" },
          { label: "Vacant Units", value: vacant.length.toString(), color: "text-red-600", sub: "" },
          { label: "Expiring ≤60 Days", value: expiring60.length.toString(), color: expiring60.length > 3 ? "text-amber-600" : "text-gray-900", sub: `${expiring90Count} expiring 61–90 days` },
          { label: "Rent Variance (MTD)", value: `${rentVariance >= 0 ? "+" : ""}${formatCurrency(rentVariance)}`, color: rentVariance >= 0 ? "text-green-600" : "text-red-600", sub: "" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              {s.sub && <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trend */}
      <Card>
        <CardHeader><CardTitle>Occupancy Trend</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="grad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis domain={[70, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v) => [`${v}%`, "Occupancy"]} />
              <Area type="monotone" dataKey="pct" stroke="#10b981" strokeWidth={2} fill="url(#grad2)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Rent roll table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Rent Roll</CardTitle>
            <span className="text-xs text-gray-400">{rentRoll.length} units</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Unit", "Tenant", "Status", "Lease Start", "Lease End", "Market Rent", "Actual Rent", "Variance"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rentRoll.map((r) => {
                  const exp60 = isLeaseExpiringSoon(r.leaseEnd, 60);
                  const exp90 = !exp60 && isLeaseExpiringSoon(r.leaseEnd, 90);
                  const variance = r.actualRent - r.marketRent;
                  return (
                    <tr key={r.unit} className={`hover:bg-gray-50 ${exp60 ? "bg-red-50" : exp90 ? "bg-amber-50" : ""}`}>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{r.unit}</td>
                      <td className="px-4 py-2.5 text-gray-700">{r.tenant}</td>
                      <td className="px-4 py-2.5">
                        <Badge className={`text-xs border ${
                          r.status === "Occupied"  ? "bg-green-100 text-green-800 border-green-200" :
                          r.status === "Vacant"    ? "bg-red-100 text-red-800 border-red-200" :
                          r.status === "Notice"    ? "bg-amber-100 text-amber-800 border-amber-200" :
                          r.status === "Eviction"  ? "bg-red-200 text-red-900 border-red-300" :
                                                     "bg-gray-100 text-gray-700 border-gray-200"
                        }`}>
                          {r.status}
                        </Badge>
                        {exp60 && <Badge className="ml-1 text-xs border bg-red-100 text-red-800 border-red-200">Exp &lt;60d</Badge>}
                        {exp90 && <Badge className="ml-1 text-xs border bg-amber-100 text-amber-800 border-amber-200">Exp &lt;90d</Badge>}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{formatDate(r.leaseStart)}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{formatDate(r.leaseEnd)}</td>
                      <td className="px-4 py-2.5 text-gray-700">{r.status === "Vacant" ? "—" : formatCurrency(r.marketRent)}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{r.status === "Vacant" ? "—" : formatCurrency(r.actualRent)}</td>
                      <td className={`px-4 py-2.5 text-sm font-medium ${r.status === "Vacant" ? "text-gray-400" : variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {r.status === "Vacant" ? "—" : `${variance >= 0 ? "+" : ""}${formatCurrency(variance)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Vacant units */}
      {vacant.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Vacant Units ({vacant.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {vacant.map((r) => (
                <span key={r.unit} className="inline-flex items-center rounded-full bg-red-100 border border-red-200 px-3 py-1 text-sm text-red-700 font-medium">
                  {r.unit}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
