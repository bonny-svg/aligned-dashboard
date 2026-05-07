'use client';

import { useEffect, useState } from 'react';

interface CapExItem {
  item: string;
  phase: string;
  underwriting: number | null;
  status: string;
  actual: number | null;
  notes: string;
  monthlySpend: Record<string, number>;
}

interface CapExPhase {
  phase: string;
  label: string;
  color: string;
  totalUnderwriting: number;
  totalActual: number | null;
  items: CapExItem[];
  monthlySpend: Record<string, number>;
  grandTotalUnderwriting: number;
}

interface MonthlyPoint {
  month: string;
  amount: number;
}

interface CapExData {
  phases: CapExPhase[];
  grandTotalUnderwriting: number;
  grandTotalActual: number | null;
  grandTotalMonthlySpend: number;
  monthlySpendSeries: MonthlyPoint[];
  monthCols: string[];
  lastFetched: string;
}

function fmt(n: number): string {
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
  return '$' + n.toFixed(0);
}

function calcVariance(actual: number | null, underwriting: number): { val: number; display: string; color: string } | null {
  if (actual === null) return null;
  const val = actual - underwriting;
  const abs = Math.abs(val);
  const display = (val > 0 ? '+' : '-') + fmt(abs) + (val > 0 ? ' over' : ' under');
  const color = val > 0 ? 'text-red-500' : 'text-green-600';
  return { val, display, color };
}

const STATUS_STYLES: Record<string, string> = {
  'Complete':      'bg-green-100 text-green-700 border-green-200',
  'Bid Approved':  'bg-blue-100 text-blue-700 border-blue-200',
  'Pending Bids':  'bg-amber-100 text-amber-700 border-amber-200',
  'In Progress':   'bg-purple-100 text-purple-700 border-purple-200',
  'On Hold':       'bg-gray-100 text-gray-500 border-gray-200',
};

