"use client";

import { AlertTriangle, DollarSign, UserX, Users, TrendingDown } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import SectionPill from "./SectionPill";
import TrendArrow from "./TrendArrow";
import type { GroveMetrics } from "@/lib/grove-metrics";
import { delta } from "@/lib/grove-metrics";
import { COLORS, THRESHOLDS } from "@/lib/grove-config";
import type { HistoryEntry } from "@/lib/grove-baseline";
import { sparkSeries } from "@/lib/grove-baseline";
import Sparkline from "./Sparkline";

interface Props {
  metrics: GroveMetrics;
  baseline: GroveMetrics | null;
  history: HistoryEntry[];
}

function fmtDollar(n: number): string {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export default function DelinquencySection({ metrics, baseline, history }: Props) {
  const isCritical = metrics.delinquencyPctGPR > THRESHOLDS.delinquencyPctGPR.warn;
  const delinqDelta = delta(metrics.totalDelinquent, baseline?.totalDelinquent ?? null);

  // Ring progress calc: distance from 5% threshold. 0% = full green, 10% = full red.
  const threshold = THRESHOLDS.delinquencyPctGPR.warn;
  const ringPct = Math.min(100, (metrics.delinquencyPctGPR / (threshold * 2)) * 100);
  const ringColor =
    metrics.delinquencyPctGPR > threshold ? COLORS.red : metrics.delinquencyPctGPR > threshold / 2 ? COLORS.yellow : COLORS.green;
  const size = 280;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (ringPct / 100) * circumference;

  const agingPieData = metrics.delinquencyAging.map((a) => ({
    name: a.label,
    value: a.amount,
    count: a.count,
    color: a.color,
  }));

  const topDelinqData = metrics.topDelinquents.map((d) => ({
    label: `${d.unit} · ${d.name.slice(0, 16)}${d.name.length > 16 ? "…" : ""}`,
    unit: d.unit,
    amount: d.amount,
    monthsBehind: d.monthsBehind,
    leaseEndingSoon: d.leaseEndingSoon,
    color: d.leaseEndingSoon ? COLORS.red : COLORS.orange,
  }));

  const trendData = [...history].map((h) => ({
    time: new Date(h.takenAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    amount: h.metrics.totalDelinquent,
  }));

  return (
    <section className="space-y-5">
      <SectionPill
        title="Delinquency"
        icon={AlertTriangle}
        tone={isCritical ? "red" : "blue"}
        subtitle={isCritical ? "Critical" : undefined}
      />

      {/* Hero row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Big delinquency number w/ ring */}
        <div
          className="lg:col-span-2 rounded-xl border border-[color:var(--grove-border)] bg-[color:var(--grove-card)] p-6 relative overflow-hidden"
          style={{
            backgroundImage: `linear-gradient(135deg, ${ringColor}1A 0%, ${ringColor}03 100%), linear-gradient(var(--grove-card), var(--grove-card))`,
          }}
        >
          <div className="flex items-center gap-6">
            <div className="relative shrink-0" style={{ width: size, height: size }}>
              <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} fill="transparent" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="transparent"
                  stroke={ringColor}
                  strokeWidth={stroke}
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  className="transition-[stroke-dashoffset] duration-700 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <div
                  className="text-6xl font-bold tabular-nums leading-none tracking-tighter"
                  style={{ color: ringColor }}
                >
                  {metrics.delinquencyPctGPR.toFixed(1)}%
                </div>
                <div className="text-xs uppercase tracking-wider text-[color:var(--grove-muted)] mt-2">of GPR</div>
                <div className="text-[10px] text-[color:var(--grove-muted)] mt-1">Threshold: {threshold}%</div>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[color:var(--grove-muted)]">
                <DollarSign className="h-4 w-4" />
                Total Outstanding
              </div>
              <div
                className="text-4xl sm:text-5xl font-bold tabular-nums tracking-tight mt-1"
                style={{ color: ringColor }}
              >
                {fmtDollar(metrics.totalDelinquent)}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <TrendArrow delta={delinqDelta} higherIsBetter={false} format="pct" />
                <span className="text-xs text-[color:var(--grove-muted)]">vs. baseline</span>
              </div>
              <div className="mt-4">
                <div className="text-[10px] uppercase tracking-wider text-[color:var(--grove-muted)] mb-1">
                  12-snapshot trend
                </div>
                <Sparkline
                  values={sparkSeries(history, (m) => m.totalDelinquent)}
                  color={ringColor}
                  width={200}
                  height={36}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Aging donut */}
        <div className="rounded-xl border border-[color:var(--grove-border)] bg-[color:var(--grove-card)] p-6">
          <h3 className="text-sm font-semibold text-[color:var(--grove-text)] mb-1">Aging Breakdown</h3>
          <p className="text-xs text-[color:var(--grove-muted)] mb-4">By estimated months behind</p>
          <div className="relative h-48">
            {metrics.totalDelinquent > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={agingPieData}
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {agingPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: COLORS.card,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v) => fmtDollar(Number(v))}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[color:var(--grove-muted)]">
                No delinquency
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-lg font-bold tabular-nums text-[color:var(--grove-text)]">
                  {fmtDollar(metrics.totalDelinquent)}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-[color:var(--grove-muted)]">total</div>
              </div>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            {agingPieData.map((a) => (
              <div key={a.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.color }} />
                  <span className="text-[color:var(--grove-muted)]">{a.name}</span>
                </div>
                <div className="tabular-nums text-[color:var(--grove-text)]">
                  {fmtDollar(a.value)} <span className="text-[color:var(--grove-muted)]">({a.count})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chart row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[color:var(--grove-border)] bg-[color:var(--grove-card)] p-6">
          <h3 className="text-sm font-semibold text-[color:var(--grove-text)] mb-1">Top 10 Delinquent Residents</h3>
          <p className="text-xs text-[color:var(--grove-muted)] mb-4">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[color:var(--grove-red)]" />
              Lease ending &lt; 30d
            </span>
          </p>
          <div style={{ height: Math.max(180, topDelinqData.length * 26) }}>
            {topDelinqData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topDelinqData} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
                  <CartesianGrid stroke={COLORS.border} horizontal={false} />
                  <XAxis type="number" stroke={COLORS.textMuted} fontSize={10} tickFormatter={fmtDollar} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    stroke={COLORS.textMuted}
                    fontSize={10}
                    width={140}
                    tick={{ fill: COLORS.textMuted }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: COLORS.card,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v) => fmtDollar(Number(v))}
                    labelStyle={{ color: COLORS.textPrimary }}
                  />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                    {topDelinqData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[color:var(--grove-muted)]">
                No delinquent residents
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[color:var(--grove-border)] bg-[color:var(--grove-card)] p-6">
          <h3 className="text-sm font-semibold text-[color:var(--grove-text)] mb-1">Delinquency Trend vs Baseline</h3>
          <p className="text-xs text-[color:var(--grove-muted)] mb-4">History across snapshots</p>
          <div className="h-56">
            {trendData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="delinqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ringColor} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={ringColor} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={COLORS.border} vertical={false} />
                  <XAxis dataKey="time" stroke={COLORS.textMuted} fontSize={10} />
                  <YAxis stroke={COLORS.textMuted} fontSize={10} tickFormatter={fmtDollar} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: COLORS.card,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v) => fmtDollar(Number(v))}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke={ringColor}
                    strokeWidth={2}
                    fill="url(#delinqGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-xs text-[color:var(--grove-muted)] gap-1">
                <TrendingDown className="h-6 w-6 text-[color:var(--grove-muted)] opacity-50" />
                Tracking begins with baseline
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ActionCard
          icon={UserX}
          title="Eviction Risk"
          value={metrics.evictionRiskCount}
          subtitle="Delinquents with lease ending <60d"
          tone={metrics.evictionRiskCount > THRESHOLDS.evictionRisk.red ? "bad" : "warn"}
        />
        <ActionCard
          icon={Users}
          title="Concentration Risk"
          value={`${metrics.concentrationPct.toFixed(0)}%`}
          subtitle="% owed by top 5"
          tone={metrics.concentrationPct > THRESHOLDS.topFiveConcentration.red ? "bad" : "warn"}
        />
        <ActionCard
          icon={TrendingDown}
          title="Paying Down"
          value={metrics.payingDownCount}
          subtitle="Residents whose balance decreased"
          tone="good"
        />
      </div>
    </section>
  );
}

function ActionCard({
  icon: Icon,
  title,
  value,
  subtitle,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string | number;
  subtitle: string;
  tone: "good" | "warn" | "bad";
}) {
  const color = tone === "good" ? COLORS.green : tone === "warn" ? COLORS.yellow : COLORS.red;
  return (
    <div
      className="rounded-xl border border-[color:var(--grove-border)] bg-[color:var(--grove-card)] p-5"
      style={{
        backgroundImage: `linear-gradient(135deg, ${color}14 0%, ${color}02 100%), linear-gradient(var(--grove-card), var(--grove-card))`,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div
          className="h-9 w-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}20`, color }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-3xl font-bold tabular-nums" style={{ color }}>
          {value}
        </div>
      </div>
      <div className="text-sm font-semibold text-[color:var(--grove-text)]">{title}</div>
      <div className="text-xs text-[color:var(--grove-muted)] mt-0.5">{subtitle}</div>
    </div>
  );
}
