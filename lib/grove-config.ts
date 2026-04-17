// ─── /lib/grove-config.ts ──────────────────────────────────────────────────
// Central configuration for The Grove dashboard.
// Thresholds, color maps, keyword classifications — tune here, not in components.

export const GROVE_META = {
  name: "The Grove",
  city: "Victoria, TX",
  units: 288,
  manager: "Capstone Real Estate Services",
  system: "RealPage OneSite",
} as const;

// ─── Color palette ─────────────────────────────────────────────────────────
export const COLORS = {
  green: "#2ECC71",
  blue: "#3B82F6",
  orange: "#F97316",
  gray: "#8B9299",
  red: "#EF4444",
  yellow: "#F59E0B",
  bg: "#0A0A0A",
  card: "#141414",
  cardHover: "#1C1C1C",
  border: "#262626",
  textPrimary: "#FAFAFA",
  textMuted: "#A1A1AA",
} as const;

export type StatusColor = "good" | "warn" | "bad" | "neutral" | "unknown";

export const STATUS_HEX: Record<StatusColor, string> = {
  good: COLORS.green,
  warn: COLORS.yellow,
  bad: COLORS.red,
  neutral: COLORS.blue,
  unknown: COLORS.gray,
};

// ─── Scorecard thresholds ──────────────────────────────────────────────────
export const THRESHOLDS = {
  leasingVelocity: { red: 40, yellow: 70 }, // 0-100 score; higher better
  delinquencyScore: { red: 50, yellow: 80 }, // 0-100; higher better
  renovationRatio: { red: 30, yellow: 60 }, // percent of vacant that are ready
  occupancy: { red: 85, yellow: 90 }, // percent occupied
  delinquencyPctGPR: { warn: 5 }, // % of GPR → warning level
  evictionRisk: { red: 5 }, // count of delinquents w/ lease ending <60d
  topFiveConcentration: { red: 25 }, // % of total delinquency owed by top 5
} as const;

export function scoreToStatus(
  value: number,
  thresholds: { red: number; yellow: number },
  higherIsBetter = true
): StatusColor {
  if (higherIsBetter) {
    if (value < thresholds.red) return "bad";
    if (value < thresholds.yellow) return "warn";
    return "good";
  }
  if (value > thresholds.red) return "bad";
  if (value > thresholds.yellow) return "warn";
  return "good";
}

// ─── Make-ready classification keywords ────────────────────────────────────
// Parsed from Availability report comments (c49).
// Order matters: first match wins when scanning.
export type MakeReadyClass = "easy" | "medium" | "heavy" | "unknown";

export const MAKE_READY_KEYWORDS: { match: RegExp; cls: MakeReadyClass }[] = [
  // Heavy first so "heavy-carpet" isn't caught by "carpet"
  { match: /heavy[- ]?sayan/i, cls: "heavy" },
  { match: /heavy[- ]?carpet/i, cls: "heavy" },
  { match: /down[- ]?to[- ]?studs/i, cls: "heavy" },
  { match: /\bheavy\b/i, cls: "heavy" },
  { match: /sayan/i, cls: "heavy" },

  // Medium
  { match: /carpet[- ]?replace/i, cls: "medium" },
  { match: /trash[- ]?out/i, cls: "medium" },
  { match: /appliance/i, cls: "medium" },
  { match: /\bmedium\b/i, cls: "medium" },

  // Easy
  { match: /semper[- ]?fi/i, cls: "easy" },
  { match: /toilet/i, cls: "easy" },
  { match: /\bclean\b/i, cls: "easy" },
  { match: /\beasy\b/i, cls: "easy" },
];

export function classifyMakeReady(comment: string | undefined | null): MakeReadyClass {
  if (!comment || !comment.trim() || comment.trim() === "*") return "unknown";
  for (const { match, cls } of MAKE_READY_KEYWORDS) {
    if (match.test(comment)) return cls;
  }
  return "unknown";
}

export const MAKE_READY_COLOR: Record<MakeReadyClass, string> = {
  easy: COLORS.green,
  medium: COLORS.orange,
  heavy: COLORS.red,
  unknown: COLORS.gray,
};

export const MAKE_READY_LABEL: Record<MakeReadyClass, string> = {
  easy: "Easy",
  medium: "Medium",
  heavy: "Heavy",
  unknown: "Needs PM Input",
};

// ─── Floorplans ────────────────────────────────────────────────────────────
export const FLOORPLANS = ["A1", "A1P", "A2", "A2P", "B1", "B1P", "B2", "B2P", "C1", "C1P"] as const;

// ─── Aging buckets ─────────────────────────────────────────────────────────
export const AGING_BUCKETS = [
  { label: "0-30 days", min: 0, max: 30, color: COLORS.yellow },
  { label: "31-60 days", min: 31, max: 60, color: COLORS.orange },
  { label: "60+ days", min: 61, max: Infinity, color: COLORS.red },
] as const;

// ─── LocalStorage keys ─────────────────────────────────────────────────────
export const LS_KEYS = {
  baseline: "grove-baseline",
  history: "grove-history",
  settings: "grove-settings",
} as const;

export const HISTORY_MAX = 12;
