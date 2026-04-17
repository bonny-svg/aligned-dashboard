"use client";

import { Wrench, Clock, DollarSign, AlertTriangle, Hammer, Activity } from "lucide-react";
import {
  RadialBarChart,
  RadialBar,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  PolarAngleAxis,
} from "recharts";
import SectionPill from "./SectionPill";
import TrendArrow from "./TrendArrow";
import type { GroveMetrics } from "@/lib/grove-metrics";
import { delta } from "@/lib/grove-metrics";
import {
  COLORS,
  MAKE_READY_COLOR,
  MAKE_READY_LABEL,
  THRESHOLDS,
  scoreToStatus,
} from "@/lib/grove-config";

interface Props {
  metrics: GroveMetrics;
  baseline: GroveMetrics | null;
}

function fmtDollar(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export default function RenovationsSection({ metrics, baseline }: Props) {
  const ratio = metrics.rentReadyRatio;
  const status = scoreToStatus(ratio, THRESHOLDS.renovationRatio, true);
  const ringColor = status === "good" ? COLORS.green : status === "warn" ? COLORS.yellow : COLORS.red;

  const totalClassified = metrics.makeReadyBreakdown.reduce((s, b) => s + b.count, 0);
  const makeReadyBarData =
    totalClassified > 0
      ? [
          metrics.makeReadyBreakdown.reduce((acc: Record<string, number>, b) => {
            acc[b.cls] = b.count;
            return acc;
          }, {} as Record<string, number>),
        ]
      : [];

  return (
    <section className="space-y-5">
      <SectionPill title="Unit Renovations & Make-Ready" icon={Wrench} tone="orange" />

      {/* Hero row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Rent-ready radial gauge */}
        <div className="rounded-xl border border-[color:var(--grove-border)] bg-[color:var(--grove-card)] p-6 flex flex-col items-center">
          <div className="flex items-start justify-between w-full mb-2">
            <div>
              <h3 className="text-sm font-semibold text-[color:var(--grove-text)]">Rent-Ready Ratio</h3>
              <p className="text-xs text-[color:var(--grove-muted)] mt-0.5">
                {metrics.rentReadyCount} of {metrics.vacantTotalCount} vacant units
              </p>
            </div>
            <TrendArrow delta={delta(ratio, baseline?.rentReadyRatio ?? null)} higherIsBetter={true} />
          </div>
          <div className="h-56 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="70%"
                outerRadius="100%"
                startAngle={90}
                endAngle={-270}
                data={[{ name: "ratio", value: ratio, fill: ringColor }]}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background={{ fill: "rgba(255,255,255,0.05)" }} dataKey="value" cornerRadius={8} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-5xl font-bold tabular-nums" style={{ color: ringColor }}>
                {ratio.toFixed(0)}%
              </div>
              <div className="text-xs uppercase tracking-wider text-[color:var(--grove-muted)] mt-1">rent-ready</div>
            </div>
          </div>
        </div>

        {/* KPI chips */}
        <div className="rounded-xl border border-[color:var(--grove-border)] bg-[color:var(--grove-card)] p-6 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-[color:var(--grove-text)] mb-1">Days-to-Rent-Ready</h3>
          <KpiChip
            icon={Clock}
            label="Avg Days Vacant"
            value={metrics.avgDaysVacant.toFixed(0)}
            tone={metrics.avgDaysVacant > 60 ? "bad" : metrics.avgDaysVacant > 30 ? "warn" : "good"}
            delta={delta(metrics.avgDaysVacant, baseline?.avgDaysVacant ?? null)}
            higherIsBetter={false}
            deltaFormat="number"
          />
          <KpiChip
            icon={AlertTriangle}
            label="Units with Unknown Status"
            value={`${metrics.unknownDaysVacantCount}`}
            tone={metrics.unknownDaysVacantCount > 0 ? "bad" : "neutral"}
            subtitle={metrics.unknownDaysVacantCount > 0 ? "Data hygiene: missing move-out dates" : "Clean"}
          />
          <KpiChip
            icon={DollarSign}
            label="Est. Monthly Vacancy Loss"
            value={fmtDollar(metrics.estMonthlyVacancyLoss)}
            tone="bad"
            delta={delta(metrics.estMonthlyVacancyLoss, baseline?.estMonthlyVacancyLoss ?? null)}
            higherIsBetter={false}
            deltaFormat="dollar"
          />
        </div>
      </div>

      {/* Chart row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Make-ready classification stacked bar */}
        <div className="rounded-xl border border-[color:var(--grove-border)] bg-[color:var(--grove-card)] p-6">
          <h3 className="text-sm font-semibold text-[color:var(--grove-text)] mb-1">Make-Ready Classification</h3>
          <p className="text-xs text-[color:var(--grove-muted)] mb-4">Parsed from unit comments</p>

          {totalClassified > 0 ? (
            <>
              <div className="h-16 flex rounded-lg overflow-hidden border border-[color:var(--grove-border)]">
                {metrics.makeReadyBreakdown
                  .filter((b) => b.count > 0)
                  .map((b) => {
                    const pct = (b.count / totalClassified) * 100;
                    return (
                      <div
                        key={b.cls}
                        className="flex flex-col items-center justify-center text-white relative group"
                        style={{ width: `${pct}%`, backgroundColor: MAKE_READY_COLOR[b.cls] }}
                      >
                        <div className="text-lg font-bold tabular-nums drop-shadow">{b.count}</div>
                        <div className="text-[10px] font-medium opacity-90">{pct.toFixed(0)}%</div>
                      </div>
                    );
                  })}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-xs">
                {metrics.makeReadyBreakdown.map((b) => (
                  <div key={b.cls} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: MAKE_READY_COLOR[b.cls] }} />
                    <span className="text-[color:var(--grove-muted)] truncate">
                      {MAKE_READY_LABEL[b.cls]} · <span className="text-[color:var(--grove-text)] tabular-nums">{b.count}</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-16 flex items-center justify-center text-xs text-[color:var(--grove-muted)]">
              No vacant units to classify
            </div>
          )}
        </div>

        {/* Days-vacant histogram */}
        <div className="rounded-xl border border-[color:var(--grove-border)] bg-[color:var(--grove-card)] p-6">
          <h3 className="text-sm font-semibold text-[color:var(--grove-text)] mb-1">Days-Vacant Distribution</h3>
          <p className="text-xs text-[color:var(--grove-muted)] mb-4">
            {metrics.unknownDaysVacantCount} units flagged as "Unknown"
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.daysVacantDistribution}>
                <CartesianGrid stroke={COLORS.border} vertical={false} />
                <XAxis dataKey="bucket" stroke={COLORS.textMuted} fontSize={10} />
                <YAxis stroke={COLORS.textMuted} fontSize={10} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: COLORS.card,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {metrics.daysVacantDistribution.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tracker row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sayan tracker */}
        <div className="rounded-xl border border-[color:var(--grove-border)] bg-[color:var(--grove-card)] p-5">
          <div className="flex items-center gap-2 mb-2">
            <Hammer className="h-4 w-4 text-[color:var(--grove-orange)]" />
            <h4 className="text-sm font-semibold text-[color:var(--grove-text)]">Sayan Renovation Tracker</h4>
          </div>
          <div className="text-2xl font-bold tabular-nums text-[color:var(--grove-text)]">
            {metrics.sayanUnitsTotal - metrics.sayanUnitsInProgress}
            <span className="text-[color:var(--grove-muted)] text-sm font-normal"> / {metrics.sayanUnitsTotal} complete</span>
          </div>
          <div className="h-2 mt-3 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full transition-[width] duration-700 bg-[color:var(--grove-green)]"
              style={{
                width: `${
                  metrics.sayanUnitsTotal > 0
                    ? ((metrics.sayanUnitsTotal - metrics.sayanUnitsInProgress) / metrics.sayanUnitsTotal) * 100
                    : 0
                }%`,
              }}
            />
          </div>
          <div className="text-xs text-[color:var(--grove-muted)] mt-2">
            {metrics.sayanUnitsInProgress} in progress
          </div>
        </div>

        {/* Velocity */}
        <div className="rounded-xl border border-[color:var(--grove-border)] bg-[color:var(--grove-card)] p-5">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-[color:var(--grove-blue)]" />
            <h4 className="text-sm font-semibold text-[color:var(--grove-text)]">Make-Ready Velocity</h4>
          </div>
          <div className="text-2xl font-bold tabular-nums text-[color:var(--grove-text)]">
            {metrics.rentReadyCount}
            <span className="text-[color:var(--grove-muted)] text-sm font-normal"> brought to ready</span>
          </div>
          <div className="text-xs text-[color:var(--grove-muted)] mt-1">
            vs. {metrics.vacantCount} turned to vacant
          </div>
          <div className="mt-3">
            <TrendArrow delta={delta(metrics.rentReadyCount, baseline?.rentReadyCount ?? null)} higherIsBetter={true} format="number" />
          </div>
        </div>

        {/* Longest vacant */}
        <div className="rounded-xl border border-[color:var(--grove-border)] bg-[color:var(--grove-card)] p-5">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-[color:var(--grove-red)]" />
            <h4 className="text-sm font-semibold text-[color:var(--grove-text)]">Longest Vacant</h4>
          </div>
          {metrics.longestVacant.length === 0 ? (
            <div className="text-xs text-[color:var(--grove-muted)] italic">No data</div>
          ) : (
            <div className="space-y-1.5 mt-1">
              {metrics.longestVacant.map((u) => (
                <div
                  key={u.unit}
                  className="flex items-center justify-between text-xs border-b border-[color:var(--grove-border)] pb-1 last:border-b-0"
                >
                  <span className="font-mono font-semibold text-[color:var(--grove-text)]">{u.unit}</span>
                  <span className="tabular-nums text-[color:var(--grove-red)]">{u.days}d</span>
                  <span className="tabular-nums text-[color:var(--grove-muted)]">{fmtDollar(u.cost)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function KpiChip({
  icon: Icon,
  label,
  value,
  subtitle,
  tone,
  delta: deltaVal,
  higherIsBetter = true,
  deltaFormat = "pct",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtitle?: string;
  tone: "good" | "warn" | "bad" | "neutral";
  delta?: number | null;
  higherIsBetter?: boolean;
  deltaFormat?: "pct" | "number" | "dollar";
}) {
  const color =
    tone === "good"
      ? COLORS.green
      : tone === "warn"
      ? COLORS.yellow
      : tone === "bad"
      ? COLORS.red
      : COLORS.blue;
  return (
    <div
      className="rounded-lg border border-[color:var(--grove-border)] p-4 flex items-center gap-3"
      style={{
        backgroundImage: `linear-gradient(135deg, ${color}14 0%, ${color}02 100%), linear-gradient(var(--grove-card), var(--grove-card))`,
      }}
    >
      <div
        className="h-10 w-10 rounded-md flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}20`, color }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-[color:var(--grove-muted)]">{label}</div>
        <div className="flex items-baseline gap-2">
          <div className="text-xl font-bold tabular-nums" style={{ color }}>
            {value}
          </div>
          {deltaVal !== undefined && (
            <TrendArrow delta={deltaVal} higherIsBetter={higherIsBetter} format={deltaFormat} />
          )}
        </div>
        {subtitle && <div className="text-[11px] text-[color:var(--grove-muted)]">{subtitle}</div>}
      </div>
    </div>
  );
}
