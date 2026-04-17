"use client";

import { LucideIcon } from "lucide-react";

interface SectionPillProps {
  title: string;
  icon: LucideIcon;
  tone?: "blue" | "red" | "orange" | "green";
  subtitle?: string;
}

const TONE_STYLES: Record<NonNullable<SectionPillProps["tone"]>, string> = {
  blue: "bg-[color:var(--grove-blue)]",
  red: "bg-[color:var(--grove-red)]",
  orange: "bg-[color:var(--grove-orange)]",
  green: "bg-[color:var(--grove-green)]",
};

export default function SectionPill({ title, icon: Icon, tone = "blue", subtitle }: SectionPillProps) {
  return (
    <div
      className={`${TONE_STYLES[tone]} rounded-full py-2.5 px-6 flex items-center justify-between shadow-lg shadow-black/40`}
    >
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-white" strokeWidth={2.25} />
        </div>
      </div>
      <h2 className="text-white font-semibold text-base sm:text-lg tracking-tight">{title}</h2>
      <div className="min-w-[36px] text-right">
        {subtitle && <span className="text-white/90 text-xs font-medium">{subtitle}</span>}
      </div>
    </div>
  );
}
