"use client";

import { LucideIcon } from "lucide-react";
import type { StatusColor } from "@/lib/grove-config";
import { STATUS_HEX } from "@/lib/grove-config";

interface GaugeRingProps {
  percent: number; // 0-100
  status: StatusColor;
  icon: LucideIcon;
  label: string;
  value: string;
  size?: number;
}

export default function GaugeRing({ percent, status, icon: Icon, label, value, size = 120 }: GaugeRingProps) {
  const color = STATUS_HEX[status];
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className="h-8 w-8" style={{ color }} strokeWidth={1.75} />
        </div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold tabular-nums text-[color:var(--grove-text)]">{value}</div>
        <div className="text-[11px] uppercase tracking-wider font-medium text-[color:var(--grove-muted)]">{label}</div>
      </div>
    </div>
  );
}
