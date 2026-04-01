'use client';

import { useEffect, useState } from 'react';

interface RenovationUnit {
  unit: string;
  floorplan: string;
  budget: number;
  moveOutDate: string;
  walkDate: string;
  startDate: string;
  promiseDate: string;
  actualCompletionDate: string;
  contractor: string;
  actualFinalSpend: number;
  completionPct: string;
  notes: string;
  status: 'Complete' | 'In Progress' | 'Planned' | 'Not Started';
}

interface RenovationData {
  units: RenovationUnit[];
  summary: {
    totalBudget: number;
    totalSpent: number;
    unitsComplete: number;
    unitsInProgress: number;
    unitsPlanned: number;
    unitsNotStarted: number;
    totalUnitsInPlan: number;
    totalUnits: number;
    byUnitType: {
      type: string;
      budgetPerUnit: number;
      avgActualPerUnit: number;
      unitsComplete: number;
      totalUnits: number;
    }[];
  };
  lastFetched: string;
}

const FLOORPLAN_BUDGETS: Record<string, number> = {
  A1: 5000, A2: 5000, A3: 5000, B1: 5000, B2: 10000,
};

function getUnitBudget(u: RenovationUnit): number {
  return u.budget > 0 ? u.budget : (FLOORPLAN_BUDGETS[u.floorplan] ?? 0);
}

function fmt(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function StatusBadge({ status }: { status: RenovationUnit['status'] }) {
  const styles: Record<string, string> = {
    Complete: 'bg-green-100 text-green-700 border border-green-200',
    'In Progress': 'bg-blue-100 text-blue-700 border border-blue-200',
    Planned: 'bg-gray-100 text-gray-600 border border-gray-200',
    'Not Started': 'bg-gray-50 text-gray-400 border border-gray-100',
  };
  const icons: Record<string, string> = {
    Complete: '✓', 'In Progress': '◎', Planned: '○', 'Not Started': '○',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      <span>{icons[status]}</span>{status}
    </span>
  );
}

function StatusDot({ status }: { status: RenovationUnit['status'] }) {
  const colors: Record<string, string> = {
    Complete: 'bg-green-500',
    'In Progress': 'bg-blue-500',
    Planned: 'bg-gray-300',
    'Not Started': 'bg-gray-200',
  };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status]}`} />;
}

export default function RenovationSection() {
  const [data, setData] = useState<RenovationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/renovation-data')
      .then(r => { if (!r.ok) throw new Error('Failed to load'); return r.json(); })
      .then(setData)
      .catch(() => setError('Could not load renovation data. Check sheet permissions.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
      Loading renovation data from Google Sheets…
    </div>
  );

  if (error || !data) return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
      {error || 'Unknown error loading data.'}
    </div>
  );

  const { summary, units } = data;
  const spentPct = summary.totalBudget > 0
    ? Math.min((summary.totalSpent / summary.totalBudget) * 100, 100)
    : 0;

  return (
    <div className="space-y-6">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-500 mb-1">Units Planned</div>
          <div className="text-2xl font-bold text-gray-900">{summary.totalUnitsInPlan} units</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-500 mb-1">Units Complete</div>
          <div className="text-2xl font-bold text-green-600">{summary.unitsComplete} of {summary.totalUnitsInPlan}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-500 mb-1">Total Budget</div>
          <div className="text-2xl font-bold text-gray-900">${(summary.totalBudget / 1000).toFixed(0)}K</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-500 mb-1">Total Spent</div>
          <div className="text-2xl font-bold text-blue-600">{summary.totalSpent > 0 ? fmt(summary.totalSpent) : '—'}</div>
        </div>
      </div>

      {/* Budget Progress Bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Budget Used</span>
          <span>{spentPct.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${spentPct}%` }} />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{fmt(summary.totalSpent)} spent</span>
          <span>{fmt(summary.totalBudget - summary.totalSpent)} remaining</span>
        </div>
      </div>

      {/* Avg Spend + Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Avg Spend by Unit Type</h3>
          {summary.byUnitType.length === 0 ? (
            <p className="text-xs text-gray-400">No unit type data yet.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                      <th className="text-left pb-2 pr-3">Unit Type</th>
                      <th className="text-right pb-2 pr-3">Budget</th>
                      <th className="text-right pb-2 pr-3">Avg Actual</th>
                      <th className="text-right pb-2 pr-3">Variance</th>
                      <th className="text-right pb-2">Units</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {summary.byUnitType.map(row => {
                      const variance = row.avgActualPerUnit - row.budgetPerUnit;
                      const hasActual = row.avgActualPerUnit > 0;
                      return (
                        <tr key={row.type}>
                          <td className="py-2.5 pr-3 font-medium text-gray-800">{row.type}</td>
                          <td className="py-2.5 pr-3 text-right text-gray-600">{fmt(row.budgetPerUnit)}</td>
                          <td className="py-2.5 pr-3 text-right text-gray-600">{hasActual ? fmt(row.avgActualPerUnit) : '—'}</td>
                          <td className={`py-2.5 pr-3 text-right font-medium ${!hasActual ? 'text-gray-300' : variance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                            {hasActual ? `${variance > 0 ? '+' : ''}${fmt(variance)}` : '—'}
                          </td>
                          <td className="py-2.5 text-right text-gray-500 text-xs">{row.unitsComplete} of {row.totalUnits}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-50 space-y-0.5">
                {summary.byUnitType.map(row => (
                  <p key={row.type} className="text-xs text-gray-400">
                    {row.type} — {row.unitsComplete} of {row.totalUnits} units complete
                    {row.avgActualPerUnit > 0 && ` · avg ${fmt(row.avgActualPerUnit)} / unit`}
                  </p>
                ))}
              </div>
            </>
          )}
        </div>
