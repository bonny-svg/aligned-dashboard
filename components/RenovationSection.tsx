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
          <div className="text-xs text-gray-500 m
