"use client";

import { Building2, DollarSign, TrendingUp } from "lucide-react";
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
  // Leasing velocity gauge: 50 = neutral (0 net), clamped 0–100
  const velocityGaugePct = Math.max(0, Math.min(100, 50 + metrics.netLeasingVelocity * 5));
  const velocityStatus: "good" | "warn" | "bad" = metrics.netLeasingVelocity >= 3
    ? "good"
    : metrics.netLeasingVelocity >= 0
    ? "warn"
    : "bad";

  const rings = [
    {
      label: "Current Occupancy",
      icon: Building2,
      display: `${metrics.physicalOccupancyPct.toFixed(1)}%`,
      percent: metrics.physicalOccupancyPct,
      status: scoreToStatus(metrics.physicalOccupancyPct, THRESHOLDS.occupancy, true),
      delta: delta(metrics.physicalOccupancyPct, baseline?.physicalOccupancyPct ?? null),
      higherIsBetter: true,
    },
    {
      label: "Economic Occupancy",
      icon: DollarSign,
      display: `${metrics.economicOccupancyPct.toFixed(1)}%`,
      percent: metrics.economicOccupancyPct,
      status: scoreToStatus(metrics.economicOccupancyPct, THRESHOLDS.occupancy, true),
      delta: delta(metrics.economicOccupancyPct, baseline?.economicOccupancyPct ?? null),
      higherIsBetter: true,
    },
    {
      label: "Leasing Velocity",
      icon: TrendingUp,
      display: `${metrics.netLeasingVelocity > 0 ? "+" : ""}${metrics.netLeasingVelocity}`,
      percent: velocityGaugePct,
      status: velocityStatus,
      delta: delta(metrics.netLeasingVelocity, baseline?.netLeasingVelocity ?? null),
      higherIsBetter: true,
    },
  ];

  // Narrative: highlight the most pressing issue
  const physOcc = metrics.physicalOccupancyPct;
  let narrative = "";
  if (metrics.netLeasingVelocity < 0) {
    narrative = `Leasing velocity is negative (${metrics.netLeasingVelocity}) — ${metrics.signedLeasesCount} leases signed vs ${metrics.moveOutsCount} scheduled move-outs.`;
  } else if (physOcc < 90) {
    narrative = `Occupancy at ${physOcc.toFixed(1)}% — ${288 - metrics.occupiedCount - metrics.occupiedNTVCount} units need residents.`;
  } else if (metrics.economicOccupancyPct < metrics.physicalOccupancyPct - 5) {
    narrative = `Economic occupancy (${metrics.economicOccupancyPct.toFixed(1)}%) trails physical occupancy by ${(metrics.physicalOccupancyPct - metrics.economicOccupancyPct).toFixed(1)} pts — check loss-to-lease.`;
  } else {
    narrative = `${metrics.signedLeasesCount} leases signed, ${metrics.moveOutsCount} scheduled move-outs — net velocity ${metrics.netLeasingVelocity > 0 ? "+" : ""}${metrics.netLeasingVelocity}.`;
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
      <div className="grid grid-cols-3 gap-4">
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
