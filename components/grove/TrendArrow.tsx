"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface TrendArrowProps {
  delta: number | null;
  higherIsBetter?: boolean;
  format?: "pct" | "number" | "dollar";
  showZero?: boolean;
}

function fmtDelta(delta: number, format: TrendArrowProps["format"]): string {
  const abs = Math.abs(delta);
  const sign = delta > 0 ? "+" : "-";
  if (format === "dollar") {
    if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  }
  if (format === "number") return `${sign}${abs.toFixed(1)}`;
  return `${sign}${abs.toFixed(1)}%`;
}

export default function TrendArrow({
  delta,
  higherIsBetter = true,
  format = "pct",
  showZero = false,
}: TrendArrowProps) {
  if (delta == null || (!showZero && Math.abs(delta) < 0.1)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--grove-muted)]">
        <Minus className="h-3 w-3" />
        <span className="tabular-nums">—</span>
      </span>
    );
  }

  const isImprovement = higherIsBetter ? delta > 0 : delta < 0;
  const color = isImprovement ? "text-[color:var(--grove-green)]" : "text-[color:var(--grove-red)]";
  const Icon = delta > 0 ? TrendingUp : TrendingDown;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${color}`}>
      <Icon className="h-3.5 w-3.5" />
      <span className="tabular-nums">{fmtDelta(delta, format)}</span>
    </span>
  );
}
