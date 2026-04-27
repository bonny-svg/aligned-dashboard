"use client";

import { Wrench, CheckCircle, Hammer, AlertTriangle, Clock, XCircle } from "lucide-react";
import SectionPill from "./SectionPill";
import TrendArrow from "./TrendArrow";
import type { GroveMetrics } from "@/lib/grove-metrics";
import { delta } from "@/lib/grove-metrics";
import { COLORS, MAKE_READY_COLOR, MAKE_READY_LABEL, THRESHOLDS, scoreToStatus } from "@/lib/grove-config";

interface Props {
  metrics: GroveMetrics;
  baseline: GroveMetrics | null;
}

export default function RenovationsSection({ metrics, baseline }: Props) {
  const status = scoreToStatus(metrics.rentReadyRatio, THRESHOLDS.renovationRatio, true);
  const readyColor = status === "good" ? COLORS.green : status === "warn" ? COLORS.yellow : COLORS.red;
  const totalClassified = metrics.makeReadyBreakdown.reduce((s, b) => s + b.count, 0);

  return (
    <section className="space-y-5">
      <SectionPill title="Unit Renovations & Make-Ready" icon={Wrench} tone="orange" />

      {/* Pre-leased alert — only shown when there's a problem */}
      {metrics.preLeasedNotReady.length > 0 && (
        <div className="rounded-xl border border-[color:var(--grove-red)]/40 bg-[color:var(--grove-red)]/8 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-[color:var(--grove-red)]" />
            <h3 className="text-sm font-semibold text-[color:var(--grove-red)]">
              {metrics.preLeasedNotReady.length} Pre-Leased Unit{metrics.preLeasedNotReady.length > 1 ? "s" : ""} Not Yet Ready
            </h3>
          </div>
          <div className="space-y-1">
            <div className="grid grid-cols-4 gap-2 text-[10px] uppercase tracking-wider text-[color:var(--grove-muted)] pb-1 border-b border-[color:var(--grove-border)]">
              <span>Unit</span>
              <span>Floorplan</span>
              <span>Ready Date</span>
              <span>Move-In</span>
            </div>
            {metrics.preLeasedNotReady.map((u) => (
              <div key={u.unit} className="grid grid-cols-4 gap-2 text-xs py-1.5 border-b border-[color:var(--grove-border)]/50 last:border-b-0">
                <span className="font-mono font-semibold text-[color:var(--grove-text)]">{u.unit}</span>
                <span className="text-[color:var(--grove-muted)]">{u.floorplan || "—"}</span>
                <span className={u.overdue ? "text-[color:var(--grove-red)] font-semibold" : "text-[color:var(--grove-yellow)]"}>
                  {u.makeReady || "Not set"}
                  {u.daysUntilReady != null && ` (${u.daysUntilReady}d)`}
                </span>
                <span className="text-[color:var(--grove-text)]">
                  {u.scheduledMoveIn || "—"}
                  {u.daysUntilMoveIn != null && ` (${u.daysUntilMoveIn}d)`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status summary — 4 stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={XCircle}
          label="Total Vacant"
          value={metrics.vacantTotalCount}
          color={COLORS.gray}
        />
        <StatCard
          icon={CheckCircle}
          label="Ready Today"
          value={metrics.rentReadyCount}
          sub={`${metrics.rentReadyRatio.toFixed(0)}% of vacant`}
          color={readyColor}
          delta={delta(metrics.rentReadyCount, baseline?.rentReadyCount ?? null)}
        />
        <StatCard
          icon={Hammer}
          label="In Process"
          value={metrics.inProcessCount}
          sub="Make-ready scheduled"
          color={COLORS.yellow}
        />
        <StatCard
          icon={Clock}
          label="Not Started"
          value={metrics.notStartedCount}
          sub="No make-ready date"
          color={metrics.notStartedCount > 0 ? COLORS.red : COLORS.gray}
        />
      </div>

      {/* Make-ready classification */}
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
                      className="flex flex-col items-center justify-center text-white"
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
    </section>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  delta: deltaVal,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  sub?: string;
  color: string;
  delta?: number | null;
}) {
  return (
    <div
      className="rounded-xl border border-[color:var(--grove-border)] bg-[color:var(--grove-card)] p-5"
      style={{ backgroundImage: `linear-gradient(135deg, ${color}14 0%, ${color}02 100%), linear-gradient(var(--grove-card), var(--grove-card))` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="h-8 w-8 rounded-md flex items-center justify-center" style={{ backgroundColor: `${color}20`, color }}>
          <Icon className="h-4 w-4" />
        </div>
        {deltaVal !== undefined && deltaVal !== null && (
          <TrendArrow delta={deltaVal} higherIsBetter={true} format="number" />
        )}
      </div>
      <div className="text-3xl font-bold tabular-nums" style={{ color }}>{value}</div>
      <div className="text-xs font-semibold text-[color:var(--grove-text)] mt-1">{label}</div>
      {sub && <div className="text-[11px] text-[color:var(--grove-muted)] mt-0.5">{sub}</div>}
    </div>
  );
}
