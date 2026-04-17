"use client";

import { LucideIcon } from "lucide-react";
import TrendArrow from "./TrendArrow";
import Sparkline from "./Sparkline";
import type { StatusColor } from "@/lib/grove-config";
import { STATUS_HEX } from "@/lib/grove-config";

interface HeroMetricProps {
  icon: LucideIcon;
  label: string;
  value: string;
  subLabel?: string;
  status?: StatusColor;
  delta?: number | null;
  higherIsBetter?: boolean;
  deltaFormat?: "pct" | "number" | "dollar";
  sparkValues?: number[];
  size?: "md" | "lg" | "xl";
}

const SIZE_MAP = {
  md: "text-4xl",
  lg: "text-5xl",
  xl: "text-7xl",
};

export default function HeroMetric({
  icon: Icon,
  label,
  value,
  subLabel,
  status = "neutral",
  delta = null,
  higherIsBetter = true,
  deltaFormat = "pct",
  sparkValues = [],
  size = "lg",
}: HeroMetricProps) {
  const color = STATUS_HEX[status];
  const gradStart = `${color}22`;
  const gradEnd = `${color}05`;

  return (
    <div
      className="rounded-xl border border-[color:var(--grove-border)] bg-[color:var(--grove-card)] p-6 relative overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(135deg, ${gradStart} 0%, ${gradEnd} 100%), linear-gradient(var(--grove-card), var(--grove-card))`,
      }}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div
          className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}20`, color }}
        >
          <Icon className="h-5 w-5" />
        </div>
        {sparkValues.length > 1 && <Sparkline values={sparkValues} color={color} />}
      </div>
      <div className="flex items-baseline gap-3 flex-wrap">
        <div
          className={`${SIZE_MAP[size]} font-bold tabular-nums leading-none tracking-tight`}
          style={{ color: status === "neutral" ? "var(--grove-text)" : color }}
        >
          {value}
        </div>
        <TrendArrow delta={delta} higherIsBetter={higherIsBetter} format={deltaFormat} />
      </div>
      <div className="mt-2 text-xs text-[color:var(--grove-muted)] font-medium uppercase tracking-wider">
        {label}
      </div>
      {subLabel && <div className="text-xs text-[color:var(--grove-muted)] mt-1">{subLabel}</div>}
    </div>
  );
}
