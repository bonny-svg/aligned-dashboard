"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MapPin,
  Home,
  Settings,
  Printer,
  RefreshCw,
  AlertTriangle,
  X,
  CloudUpload,
  Check,
  Share2,
} from "lucide-react";
import ScoreCard from "@/components/grove/ScoreCard";
import LeasingSection from "@/components/grove/LeasingSection";
import DelinquencySection from "@/components/grove/DelinquencySection";
import RenovationsSection from "@/components/grove/RenovationsSection";
import OccupancySection from "@/components/grove/OccupancySection";
import { parseRentRoll, parseAvailability, parseResidentBalances } from "@/lib/grove-parsers";
import { computeMetrics, type GroveMetrics } from "@/lib/grove-metrics";
import {
  loadBaseline,
  saveBaseline,
  clearBaseline,
  loadHistory,
  pushHistory,
  type BaselineRecord,
  type HistoryEntry,
} from "@/lib/grove-baseline";
import { GROVE_META } from "@/lib/grove-config";

const METRICS_CACHE_KEY = "grove-metrics-cache-v1";
const METRICS_CACHE_TS_KEY = "grove-metrics-cache-ts-v1";

function saveMetricsCache(uploadedAt: string, metrics: GroveMetrics) {
  try {
    localStorage.setItem(METRICS_CACHE_KEY, JSON.stringify(metrics));
    localStorage.setItem(METRICS_CACHE_TS_KEY, uploadedAt);
  } catch {}
}

function loadMetricsCache(): { metrics: GroveMetrics; uploadedAt: string } | null {
  try {
    const raw = localStorage.getItem(METRICS_CACHE_KEY);
    const ts = localStorage.getItem(METRICS_CACHE_TS_KEY);
    if (!raw || !ts) return null;
    return { metrics: JSON.parse(raw) as GroveMetrics, uploadedAt: ts };
  } catch {
    return null;
  }
}

type SyncStatus = "idle" | "loading" | "saved" | "error";

interface ServerSnapshot {
  uploadedAt: string;
  urls: { rentRoll: string; availability: string; residentBalances: string };
}