function StatusBadge({ status }: { status: string }) {
  if (!status) return <span className="text-gray-300">—</span>;
  const cls = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-500 border-gray-200';
  return (
    <span className={'text-xs px-2 py-0.5 rounded-full border font-medium ' + cls}>
      {status}
    </span>
  );
}

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; bar: string; badge: string }> = {
  red:    { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    bar: 'bg-red-400',    badge: 'bg-red-100 text-red-700 border-red-200' },
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   bar: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700 border-blue-200' },
  amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  bar: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', bar: 'bg-purple-400', badge: 'bg-purple-100 text-purple-700 border-purple-200' },
  gray:   { bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-600',   bar: 'bg-gray-400',   badge: 'bg-gray-100 text-gray-600 border-gray-200' },
};

function MonthlySpendChart({ series }: { series: MonthlyPoint[] }) {
  if (!series.length) return null;
  const max = Math.max(...series.map(s => s.amount));
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xs font-semibold text-gray-600 mb-4">Monthly Spend</div>
      <div className="flex items-end gap-2 h-28">
        {series.map(({ month, amount }) => {
          const pct = max > 0 ? (amount / max) * 100 : 0;
          return (
            <div key={month} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs text-gray-500 font-medium">{fmt(amount)}</span>
              <div className="w-full flex items-end" style={{ height: '72px' }}>
                <div
                  className="w-full rounded-t bg-blue-500 transition-all"
                  style={{ height: pct + '%', minHeight: amount > 0 ? '4px' : '0' }}
                />
              </div>
              <span className="text-xs text-gray-400">{month}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PhaseSection({
  phase,
  defaultOpen,
  monthCols,
}: {
  phase: CapExPhase;
  defaultOpen: boolean;
  monthCols: string[];
}) {
  const [open, setOpen] = useState(defaultOpen);
  const c = COLOR_MAP[phase.color] || COLOR_MAP.gray;
  const v = calcVariance(phase.totalActual, phase.totalUnderwriting);
  const pct = phase.grandTotalUnderwriting > 0
    ? (phase.totalUnderwriting / phase.grandTotalUnderwriting) * 100
    : 0;

  // Count by status
  const statusCounts: Record<string, number> = {};
  for (const item of phase.items) {
    if (item.status) statusCounts[item.status] = (statusCounts[item.status] ?? 0) + 1;
  }
  const completedCount = statusCounts['Complete'] ?? 0;

  return (
    <div className={'rounded-xl border ' + c.border + ' overflow-hidden'}>
      <button
        onClick={function() { setOpen(!open); }}
        className={'w-full flex items-center justify-between px-4 py-3 ' + c.bg + ' hover:opacity-90 transition-opacity'}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className={'text-sm font-bold ' + c.text}>{phase.label}</span>
          <span className={'text-xs px-2 py-0.5 rounded-full border font-medium ' + c.badge}>
            {phase.items.length} items
          </span>
          {completedCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full border font-medium bg-green-100 text-green-700 border-green-200">
              {completedCount} complete
            </span>
          )}
          <span className="text-xs text-gray-400">{pct.toFixed(0)}% of budget</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className={'text-sm font-bold ' + c.text}>{fmt(phase.totalUnderwriting)}</div>
            <div className="text-xs text-gray-400">underwriting</div>
          </div>
          {phase.totalActual !== null && (
            <div className="text-right">
              <div className="text-sm font-bold text-gray-800">{fmt(phase.totalActual)}</div>
              <div className="text-xs text-gray-400">actual</div>
            </div>
          )}
          {v && (
            <div className={'text-xs font-semibold ' + v.color}>{v.display}</div>
          )}
          <span className="text-gray-400 text-xs ml-2">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b border-gray-100 bg-white">
                <th className="text-left px-4 py-2">Item</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Underwriting</th>
                <th className="text-right px-4 py-2">Actual</th>
                <th className="text-right px-4 py-2">Variance</th>
                {monthCols.map(m => (
                  <th key={m} className="text-right px-3 py-2">{m}</th>
                ))}
                <th className="text-left px-4 py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {phase.items.map(function(item, i) {
                const iv = calcVariance(item.actual, item.underwriting ?? 0);
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{item.item}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-600">
                      {item.underwriting !== null ? fmt(item.underwriting) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-800 font-medium">
                      {item.actual !== null ? fmt(item.actual) : '—'}
                    </td>
                    <td className={'px-4 py-2.5 text-right font-medium ' + (iv ? iv.color : 'text-gray-300')}>
                      {iv ? iv.display : '—'}
                    </td>
                    {monthCols.map(m => (
                      <td key={m} className="px-3 py-2.5 text-right text-gray-600 text-xs">
                        {item.monthlySpend[m] ? fmt(item.monthlySpend[m]) : '—'}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-xs text-gray-400 max-w-xs">{item.notes || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className={'border-t-2 ' + c.border}>
              <tr className={c.bg}>
                <td className={'px-4 py-2.5 text-sm font-bold ' + c.text}>Subtotal</td>
                <td />
                <td className={'px-4 py-2.5 text-right text-sm font-bold ' + c.text}>
                  {fmt(phase.totalUnderwriting)}
                </td>
                <td className="px-4 py-2.5 text-right text-sm font-bold text-gray-800">
                  {phase.totalActual !== null ? fmt(phase.totalActual) : '—'}
                </td>
                <td className={'px-4 py-2.5 text-right text-sm font-bold ' + (v ? v.color : 'text-gray-300')}>
                  {v ? v.display : '—'}
                </td>
                {monthCols.map(m => (
                  <td key={m} className={'px-3 py-2.5 text-right text-xs font-bold ' + c.text}>
                    {phase.monthlySpend[m] ? fmt(phase.monthlySpend[m]) : '—'}
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

export default function CapExSection() {
  const [data, setData] = useState<CapExData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(function() {
    fetch('/api/capex-data')
      .then(function(r) {
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then(function(d) {
        if (d.phases) {
          d.phases = d.phases.map(function(p: CapExPhase) {
            return Object.assign({}, p, { grandTotalUnderwriting: d.grandTotalUnderwriting });
          });
        }
        setData(d);
      })
      .catch(function() { setError('Could not load CapEx data.'); })
      .finally(function() { setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
        Loading CapEx data from Google Sheets…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        {error || 'Unknown error loading data.'}
      </div>
    );
  }

  const v = calcVariance(data.grandTotalActual, data.grandTotalUnderwriting);

  // Status counts across all items
  const allItems = data.phases.flatMap(p => p.items);
  const totalComplete   = allItems.filter(i => i.status === 'Complete').length;
  const totalBidApproved = allItems.filter(i => i.status === 'Bid Approved').length;
  const totalPending    = allItems.filter(i => i.status === 'Pending Bids').length;

  return (
    <div className="space-y-6">

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-500 mb-1">Total Budget</div>
          <div className="text-2xl font-bold text-gray-900">{fmt(data.grandTotalUnderwriting)}</div>
          <div className="text-xs text-gray-400 mt-1">Underwriting</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-500 mb-1">Total Actual Spent</div>
          <div className="text-2xl font-bold text-blue-600">
            {data.grandTotalActual !== null ? fmt(data.grandTotalActual) : '—'}
          </div>
          <div className="text-xs text-gray-400 mt-1">Committed bids</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-500 mb-1">Monthly Spend</div>
          <div className="text-2xl font-bold text-indigo-600">
            {data.grandTotalMonthlySpend > 0 ? fmt(data.grandTotalMonthlySpend) : '—'}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {data.monthCols.length > 0 ? data.monthCols.join(' + ') : 'No months yet'}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-500 mb-1">Variance</div>
          <div className={'text-2xl font-bold ' + (v ? v.color : 'text-gray-300')}>
            {v ? v.display : '—'}
          </div>
          <div className="text-xs text-gray-400 mt-1">vs underwriting</div>
        </div>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm">{totalComplete}</div>
          <div>
            <div className="text-xs font-semibold text-green-700">Complete</div>
            <div className="text-xs text-green-600">items finished</div>
          </div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">{totalBidApproved}</div>
          <div>
            <div className="text-xs font-semibold text-blue-700">Bid Approved</div>
            <div className="text-xs text-blue-600">in progress</div>
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm">{totalPending}</div>
          <div>
            <div className="text-xs font-semibold text-amber-700">Pending Bids</div>
            <div className="text-xs text-amber-600">awaiting bids</div>
          </div>
        </div>
      </div>

      {/* Monthly Spend Chart */}
      {data.monthlySpendSeries.length > 0 && (
        <MonthlySpendChart series={data.monthlySpendSeries} />
      )}

      {/* Budget Allocation Bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="text-xs font-semibold text-gray-600 mb-3">Budget Allocation by Phase</div>
        <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
          {data.phases.map(function(phase) {
            const c = COLOR_MAP[phase.color] || COLOR_MAP.gray;
            const pct = (phase.totalUnderwriting / data.grandTotalUnderwriting) * 100;
            return (
              <div
                key={phase.phase}
                className={c.bar + ' h-full transition-all'}
                style={{ width: pct + '%' }}
                title={phase.label + ': ' + fmt(phase.totalUnderwriting)}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
          {data.phases.map(function(phase) {
            const c = COLOR_MAP[phase.color] || COLOR_MAP.gray;
            const pct = (phase.totalUnderwriting / data.grandTotalUnderwriting) * 100;
            return (
              <div key={phase.phase} className="flex items-center gap-1.5">
                <div className={'w-2.5 h-2.5 rounded-full ' + c.bar} />
                <span className="text-xs text-gray-600">{phase.label}</span>
                <span className="text-xs font-semibold text-gray-800">{fmt(phase.totalUnderwriting)}</span>
                <span className="text-xs text-gray-400">({pct.toFixed(0)}%)</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Phase Sections — collapsible */}
      <div className="space-y-3">
        {data.phases.map(function(phase, i) {
          return (
            <PhaseSection
              key={phase.phase}
              phase={phase}
              defaultOpen={i < 2}
              monthCols={data.monthCols}
            />
          );
        })}
      </div>

      {/* Grand Total */}
      <div className="rounded-xl border-2 border-gray-800 bg-gray-800 p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm font-bold text-white">Total CapEx</div>
        <div className="flex items-center gap-8">
          <div className="text-right">
            <div className="text-xl font-bold text-white">{fmt(data.grandTotalUnderwriting)}</div>
            <div className="text-xs text-gray-400">underwriting</div>
          </div>
          {data.grandTotalActual !== null && (
            <div className="text-right">
              <div className="text-xl font-bold text-blue-400">{fmt(data.grandTotalActual)}</div>
              <div className="text-xs text-gray-400">actual</div>
            </div>
          )}
          {data.grandTotalMonthlySpend > 0 && (
            <div className="text-right">
              <div className="text-xl font-bold text-indigo-400">{fmt(data.grandTotalMonthlySpend)}</div>
              <div className="text-xs text-gray-400">monthly spend</div>
            </div>
          )}
          {v && (
            <div className={'text-sm font-bold ' + v.color}>{v.display}</div>
          )}
        </div>
      </div>

      <div className="text-xs text-gray-400 text-right">
        Live · updated {new Date(data.lastFetched).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
      </div>
    </div>
  );
}
