"use client";

import { Users, UserPlus, Activity, FileSignature, LogIn, LogOut, Clock } from "lucide-react";
import SectionPill from "./SectionPill";
import HeroMetric from "./HeroMetric";
import type { GroveMetrics } from "@/lib/grove-metrics";
import { delta } from "@/lib/grove-metrics";
import { COLORS, scoreToStatus, THRESHOLDS } from "@/lib/grove-config";
import type { HistoryEntry } from "@/lib/grove-baseline";
import { sparkSeries } from "@/lib/grove-baseline";

interface Props {
  metrics: GroveMetrics;
  baseline: GroveMetrics | null;
  history: HistoryEntry[];
}

function heatmapColor(count: number, max: number): string {
  if (count === 0) return COLORS.border;
  const t = Math.min(1, count / Math.max(1, max));
  // blend blue → red
  const blue = { r: 59, g: 130, b: 246 };
  const red = { r: 239, g: 68, b: 68 };
  const r = Math.round(blue.r + (red.r - blue.r) * t);
  const g = Math.round(blue.g + (red.g - blue.g) * t);
  const b = Math.round(blue.b + (red.b - blue.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function LeasingSection({ metrics, baseline, history }: Props) {
  const maxCount = Math.max(1, ...metrics.leaseExpirationByMonth.map((m) => m.count));

  return (
    <section className="space-y-5">
      <SectionPill title="Leasing Pipeline" icon={Users} tone="blue" />

      {/* Hero row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <HeroMetric
          icon={Activity}
          label="Net Leasing Velocity"
          value={`${metrics.netLeasingVelocity >= 0 ? "+" : ""}${metrics.netLeasingVelocity}`}
          subLabel={`${metrics.signedLeasesCount} signed · ${metrics.moveOutsCount} move-outs`}
          status={scoreToStatus(metrics.netLeasingVelocityScore, THRESHOLDS.leasingVelocity, true)}
          delta={delta(metrics.netLeasingVelocity, baseline?.netLeasingVelocity ?? null)}
          deltaFormat="number"
          sparkValues={sparkSeries(history, (m) => m.netLeasingVelocity)}
          size="lg"
        />
        <HeroMetric
          icon={UserPlus}
          label="Leased Occupancy"
          value={`${metrics.leasedOccupancyPct.toFixed(1)}%`}
          subLabel="Occupied + NTV + Vacant-Leased"
          status={scoreToStatus(metrics.leasedOccupancyPct, THRESHOLDS.occupancy, true)}
          delta={delta(metrics.leasedOccupancyPct, baseline?.leasedOccupancyPct ?? null)}
          sparkValues={sparkSeries(history, (m) => m.leasedOccupancyPct)}
          size="lg"
        />
        <HeroMetric
          icon={FileSignature}
          label="Leases Signed MTD"
          value={`${metrics.signedLeasesMTD}`}
          subLabel="Signed this month (pending + moved in)"
          status="neutral"
          delta={delta(metrics.signedLeasesMTD, baseline?.signedLeasesMTD ?? null)}
          deltaFormat="number"
          sparkValues={sparkSeries(history, (m) => m.signedLeasesMTD)}
          size="lg"
        />
      </div>

      {/* Heatmap — full width */}
      <div className="rounded-xl border border-[color:var(--grove-border)] bg-[color:var(--grove-card)] p-6">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-[color:var(--grove-text)]">Lease Expiration Heatmap</h3>
          <p className="text-xs text-[color:var(--grove-muted)] mt-0.5">
            {metrics.expiring90DayCount} leases expire in next 90 days
          </p>
        </div>
        <div className="grid grid-cols-6 gap-3">
          {metrics.leaseExpirationByMonth.map((m) => (
            <div
              key={m.month}
              className="aspect-square rounded-lg flex flex-col items-center justify-center p-3 border border-white/5"
              style={{ backgroundColor: heatmapColor(m.count, maxCount) }}
              title={`${m.month}: ${m.count} leases`}
            >
              <div className="text-3xl font-bold tabular-nums text-white drop-shadow">{m.count}</div>
              <div className="text-[11px] uppercase tracking-wider text-white/90 mt-1">{m.month}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DetailCard
          icon={Clock}
          title="Month-to-Month Risk"
          count={metrics.monthToMonthRisk.length}
          tone="warn"
          items={metrics.monthToMonthRisk.slice(0, 8).map((u) => ({
            left: u.unit,
            middle: u.residentName,
            right: `exp. ${u.leaseEnd}`,
          }))}
          empty="No month-to-month residents"
        />
        <DetailCard
          icon={LogIn}
          title="Lease Starts This Month"
          count={metrics.leaseStartsThisMonth.length}
          tone="good"
          items={metrics.leaseStartsThisMonth.slice(0, 8).map((u) => ({
            left: u.unit,
            middle: u.residentName,
            right: u.leaseStart,
          }))}
          empty="No lease starts this month"
        />
        <DetailCard
          icon={LogOut}
          title="Upcoming Move-Outs (NTV)"
          count={metrics.moveOutsThisMonth.length}
          tone="bad"
          items={metrics.moveOutsThisMonth.slice(0, 8).map((u) => ({
            left: u.unit,
            middle: u.residentName,
            right: u.moveOutDate,
          }))}
          empty="No upcoming NTV move-outs"
        />
      </div>
    </section>
  );
}

function DetailCard({
  icon: Icon,
  title,
  count,
  items,
  tone,
  empty,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count: number;
  items: { left: string; middle: string; right: string }[];
  tone: "good" | "warn" | "bad";
  empty: string;
}) {
  const toneColor = tone === "good" ? COLORS.green : tone === "warn" ? COLORS.yellow : COLORS.red;
  return (
    <div className="rounded-xl border border-[color:var(--grove-border)] bg-[color:var(--grove-card)] p-5 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="h-8 w-8 rounded-md flex items-center justify-center"
            style={{ backgroundColor: `${toneColor}20`, color: toneColor }}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="text-sm font-semibold text-[color:var(--grove-text)]">{title}</div>
        </div>
        <div className="text-2xl font-bold tabular-nums" style={{ color: toneColor }}>
          {count}
        </div>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-[color:var(--grove-muted)] italic py-4">{empty}</div>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
          {items.map((it, i) => (
            <div
              key={`${it.left}-${i}`}
              className="flex items-center justify-between gap-2 text-xs py-1 border-b border-[color:var(--grove-border)] last:border-b-0"
            >
              <span className="font-mono font-semibold text-[color:var(--grove-text)] w-12 shrink-0">{it.left}</span>
              <span className="truncate text-[color:var(--grove-muted)] flex-1">{it.middle}</span>
              <span className="tabular-nums text-[color:var(--grove-muted)] text-[11px]">{it.right}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