export default function TheGrovePage() {
  const [metrics, setMetrics] = useState<GroveMetrics | null>(null);
  const [baseline, setBaseline] = useState<BaselineRecord | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [serverSnapshot, setServerSnapshot] = useState<ServerSnapshot | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    const bl = loadBaseline();
    const hist = loadHistory();
    setBaseline(bl);
    setHistory(hist);
    setHydrated(true);

    // Show cached metrics immediately if available — eliminates the zero flash.
    const cached = loadMetricsCache();
    if (cached) setMetrics(cached.metrics);

    (async () => {
      try {
        const res = await fetch("/api/grove/snapshot", { cache: "no-store" });
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = (await res.json()) as { snapshot: ServerSnapshot | null; configured?: boolean };

        if (!data.snapshot) { setSyncStatus("idle"); return; }

        setServerSnapshot(data.snapshot);

        // If the cached version matches the server timestamp, skip the download.
        if (cached && cached.uploadedAt === data.snapshot.uploadedAt) {
          setSyncStatus("idle");
          return;
        }

        // Newer data — download all 3 files and recompute.
        const [rr, av, rb] = await Promise.all([
          fetch(data.snapshot.urls.rentRoll).then((r) => r.arrayBuffer()),
          fetch(data.snapshot.urls.availability).then((r) => r.arrayBuffer()),
          fetch(data.snapshot.urls.residentBalances).then((r) => r.arrayBuffer()),
        ]);
        const rentRoll = parseRentRoll(rr);
        const availability = parseAvailability(av);
        const balances = parseResidentBalances(rb);
        const computed = computeMetrics(rentRoll, availability, balances);
        setMetrics(computed);
        saveMetricsCache(data.snapshot.uploadedAt, computed);
        setSyncStatus("idle");
      } catch (err) {
        setSyncStatus("error");
        setSyncError(err instanceof Error ? err.message : "Failed to load data");
        if (!cached) setSyncStatus("idle"); // let the empty state show rather than spin forever
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist baseline + history whenever fresh computed metrics arrive
  useEffect(() => {
    if (!hydrated || !metrics || metrics.unitCount === 0) return;
    if (!baseline) {
      const saved = saveBaseline(metrics);
      setBaseline(saved);
    }
    setHistory(pushHistory(metrics));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics?.asOf]);

  const handleResetBaseline = useCallback(() => {
    clearBaseline();
    if (metrics && metrics.unitCount > 0) {
      const saved = saveBaseline(metrics);
      setBaseline(saved);
      setHistory([{ takenAt: saved.setOn, metrics }]);
    } else {
      setBaseline(null);
      setHistory([]);
    }
    setShowResetModal(false);
  }, [metrics]);

  const isLoading = syncStatus === "loading" && !metrics;
  const hasData = !!metrics && metrics.unitCount > 0;

  return (
    <div
      className="min-h-screen print:bg-white"
      style={
        {
          // Grove-scoped CSS vars so the rest of the app (light-themed Towne East) is unaffected.
          backgroundColor: "var(--grove-bg)",
          color: "var(--grove-text)",
          "--grove-green": "#2ECC71",
          "--grove-blue": "#3B82F6",
          "--grove-orange": "#F97316",
          "--grove-gray": "#8B9299",
          "--grove-red": "#EF4444",
          "--grove-yellow": "#F59E0B",
          "--grove-bg": "#0A0A0A",
          "--grove-card": "#141414",
          "--grove-card-hover": "#1C1C1C",
          "--grove-border": "#262626",
          "--grove-text": "#FAFAFA",
          "--grove-muted": "#A1A1AA",
        } as React.CSSProperties
      }
    >
      {/* Local animation keyframes + print styles */}
      <style jsx global>{`
        @keyframes grove-fade-up {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .grove-stagger > * {
          animation: grove-fade-up 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        .grove-stagger > *:nth-child(1) { animation-delay: 0ms; }
        .grove-stagger > *:nth-child(2) { animation-delay: 50ms; }
        .grove-stagger > *:nth-child(3) { animation-delay: 100ms; }
        .grove-stagger > *:nth-child(4) { animation-delay: 150ms; }
        .grove-stagger > *:nth-child(5) { animation-delay: 200ms; }
        .grove-stagger > *:nth-child(6) { animation-delay: 250ms; }
        .grove-stagger > *:nth-child(7) { animation-delay: 300ms; }
        @media print {
          .grove-no-print { display: none !important; }
          body, html { background: white !important; }
          .grove-root {
            background: white !important;
            color: black !important;
          }
          .grove-root * {
            box-shadow: none !important;
          }
        }
      `}</style>

      <div className="grove-root">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-[color:var(--grove-bg)]/85 backdrop-blur border-b border-[color:var(--grove-border)] grove-no-print">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight">{GROVE_META.name}</h1>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[color:var(--grove-blue)]/20 text-[color:var(--grove-blue)] border border-[color:var(--grove-blue)]/30">
                  {GROVE_META.units} UNITS
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 text-[color:var(--grove-muted)] border border-[color:var(--grove-border)]">
                  {GROVE_META.system}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-1 text-xs text-[color:var(--grove-muted)]">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {GROVE_META.city}
                </span>
                <span className="flex items-center gap-1">
                  <Home className="h-3.5 w-3.5" />
                  {GROVE_META.manager}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SyncBadge
                status={syncStatus}
                snapshot={serverSnapshot}
                error={syncError}
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-[color:var(--grove-border)] hover:bg-[color:var(--grove-card-hover)]"
                title="Copy shareable link"
              >
                <Share2 className="h-3.5 w-3.5" />
                Share
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-[color:var(--grove-border)] hover:bg-[color:var(--grove-card-hover)]"
              >
                <Printer className="h-3.5 w-3.5" />
                Print
              </button>
              <button
                type="button"
                onClick={() => setShowResetModal(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-[color:var(--grove-border)] hover:bg-[color:var(--grove-card-hover)]"
                aria-label="Reset baseline"
              >
                <Settings className="h-3.5 w-3.5" />
                Reset Baseline
              </button>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 grove-stagger">

          {/* Loading skeleton — shown only on first visit before cache is available */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <div className="h-10 w-10 rounded-full border-2 border-[color:var(--grove-blue)] border-t-transparent animate-spin" />
              <div className="text-sm text-[color:var(--grove-muted)]">Loading latest data…</div>
            </div>
          )}

          {!isLoading && metrics && (
            <>
              {parseError && (
                <div className="rounded-lg border border-[color:var(--grove-red)]/40 bg-[color:var(--grove-red)]/10 px-4 py-3 flex items-center gap-2 text-sm text-[color:var(--grove-red)]">
                  <AlertTriangle className="h-4 w-4" />
                  {parseError}
                </div>
              )}

              {metrics.dataHygieneWarnings.length > 0 && (
                <div className="rounded-lg border border-[color:var(--grove-yellow)]/30 bg-[color:var(--grove-yellow)]/10 px-4 py-3 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-[color:var(--grove-yellow)] shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-[color:var(--grove-yellow)]">Data hygiene</div>
                    <ul className="mt-1 space-y-0.5 text-xs text-[color:var(--grove-muted)]">
                      {metrics.dataHygieneWarnings.map((w, i) => (
                        <li key={i}>• {w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <ScoreCard
                metrics={metrics}
                baseline={baseline?.metrics ?? null}
                baselineSetOn={baseline?.setOn ?? null}
                lastUpdated={metrics.asOf}
              />
              <LeasingSection metrics={metrics} baseline={baseline?.metrics ?? null} history={history} />
              <DelinquencySection metrics={metrics} baseline={baseline?.metrics ?? null} history={history} />
              <RenovationsSection metrics={metrics} baseline={baseline?.metrics ?? null} />
              <OccupancySection metrics={metrics} baseline={baseline?.metrics ?? null} history={history} />
            </>
          )}
        </main>

        {/* Reset baseline modal */}
        {showResetModal && (
          <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 grove-no-print"
            onClick={() => setShowResetModal(false)}
          >
            <div
              className="rounded-xl border border-[color:var(--grove-border)] bg-[color:var(--grove-card)] p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-lg bg-[color:var(--grove-yellow)]/20 flex items-center justify-center text-[color:var(--grove-yellow)]">
                    <RefreshCw className="h-5 w-5" />
                  </div>
                  <h2 className="text-base font-semibold">Reset Baseline?</h2>
                </div>
                <button onClick={() => setShowResetModal(false)} className="text-[color:var(--grove-muted)] hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm text-[color:var(--grove-muted)] mb-5">
                This clears the current baseline and history. Your current snapshot becomes the new baseline
                — trend arrows reset to zero and sparklines restart. Use at the start of each quarter.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowResetModal(false)}
                  className="text-xs font-medium px-3 py-2 rounded-md border border-[color:var(--grove-border)] hover:bg-[color:var(--grove-card-hover)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetBaseline}
                  className="text-xs font-semibold px-3 py-2 rounded-md bg-[color:var(--grove-yellow)] text-black hover:bg-yellow-400"
                >
                  Reset & Re-baseline
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SyncBadge({ status, snapshot, error }: { status: SyncStatus; snapshot: ServerSnapshot | null; error: string | null }) {
  if (status === "loading") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-[color:var(--grove-border)] text-[color:var(--grove-muted)]">
        <CloudUpload className="h-3.5 w-3.5 animate-pulse" />
        Loading…
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-[color:var(--grove-red)]/40 bg-[color:var(--grove-red)]/10 text-[color:var(--grove-red)]" title={error ?? ""}>
        <AlertTriangle className="h-3.5 w-3.5" />
        Load failed
      </span>
    );
  }
  if (snapshot) {
    const when = new Date(snapshot.uploadedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-[color:var(--grove-green)]/40 bg-[color:var(--grove-green)]/10 text-[color:var(--grove-green)]">
        <Check className="h-3.5 w-3.5" />
        Data as of {when}
      </span>
    );
  }
  return null;
}

