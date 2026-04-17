"use client";

import { Building2, DollarSign, Layers, Info } from "lucide-react";
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
  AreaChart,
  Area,
  Legend,
  PolarAngleAxis,
} from "recharts";
import SectionPill from "./SectionPill";
import TrendArrow from "./TrendArrow";
import type { GroveMetrics } from "@/lib/grove-metrics";
import { delta } from "@/lib/grove-metrics";
import { COLORS, THRESHOLDS, scoreToStatus } from "@/lib/grove-config";
import type { HistoryEntry } from "@/lib/grove-baseline";

interface Props {
  metrics: GroveMetrics;
  baseline: GroveMetrics | null;
  history: HistoryEntry[];
}

function fmtDollar(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function OccGauge({
  value,
  label,
  deltaValue,
}: {
  value: number;
  label: string;
  deltaValue: number | null;
}) {
  const status = scoreToStatus(value, THRESHOLDS.occupancy, true);
  const color = status === "good" ? COLORS.green : status === "warn" ? COLORS.yellow : COLORS.red;

  return (
    <div className="flex flex-col items-center">
      <div className="h-44 w-44 relative">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="72%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            data={[{ name: "occ", value, fill: color }]}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar background={{ fill: "rgba(255,255,255,0.05)" }} dataKey="value" cornerRadius={10} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-4xl font-bold tabular-nums leading-none" style={{ color }}>
            {value.toFixed(1)}%
          </div>
        </div>
      </div>
      <div className="mt-2 text-xs uppercase tracking-wider font-semibold text-[color:var(--grove-text)]">
        {label}
      </div>
      <div className="mt-1">
        <TrendArrow delta={deltaValue} higherIsBetter={true} />
      </div>
    </div>
  );
}

export default function OccupancySection({ metrics, baseline, history }: Props) {
  const economicOcc = 100 - metrics.delinquencyPctGPR;

  // Floorplan data for chart
  const floorplanData = metrics.floorplanStats.map((f) => ({
    floorplan: f.floorplan,
    occupancyPct: Number(f.occupiedPct.toFixed(1)),
    marketRent: Math.round(f.avgMarketRent),
    leaseRent: Math.round(f.avgLeaseRent),
    color:
      scoreToStatus(f.occupiedPct, THRESHOLDS.occupancy, true) === "good"
        ? COLORS.green
        : scoreToStatus(f.occupiedPct, THRESHOLDS.occupancy, true) === "warn"
        ? COLORS.yellow
        : COLORS.red,
  }));

  // Occupancy trend from history
  const trendData = history.map((h) => ({
    time: new Date(h.takenAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    physical: Number(h.metrics.physicalOccupancyPct.toFixed(1)),
    leased: Number(h.metrics.leasedOccupancyPct.toFixed(1)),
    projected: Number(h.metrics.projected60DayOccupancyPct.toFixed(1)),
  }));

  return (
    <section className="space-y-5">
      <SectionPill title="Occupancy Metrics" icon={Building2} tone="blue" />

      {/* Hero row: 3 gauges */}
      <div className="rounded-xl border border-[color:var(--grove-border)] bg-[color:var(--grove-card)] p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <OccGauge
            value={metrics.physicalOccupancyPct}
            label="Physical Occupancy"
            deltaValue={delta(metrics.physicalOccupancyPct, baseline?.physicalOccupancyPct ?? null)}
          />
          <OccGauge
            value={metrics.leasedOccupancyPct}
            label="Leased Occupancy"
            deltaValue={delta(metrics.leasedOccupancyPct, baseline?.leasedOccupancyPct ?? null)}
          />
          <OccGauge
            value={metrics.projected60DayOccupancyPct}
            label="Projected 60-Day Occupancy"
            deltaValue={delta(metrics.projected60DayOccupancyPct, baseline?.projected60DayOccupancyPct ?? null)}
          />
        </div>
      </div>

      {/* Chart row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[color:var(--grove-border)] bg-[color:var(--grove-card)] p-6">
          <h3 className="text-sm font-semibold text-[color:var(--grove-text)] mb-1">Floorplan Occupancy</h3>
          <p className="text-xs text-[color:var(--grove-muted)] mb-4">% occupied + loss-to-lease visual</p>
          <div style={{ height: Math.max(260, floorplanData.length * 32) }}>
            {floorplanData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={floorplanData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid stroke={COLORS.border} horizontal={false} />
                  <XAxis type="number" stroke={COLORS.textMuted} fontSize={10} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis
                    type="category"
                    dataKey="floorplan"
                    stroke={COLORS.textMuted}
                    fontSize={11}
                    width={50}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: COLORS.card,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v, name) => {
                      const num = Number(v);
                      if (name === "occupancyPct") return [`${num}%`, "Occupied"];
                      if (name === "marketRent") return [fmtDollar(num), "Avg Market"];
                      if (name === "leaseRent") return [fmtDollar(num), "Avg Lease"];
                      return [String(v), String(name)];
                    }}
                  />
                  <Bar dataKey="occupancyPct" radius={[0, 4, 4, 0]}>
                    {floorplanData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[color:var(--grove-muted)]">
                No floorplan data
              </div>
            )}
          </div>
          {floorplanData.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4 text-[11px]">
              {floorplanData.map((f) => (
                <div
                  key={f.floorplan}
                  className="rounded-md border border-[color:var(--grove-border)] px-2 py-1.5 text-center"
                >
                  <div className="font-mono font-semibold text-[color:var(--grove-text)]">{f.floorplan}</div>
                  <div className="text-[color:var(--grove-muted)] tabular-nums">
                    {fmtDollar(f.leaseRent)} / {fmtDollar(f.marketRent)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[color:var(--grove-border)] bg-[color:var(--grove-card)] p-6">
          <h3 className="text-sm font-semibold text-[color:var(--grove-text)] mb-1">Occupancy Trend</h3>
          <p className="text-xs text-[color:var(--grove-muted)] mb-4">All three metrics from baseline</p>
          <div className="h-64">
            {trendData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="physGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.blue} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={COLORS.blue} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="leaseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.green} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={COLORS.green} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={COLORS.border} vertical={false} />
                  <XAxis dataKey="time" stroke={COLORS.textMuted} fontSize={10} />
                  <YAxis stroke={COLORS.textMuted} fontSize={10} domain={[70, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: COLORS.card,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: COLORS.textMuted }} />
                  <Area
                    type="monotone"
                    dataKey="physical"
                    name="Physical"
                    stroke={COLORS.blue}
                    strokeWidth={2}
                    fill="url(#physGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="leased"
                    name="Leased"
                    stroke={COLORS.green}
                    strokeWidth={2}
                    fill="url(#leaseGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="projected"
                    name="Projected 60d"
                    stroke={COLORS.orange}
                    strokeWidth={2}
                    fill="transparent"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[color:var(--grove-muted)]">
                Tracking begins with baseline
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[color:var(--grove-border)] bg-[color:var(--grove-card)] p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-[color:var(--grove-orange)]" />
            <h4 className="text-sm font-semibold text-[color:var(--grove-text)]">Economic Occupancy</h4>
            <span className="text-[10px] font-semibold rounded px-1.5 py-0.5 bg-[color:var(--grove-orange)]/20 text-[color:var(--grove-orange)]">
              ESTIMATE
            </span>
          </div>
          <div className="text-3xl font-bold tabular-nums text-[color:var(--grove-text)]">
            {economicOcc.toFixed(1)}%
          </div>
          <div className="text-xs text-[color:var(--grove-muted)] mt-1 flex items-center gap-1">
            <Info className="h-3 w-3" />
            Confirm via T12 once available
          </div>
        </div>

        <div className="rounded-xl border border-[color:var(--grove-border)] bg-[color:var(--grove-card)] p-5">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-4 w-4 text-[color:var(--grove-blue)]" />
            <h4 className="text-sm font-semibold text-[color:var(--grove-text)]">GPR (Gross Potential Rent)</h4>
          </div>
          <div className="text-3xl font-bold tabular-nums text-[color:var(--grove-text)]">
            {fmtDollar(metrics.gpr)}
          </div>
          <div className="text-xs text-[color:var(--grove-muted)] mt-1">Sum of market rent · {metrics.unitCount} units</div>
        </div>

        <div className="rounded-xl border border-[color:var(--grove-border)] bg-[color:var(--grove-card)] p-5">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 text-[color:var(--grove-red)]" />
            <h4 className="text-sm font-semibold text-[color:var(--grove-text)]">Loss-to-Lease</h4>
          </div>
          <div className="text-3xl font-bold tabular-nums text-[color:var(--grove-text)]">
            {metrics.lossToLeasePct.toFixed(1)}%
          </div>
          <div className="text-xs text-[color:var(--grove-muted)] mt-1">Portfolio weighted · Market vs Lease rent</div>
        </div>
      </div>
    </section>
  );
}
