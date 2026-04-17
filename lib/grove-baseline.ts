// ─── /lib/grove-baseline.ts ────────────────────────────────────────────────
// Baseline snapshot + rolling history, persisted to localStorage.

"use client";

import { LS_KEYS, HISTORY_MAX } from "./grove-config";
import type { GroveMetrics } from "./grove-metrics";

export interface BaselineRecord {
  setOn: string; // ISO timestamp
  metrics: GroveMetrics;
}

export interface HistoryEntry {
  takenAt: string; // ISO
  metrics: GroveMetrics;
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadBaseline(): BaselineRecord | null {
  if (typeof window === "undefined") return null;
  return safeParse<BaselineRecord>(window.localStorage.getItem(LS_KEYS.baseline));
}

export function saveBaseline(metrics: GroveMetrics): BaselineRecord {
  const record: BaselineRecord = { setOn: new Date().toISOString(), metrics };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LS_KEYS.baseline, JSON.stringify(record));
  }
  return record;
}

export function clearBaseline() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(LS_KEYS.baseline);
    window.localStorage.removeItem(LS_KEYS.history);
  }
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  return safeParse<HistoryEntry[]>(window.localStorage.getItem(LS_KEYS.history)) ?? [];
}

export function pushHistory(metrics: GroveMetrics): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  const existing = loadHistory();
  const next = [...existing, { takenAt: new Date().toISOString(), metrics }].slice(-HISTORY_MAX);
  window.localStorage.setItem(LS_KEYS.history, JSON.stringify(next));
  return next;
}

// Helper: extract a single scalar field as a history-indexed sparkline series.
export function sparkSeries(history: HistoryEntry[], pick: (m: GroveMetrics) => number): number[] {
  return history.map((h) => pick(h.metrics));
}
