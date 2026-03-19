"use client";

import { useState } from "react";
import { useAppState } from "@/lib/store";
import { formatCurrency, formatPct, exportToCSV } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Download, ChevronDown, ChevronRight } from "lucide-react";
import type { DelinquencyRecord } from "@/lib/types";

interface Props {
  propertyId: string;
}

const ACTION_OPTIONS = ["None", "Notice Sent", "Payment Plan", "Eviction Filed"] as const;

export default function DelinquencyTab({ propertyId }: Props) {
  const { state, setState } = useAppState();
  const records = state.delinquency
    .filter((d) => d.propertyId === propertyId)
    .sort((a, b) => b.balance - a.balance);

  const property = state.properties.find((p) => p.id === propertyId);

  const totalBalance  = records.reduce((s, d) => s + d.balance, 0);
  const total30plus   = records.reduce((s, d) => s + (d.aging30plus ?? 0), 0);
  const gpr           = property ? Math.max(property.collectedMTD, 1) : 1;
  const pctGPR        = (totalBalance / gpr) * 100;

  const [actions, setActions] = useState<Record<string, DelinquencyRecord["actionStatus"]>>(
    Object.fromEntries(records.map((r) => [r.unit, r.actionStatus]))
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpand(unit: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(unit)) next.delete(unit); else next.add(unit);
      return next;
    });
  }

  function handleActionChange(unit: string, value: DelinquencyRecord["actionStatus"]) {
    setActions((prev) => ({ ...prev, [unit]: value }));
    setState((prev) => ({
      ...prev,
      delinquency: prev.delinquency.map((d) =>
        d.propertyId === propertyId && d.unit === unit ? { ...d, actionStatus: value } : d
      ),
    }));
  }

  function handleExport() {
    exportToCSV(
      records.map((r) => ({
        tenant: r.tenantName,
        unit: r.unit,
        balance: r.balance,
        aging_0_30: r.aging0_30 ?? "",
        aging_30plus: r.aging30plus ?? "",
        last_payment: r.lastPayment ?? "",
        payment_amount: r.paymentAmount ?? "",
        late_count: r.lateCount ?? "",
        action_status: actions[r.unit] ?? r.actionStatus,
        notes: r.notes ?? "",
      })),
      `delinquency-${propertyId}-${new Date().toISOString().slice(0, 10)}.csv`
    );
  }

  const hasAging      = records.some((r) => r.aging0_30 != null || r.aging30plus != null);
  const hasLastPmt    = records.some((r) => r.lastPayment != null);
  const hasLateCount  = records.some((r) => r.lateCount != null);

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-6 rounded-xl bg-red-50 border border-red-100 px-5 py-4">
        <div>
          <p className="text-xs text-red-500 font-medium">Total Delinquent</p>
          <p className="text-xl font-bold text-red-700">{formatCurrency(totalBalance)}</p>
        </div>
        <div>
          <p className="text-xs text-red-500 font-medium">% of Collected MTD</p>
          <p className="text-xl font-bold text-red-700">{formatPct(pctGPR)}</p>
        </div>
        <div>
          <p className="text-xs text-red-500 font-medium">Delinquent Units</p>
          <p className="text-xl font-bold text-red-700">{records.length}</p>
        </div>
        {total30plus > 0 && (
          <div>
            <p className="text-xs text-red-500 font-medium">Total 30+ Days</p>
            <p className="text-xl font-bold text-red-700">{formatCurrency(total30plus)}</p>
          </div>
        )}
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="w-6 px-2 py-3" />
              {["Tenant", "Unit", "Balance"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
              {hasAging && (
                <>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">0–30</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">30+</th>
                </>
              )}
              {hasLastPmt && (
                <>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Last Pmt</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Pmt Amt</th>
                </>
              )}
              {hasLateCount && (
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Late</th>
              )}
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {records.map((r) => {
              const isExpanded = expanded.has(r.unit);
              const actionVal  = actions[r.unit] ?? r.actionStatus;
              const isChronic  = (r.lateCount ?? 0) >= 5;
              return (
                <>
                  <tr
                    key={r.unit}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => r.notes && toggleExpand(r.unit)}
                  >
                    <td className="px-2 py-3 text-gray-300">
                      {r.notes
                        ? isExpanded
                          ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                          : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                        : null}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {r.tenantName}
                      {r.isSubsidy && (
                        <Badge className="ml-2 text-xs border bg-purple-100 text-purple-800 border-purple-200">HAP</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.unit}</td>
                    <td className="px-4 py-3 font-semibold text-red-600">{formatCurrency(r.balance)}</td>
                    {hasAging && (
                      <>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {r.aging0_30 != null ? formatCurrency(r.aging0_30) : "—"}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${(r.aging30plus ?? 0) > 0 ? "text-red-600" : "text-gray-400"}`}>
                          {r.aging30plus != null ? formatCurrency(r.aging30plus) : "—"}
                        </td>
                      </>
                    )}
                    {hasLastPmt && (
                      <>
                        <td className="px-4 py-3 text-xs text-gray-500">{r.lastPayment ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-xs text-gray-600">
                          {r.paymentAmount != null ? formatCurrency(r.paymentAmount) : "—"}
                        </td>
                      </>
                    )}
                    {hasLateCount && (
                      <td className="px-4 py-3 text-center">
                        {r.lateCount != null ? (
                          <Badge className={`text-xs border ${isChronic ? "bg-red-100 text-red-800 border-red-200" : "bg-gray-100 text-gray-700 border-gray-200"}`}>
                            {r.lateCount}
                          </Badge>
                        ) : "—"}
                      </td>
                    )}
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={actionVal}
                        onValueChange={(v) => handleActionChange(r.unit, v as DelinquencyRecord["actionStatus"])}
                      >
                        <SelectTrigger className="text-xs py-1 min-w-[140px]" />
                        <SelectContent>
                          {ACTION_OPTIONS.map((o) => (
                            <SelectItem key={o} value={o}>{o}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                  {isExpanded && r.notes && (
                    <tr key={`${r.unit}-notes`} className="bg-amber-50/50">
                      <td />
                      <td colSpan={10} className="px-4 py-2 text-xs text-gray-600 italic">
                        {r.notes}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
        {records.length === 0 && (
          <div className="text-center py-10 text-gray-400">No delinquency records</div>
        )}
      </div>
    </div>
  );
}
