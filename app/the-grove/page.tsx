"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MapPin,
  Home,
  Settings,
  Printer,
  RefreshCw,
  AlertTriangle,
  X,
  FileSpreadsheet,
  CloudUpload,
  Check,
  Share2,
} from "lucide-react";
import FileDropZone, { UploadedFiles } from "@/components/grove/FileDropZone";
import ScoreCard from "@/components/grove/ScoreCard";
import LeasingSection from "@/components/grove/LeasingSection";
import DelinquencySection from "@/components/grove/DelinquencySection";
import RenovationsSection from "@/components/grove/RenovationsSection";
import OccupancySection from "@/components/grove/OccupancySection";
import {
  parseRentRoll,
  parseAvailability,
  parseResidentBalances,
  type RentRollUnit,
  type AvailabilityUnit,
  type ResidentBalance,
} from "@/lib/grove-parsers";
import { computeMetrics, emptyMetrics, type GroveMetrics } from "@/lib/grove-metrics";
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

type SyncStatus = "idle" | "loading" | "uploading" | "saved" | "error";

interface ServerSnapshot {
  uploadedAt: string;
  urls: { rentRoll: string; availability: string; residentBalances: string };
}

export default function TheGrovePage() {
  const [files, setFiles] = useState<UploadedFiles>({});
  const [rentRoll, setRentRoll] = useState<RentRollUnit[]>([]);
  const [availability, setAvailability] = useState<AvailabilityUnit[]>([]);
  const [balances, setBalances] = useState<ResidentBalance[]>([]);
  const [baseline, setBaseline] = useState<BaselineRecord | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Server-sync state for cross-user sharing
  const [serverSnapshot, setServerSnapshot] = useState<ServerSnapshot | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [blobConfigured, setBlobConfigured] = useState<boolean | null>(null);

  // Hydration: load baseline + history + most-recent server snapshot
  useEffect(() => {
    setBaseline(loadBaseline());
    setHistory(loadHistory());
    setHydrated(true);

    (async () => {
      try {
        const res = await fetch("/api/grove/snapshot", { cache: "no-store" });
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = (await res.json()) as {
          snapshot: ServerSnapshot | null;
          configured?: boolean;
        };
        setBlobConfigured(data.configured ?? true);
        if (data.snapshot) {
          setServerSnapshot(data.snapshot);
          // Download the 3 files in parallel, turn into buffers, populate `files`.
          const [rr, av, rb] = await Promise.all([
            fetch(data.snapshot.urls.rentRoll).then((r) => r.arrayBuffer()),
            fetch(data.snapshot.urls.availability).then((r) => r.arrayBuffer()),
            fetch(data.snapshot.urls.residentBalances).then((r) => r.arrayBuffer()),
          ]);
          setFiles({
            rentRoll: { name: "Rent Roll.xls", buffer: rr },
            availability: { name: "Availability.xls", buffer: av },
            residentBalances: { name: "Resident Balances.xls", buffer: rb },
          });
        }
        setSyncStatus("idle");
      } catch (err) {
        setSyncStatus("idle");
        setBlobConfigured(false);
        setSyncError(err instanceof Error ? err.message : "Failed to load shared snapshot");
      }
    })();
  }, []);

  // Parse files on upload
  useEffect(() => {
    setParseError(null);
    try {
      if (files.rentRoll) setRentRoll(parseRentRoll(files.rentRoll.buffer));
      if (files.availability) setAvailability(parseAvailability(files.availability.buffer));
      if (files.residentBalances) setBalances(parseResidentBalances(files.residentBalances.buffer));
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse files");
    }
  }, [files]);

  // When the user has uploaded a fresh set of 3 files locally, push them to the server
  // so collaborators see the same data. We only push when all 3 are present AND they
  // differ from what the server currently has (i.e., this upload didn't come FROM the server).
  const handleFilesReady = useCallback(
    async (next: UploadedFiles) => {
      setFiles(next);
      const complete = next.rentRoll && next.availability && next.residentBalances;
      if (!complete) return;

      // Skip upload if these buffers came from the server snapshot (same sizes).
      if (
        serverSnapshot &&
        next.rentRoll &&
        next.availability &&
        next.residentBalances &&
        next.rentRoll.name.startsWith("Rent Roll") &&
        files.rentRoll?.buffer === next.rentRoll.buffer
      ) {
        return;
      }

      // If Vercel Blob isn't set up yet, skip the server upload entirely —
      // the setup banner explains why. Files still parse locally.
      if (blobConfigured === false) return;

      setSyncStatus("uploading");
      setSyncError(null);
      try {
        const fd = new FormData();
        fd.append("rentRoll", new Blob([next.rentRoll!.buffer]), next.rentRoll!.name);
        fd.append("availability", new Blob([next.availability!.buffer]), next.availability!.name);
        fd.append("residentBalances", new Blob([next.residentBalances!.buffer]), next.residentBalances!.name);
        const res = await fetch("/api/grove/snapshot", { method: "POST", body: fd });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || `Upload failed (${res.status})`);
        setServerSnapshot(body);
        setSyncStatus("saved");
      } catch (err) {
        setSyncStatus("error");
        setSyncError(err instanceof Error ? err.message : "Upload failed");
      }
    },
    [serverSnapshot, files.rentRoll, blobConfigured]
  );

  const metrics = useMemo<GroveMetrics>(() => {
    if (rentRoll.length === 0 && availability.length === 0 && balances.length === 0) {
      return emptyMetrics();
    }
    return computeMetrics(rentRoll, availability, balances);
  }, [rentRoll, availability, balances]);

  // Persist baseline + history the first time real data arrives
  useEffect(() => {
    if (!hydrated) return;
    if (metrics.unitCount === 0) return;
    if (!baseline) {
      const saved = saveBaseline(metrics);
      setBaseline(saved);
    }
    setHistory(pushHistory(metrics));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics.asOf]);

  const handleResetBaseline = useCallback(() => {
    clearBaseline();
    if (metrics.unitCount > 0) {
      const saved = saveBaseline(metrics);
      setBaseline(saved);
      setHistory([{ takenAt: saved.setOn, metrics }]);
    } else {
      setBaseline(null);
      setHistory([]);
    }
    setShowResetModal(false);
  }, [metrics]);

  const hasData = metrics.unitCount > 0;

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
                configured={blobConfigured}
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
          {/* File dropzone */}
          <div className="grove-no-print">
            <FileDropZone onFilesReady={handleFilesReady} uploaded={files} />
          </div>

          {parseError && (
            <div className="rounded-lg border border-[color:var(--grove-red)]/40 bg-[color:var(--grove-red)]/10 px-4 py-3 flex items-center gap-2 text-sm text-[color:var(--grove-red)] grove-no-print">
              <AlertTriangle className="h-4 w-4" />
              {parseError}
            </div>
          )}

          {blobConfigured === false && (
            <div className="rounded-lg border border-[color:var(--grove-blue)]/30 bg-[color:var(--grove-blue)]/5 px-4 py-3 flex items-start gap-3 grove-no-print">
              <CloudUpload className="h-5 w-5 text-[color:var(--grove-blue)] shrink-0 mt-0.5" />
              <div className="flex-1 text-sm">
                <div className="font-semibold text-[color:var(--grove-text)]">Sharing not set up yet</div>
                <div className="text-[color:var(--grove-muted)] mt-0.5">
                  Right now, uploaded files only live in your browser. To share a live link with coworkers,
                  enable Vercel Blob in your Vercel project:{" "}
                  <span className="text-[color:var(--grove-text)]">Dashboard → Storage → Create Database → Blob → Connect to this project</span>.
                  After it&rsquo;s enabled, redeploy once and uploads will auto-persist.
                </div>
              </div>
            </div>
          )}

          {!hasData ? (
            <EmptyState />
          ) : (
            <>
              {/* Data hygiene warning */}
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

function SyncBadge({
  status,
  snapshot,
  error,
  configured,
}: {
  status: SyncStatus;
  snapshot: ServerSnapshot | null;
  error: string | null;
  configured: boolean | null;
}) {
  if (status === "loading") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-[color:var(--grove-border)] text-[color:var(--grove-muted)]">
        <CloudUpload className="h-3.5 w-3.5 animate-pulse" />
        Loading shared data…
      </span>
    );
  }
  if (status === "uploading") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-[color:var(--grove-blue)]/40 bg-[color:var(--grove-blue)]/10 text-[color:var(--grove-blue)]">
        <CloudUpload className="h-3.5 w-3.5 animate-pulse" />
        Saving to shared link…
      </span>
    );
  }
  // Only surface a "Sync failed" error if sharing is set up. When Blob isn't
  // configured, the banner above explains the situation — no alarming chip.
  if (status === "error" && configured !== false) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-[color:var(--grove-red)]/40 bg-[color:var(--grove-red)]/10 text-[color:var(--grove-red)]"
        title={error ?? ""}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        Sync failed
      </span>
    );
  }
  if (snapshot) {
    const when = new Date(snapshot.uploadedAt).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-[color:var(--grove-green)]/40 bg-[color:var(--grove-green)]/10 text-[color:var(--grove-green)]">
        <Check className="h-3.5 w-3.5" />
        Shared · {when}
      </span>
    );
  }
  if (configured === false) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-[color:var(--grove-border)] text-[color:var(--grove-muted)]">
        <CloudUpload className="h-3.5 w-3.5" />
        Sharing not set up
      </span>
    );
  }
  return null;
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-[color:var(--grove-border)] bg-[color:var(--grove-card)] p-12 text-center">
      <div className="h-16 w-16 rounded-xl bg-[color:var(--grove-blue)]/15 flex items-center justify-center mx-auto mb-4">
        <FileSpreadsheet className="h-8 w-8 text-[color:var(--grove-blue)]" />
      </div>
      <h3 className="text-lg font-semibold text-[color:var(--grove-text)]">Upload your 3 OneSite reports to begin</h3>
      <p className="text-sm text-[color:var(--grove-muted)] mt-2 max-w-md mx-auto">
        Drop <span className="font-medium text-[color:var(--grove-text)]">Rent Roll Detail</span>,{" "}
        <span className="font-medium text-[color:var(--grove-text)]">Availability</span>, and{" "}
        <span className="font-medium text-[color:var(--grove-text)]">Resident Balances by Fiscal Period</span> above. The
        first upload becomes the baseline against which every future snapshot is measured.
      </p>
    </div>
  );
}
