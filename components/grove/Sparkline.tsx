"use client";

interface SparklineProps {
  values: number[];
  color?: string;
  height?: number;
  width?: number;
}

export default function Sparkline({ values, color = "#3B82F6", height = 28, width = 96 }: SparklineProps) {
  if (values.length < 2) {
    return (
      <div className="text-[10px] text-[color:var(--grove-muted)] italic tabular-nums">
        Tracking begins with baseline
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const last = values[values.length - 1];
  const lastX = width;
  const lastY = height - ((last - min) / range) * height;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth={1.5} points={points} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={2} fill={color} />
    </svg>
  );
}
