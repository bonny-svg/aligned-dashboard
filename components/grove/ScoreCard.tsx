"use client";

import { Users, AlertTriangle, Wrench, Building2 } from "lucide-react";
import GaugeRing from "./GaugeRing";
import TrendArrow from "./TrendArrow";
import type { GroveMetrics } from "@/lib/grove-metrics";
import { THRESHOLDS, scoreToStatus } from "@/lib/grove-config";
import { delta } from "@/lib/grove-metrics";

interface ScoreCardProps {
  metrics: GroveMetrics;
  baseline: GroveMetrics | null;
  baselineSetOn: string | null;
  lastUpdated: string;
}

export default function ScoreCard({ metrics, baseline, baselineSetOn, lastUpdated }: ScoreCardProps) {
  const rings = [
    {
      label: "Leasing Health",
      icon: Users,
      value: Math.round(metrics.netLeasingVelocityScore),
      display: `${Math.round(metrics.netLeasingVelocityScore)}`,
      percent: metrics.netLeasingVelocityScore,
      status: scoreToStatus(metrics.netLeasingVelocityScore, THRESHOLDS.leasingVelocity, true),
      delta: delta(metrics.netLeasingVelocityScore, baseline?.netLeasingVelocityScore ?? null),
      higherIsBetter: true,
    },
    {
      label: "Delinquency Health",
      icon: AlertTriangle,
      value: Math.round(metrics.delinquencyScore),
      display: `${Math.round(metrics.delinquencyScore)}`,
      percent: metrics.delinquencyScore,
      status: scoreToStatus(metrics.delinquencyScore, THRESHOLDS.delinquencyScore, true),
      delta: delta(metrics.delinquencyScore, baseline?.delinquencyScore ?? null),
      higherIsBetter: true,
    },
    {
      label: "Renovation Health",
      icon: Wrench,
      value: metrics.rentReadyRatio,
      display: `${metrics.rentReadyRatio.toFixed(0)}%`,
      percent: metrics.rentReadyRatio,
      status: scoreToStatus(metrics.rentReadyRatio, THRESHOLDS.renovationRatio, true),
      delta: delta(metrics.rentReadyRatio, baseline?.rentReadyRatio ?? null),
      higherIsBetter: true,
    },
    {
      label: "Occupancy Health",
      icon: Building2,
      value: metrics.physicalOccupancyPct,
      display: `${metrics.physicalOccupancyPct.toFixed(1)}%`,
      percent: metrics.physicalOccupancyPct,
      status: scoreToStatus(metrics.physicalOccupancyPct, THRESHOLDS.occupancy, true),
      delta: delta(metrics.physicalOccupancyPct, baseline?.physicalOccupancyPct ?? null),
      higherIsBetter: true,
    },
  ];

  // Auto-narrative: worst performing ring
  const worst = [...rings].sort((a, b) => a.percent - b.percent)[0];
  let narrative = "";
  if (worst.label === "Delinquency Health") {
    narrative = `Focus area: Delinquency — $${(metrics.totalDelinquent / 1000).toFixed(0)}K across ${metrics.delinquentCount} residents requires immediate attention.`;
  } else if (worst.label === "Renovation Health") {
    narrative = `Focus area: Renovations — only ${metrics.rentReadyCount} of ${metrics.vacantTotalCount} vacant units are rent-ready.`;
  } else if (worst.label === "Leasing Health") {
    narrative = `Focus area: Leasing — net velocity is ${metrics.netLeasingVelocity > 0 ? "+" : ""}${metrics.netLeasingVelocity} leases this period.`;
  } else if (worst.label === "Occupancy Health") {
    narrative = `Focus area: Occupancy — ${metrics.physicalOccupancyPct.toFixed(1)}% physical, ${288 - metrics.occupiedCount - metrics.occupiedNTVCount} units need residents.`;
  }

  return (
    <div className="rounded-2xl border border-[color:var(--grove-border)] bg-[color:var(--grove-card)] p-6">
      <div className="flex items-center justify-between mb-5 text-xs text-[color:var(--grove-muted)]">
        <span>
          Last updated:{" "}
          <span className="text-[color:var(--grove-text)] font-medium">
            {new Date(lastUpdated).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </span>
        <span>
          Baseline set on:{" "}
          <span className="text-[color:var(--grove-text)] font-medium">
            {baselineSetOn
              ? new Date(baselineSetOn).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "—"}
          </span>
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {rings.map((r) => (
          <div
            key={r.label}
            className="flex flex-col items-center gap-3 p-4 rounded-lg hover:bg-[color:var(--grove-card-hover)] transition-colors"
          >
            <GaugeRing
              percent={r.percent}
              status={r.status}
              icon={r.icon}
              label={r.label}
              value={r.display}
            />
            <TrendArrow delta={r.delta} higherIsBetter={r.higherIsBetter} />
          </div>
        ))}
      </div>
      {narrative && (
        <div className="mt-5 pt-5 border-t border-[color:var(--grove-border)] text-sm text-[color:var(--grove-text)]">
          <span className="text-[color:var(--grove-muted)]">→ </span>
          {narrative}
        </div>
      )}
    </div>
  );
}
