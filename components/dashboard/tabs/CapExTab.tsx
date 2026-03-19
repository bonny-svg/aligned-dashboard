"use client";

import { useAppState } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  propertyId: string;
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}

function statusBadge(status: string) {
  switch (status) {
    case "Open":        return "bg-blue-100 text-blue-800 border-blue-200";
    case "In Progress": return "bg-amber-100 text-amber-800 border-amber-200";
    case "Completed":   return "bg-green-100 text-green-800 border-green-200";
    case "On Hold":     return "bg-gray-100 text-gray-700 border-gray-200";
    default:            return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

export default function CapExTab({ propertyId }: Props) {
  const { state } = useAppState();
  const workOrders  = state.workOrders.filter((w) => w.propertyId === propertyId);
  const capExItems  = state.capEx.filter((c) => c.propertyId === propertyId);

  // Income statement CapEx items (1100-xxx account rows, category === "CapEx")
  const capexFinancials = state.financials.filter(
    (f) => f.propertyId === propertyId && f.category === "CapEx"
  );
  const capexMonths = Array.from(new Set(capexFinancials.map((f) => f.month))).sort();
  const capexLineItems = Array.from(new Set(capexFinancials.map((f) => f.lineItem)));

  function monthActual(lineItem: string, month: string): number {
    return capexFinancials.find((f) => f.lineItem === lineItem && f.month === month)?.actual ?? 0;
  }
  function ytdTotal(lineItem: string): number {
    return capexFinancials.filter((f) => f.lineItem === lineItem).reduce((s, f) => s + f.actual, 0);
  }

  const totalBudget    = capExItems.reduce((s, c) => s + c.budget, 0);
  const totalSpent     = capExItems.reduce((s, c) => s + c.spent, 0);
  const totalCommitted = workOrders
    .filter((w) => w.status !== "Completed")
    .reduce((s, w) => s + w.estimatedCost, 0);
  const totalCapexYTD  = capexLineItems.reduce((s, li) => s + ytdTotal(li), 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "CapEx Budget",      value: formatCurrency(totalBudget),    color: "text-gray-900",   show: capExItems.length > 0 },
          { label: "CapEx Spent",       value: formatCurrency(totalSpent),     color: totalSpent > totalBudget ? "text-red-600" : "text-gray-900", show: capExItems.length > 0 },
          { label: "IS CapEx YTD",      value: formatCurrency(totalCapexYTD),  color: "text-blue-700",   show: capexLineItems.length > 0 },
          { label: "Open WO Committed", value: formatCurrency(totalCommitted), color: "text-amber-600",  show: true },
        ].filter((s) => s.show).map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Income Statement CapEx table */}
      {capexLineItems.length > 0 && (
        <Card>
          <CardHeader><CardTitle>CapEx from Income Statement</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                    {capexMonths.map((m) => (
                      <th key={m} className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {monthLabel(m)}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wide">YTD Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {capexLineItems.map((li) => (
                    <tr key={li} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-800 font-medium">{li}</td>
                      {capexMonths.map((m) => {
                        const val = monthActual(li, m);
                        return (
                          <td key={m} className={`px-3 py-2.5 text-right ${val > 0 ? "text-gray-900" : "text-gray-300"}`}>
                            {val > 0 ? formatCurrency(val) : "—"}
                          </td>
                        );
                      })}
                      <td className="px-4 py-2.5 text-right font-bold text-blue-700">
                        {formatCurrency(ytdTotal(li))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td className="px-4 py-2.5 text-xs font-bold text-gray-600 uppercase">Total</td>
                    {capexMonths.map((m) => {
                      const total = capexLineItems.reduce((s, li) => s + monthActual(li, m), 0);
                      return (
                        <td key={m} className="px-3 py-2.5 text-right text-xs font-bold text-gray-700">
                          {total > 0 ? formatCurrency(total) : "—"}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 text-right text-xs font-bold text-blue-700">
                      {formatCurrency(totalCapexYTD)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CapEx tracker (manual/sample records) */}
      {capExItems.length > 0 && (
        <Card>
          <CardHeader><CardTitle>CapEx Tracker</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {capExItems.map((item) => (
              <div key={item.item}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-gray-800">{item.item}</span>
                  <span className="text-xs text-gray-500">
                    {formatCurrency(item.spent)} / {formatCurrency(item.budget)} ({item.pctComplete}%)
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      item.pctComplete >= 100 ? "bg-green-500" :
                      item.pctComplete >= 60  ? "bg-blue-500" :
                      item.pctComplete >= 30  ? "bg-amber-500" : "bg-red-400"
                    }`}
                    style={{ width: `${Math.min(100, item.pctComplete)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Work Orders */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Work Orders</CardTitle>
            <span className="text-xs text-gray-400">{workOrders.filter(w => w.status !== "Completed").length} open</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["WO #", "Unit", "Category", "Description", "Vendor", "Est. Cost", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {workOrders.map((wo) => (
                  <tr key={wo.woNumber} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{wo.woNumber}</td>
                    <td className="px-4 py-2.5 text-gray-700">{wo.unit}</td>
                    <td className="px-4 py-2.5 text-gray-600">{wo.category}</td>
                    <td className="px-4 py-2.5 text-gray-800 max-w-[200px] truncate">{wo.description}</td>
                    <td className="px-4 py-2.5 text-gray-600">{wo.vendor}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{formatCurrency(wo.estimatedCost)}</td>
                    <td className="px-4 py-2.5">
                      <Badge className={`text-xs border ${statusBadge(wo.status)}`}>{wo.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {workOrders.length === 0 && (
              <div className="text-center py-10 text-gray-400">No work orders</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
