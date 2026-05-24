// Accepts pre-computed TowneEastMetrics JSON from the email agent's MMR/PDF fast-path.
// Writes directly to towne-east/latest/metrics.json so the dashboard can read it
// without needing the three OneSite XLS files.
//
// POST: application/json { metrics: TowneEastMetrics, sections?: { hasCollections, hasDelinquency, hasOccupancy } }
// Protected by x-upload-key (same env var as the snapshot endpoint)
//
// MERGE RULES:
//   • New month (asOf year-month changes): wipe blob, start fresh
//   • Same month, sections.hasCollections=true:  write collection fields even if 0
//   • Same month, sections.hasCollections=false: SKIP collection fields that are 0/empty
//                 (preserves good data when a rent-roll-only run has no financial PDFs)
//   • Same for sections.hasDelinquency
//   • Occupancy/leasing fields: always skip zeros (protect rent roll data across partial runs)
//   • leaseExpirationByMonth: only overwrite if incoming has any expiring > 0

import { NextRequest, NextResponse } from "next/server";
import { put, list } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const METRICS_PATH = "towne-east/latest/metrics.json";

async function putAdaptive(path: string, body: Buffer, contentType: string) {
  const base = { addRandomSuffix: false, allowOverwrite: true, contentType };
  try {
    return await put(path, body, { ...base, access: "public" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/private store|private access/i.test(msg)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await put(path, body, { ...base, access: "private" as any });
    }
    throw err;
  }
}

function yearMonth(asOf: unknown): string | null {
  if (typeof asOf !== "string" || asOf.length < 7) return null;
  // ISO format: "2026-05-22" → "2026-05"
  const iso = asOf.match(/^(\d{4})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  // US format: "05/22/2026" → "2026-05"
  const us = asOf.match(/^(\d{2})\/\d{2}\/(\d{4})/);
  if (us) return `${us[2]}-${us[1]}`;
  // Fallback: first 7 chars (legacy)
  return asOf.slice(0, 7);
}

export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Blob not configured." }, { status: 500 });
  }

  const required = process.env.TOWNE_EAST_UPLOAD_KEY;
  const provided  = req.headers.get("x-upload-key");
  if (required && provided !== required) {
    return NextResponse.json({ error: "Invalid x-upload-key." }, { status: 401 });
  }

  let metrics: unknown;
  let sections: { hasCollections?: boolean; hasDelinquency?: boolean; hasOccupancy?: boolean; hasLeasing?: boolean } = {};

  try {
    const body = await req.json() as { metrics?: unknown; sections?: typeof sections };
    metrics  = body.metrics;
    sections = body.sections ?? {};
    if (!metrics || typeof metrics !== "object") {
      return NextResponse.json({ error: "Body must be { metrics: {...} }" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    // ── Load existing blob ──────────────────────────────────────────────────────
    let existing: Record<string, unknown> = {};
    try {
      const { blobs } = await list({ prefix: "towne-east/latest/" });
      const blob = blobs.find((b) => b.pathname === METRICS_PATH);
      if (blob) {
        const res = await fetch(blob.url, {
          headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
          cache: "no-store",
        });
        if (res.ok) {
          const prev = await res.json() as { metrics?: Record<string, unknown> };
          existing = prev.metrics ?? {};
        }
      }
    } catch { /* no existing blob — start fresh */ }

    const incoming = metrics as Record<string, unknown>;

    // ── Month-rollover detection ────────────────────────────────────────────────
    // If the report's month changed (e.g. April → May), wipe the blob so stale
    // April numbers don't bleed into May. A fresh month always starts from scratch.
    const existingMonth = yearMonth(existing.asOf);
    const incomingMonth = yearMonth(incoming.asOf);
    const newMonth = existingMonth !== null && incomingMonth !== null && existingMonth !== incomingMonth;

    if (newMonth) {
      console.log(`[towne-east/metrics] Month rollover ${existingMonth} → ${incomingMonth}: starting fresh`);
    }

    // Start from existing data, or empty if month rolled over
    const merged: Record<string, unknown> = newMonth ? {} : { ...existing };

    // ── Field sets for merge logic ──────────────────────────────────────────────
    // Always write — these are timestamps/reference points, not financial values
    const ALWAYS_WRITE = new Set(["asOf", "uploadedAt"]);

    // Collection fields: only write when the agent had the Transaction Summary.
    // If hasCollections=false (rent-roll-only run), a 0 means "not in this email"
    // — skip it so the previous good value is preserved.
    const COLLECTION_FIELDS = new Set(["totalCharged", "totalCollected", "collectionRatePct"]);

    // Delinquency fields: same logic — only write when agent had the delinquency report.
    const DELINQUENCY_FIELDS = new Set([
      "delinquentBalance", "priorPeriodBalance", "newDelinquencyThisPeriod",
      "delinquentCount", "topDelinquents",
    ]);

    // ── Merge loop ──────────────────────────────────────────────────────────────
    for (const [k, v] of Object.entries(incoming)) {
      if (v === null || v === undefined) continue;

      // Timestamps: always write
      if (ALWAYS_WRITE.has(k)) { merged[k] = v; continue; }

      // Collection fields: write only if we had the source report, OR the value is non-zero
      if (COLLECTION_FIELDS.has(k)) {
        const isZero = (typeof v === "number" && v === 0) || (Array.isArray(v) && v.length === 0);
        if (isZero && !sections.hasCollections) continue; // skip — not in this email
        merged[k] = v;
        continue;
      }

      // Delinquency fields: write only if we had the source report, OR the value is non-zero
      if (DELINQUENCY_FIELDS.has(k)) {
        const isZero = (typeof v === "number" && v === 0) || (Array.isArray(v) && v.length === 0);
        if (isZero && !sections.hasDelinquency) continue; // skip — not in this email
        merged[k] = v;
        continue;
      }

      // Occupancy / leasing fields: skip zeros so rent-roll data survives across partial runs
      if (typeof v === "number" && v === 0 && typeof existing[k] === "number" && (existing[k] as number) !== 0) continue;
      if (Array.isArray(v) && v.length === 0 && Array.isArray(existing[k]) && (existing[k] as unknown[]).length > 0) continue;

      // leaseExpirationByMonth: don't overwrite real data with an all-zero array
      if (k === "leaseExpirationByMonth" && Array.isArray(v) && Array.isArray(existing[k])) {
        const incomingHasData = (v as {expiring?: number}[]).some((e) => (e.expiring ?? 0) > 0);
        const existingHasData  = (existing[k] as {expiring?: number}[]).some((e) => (e.expiring ?? 0) > 0);
        if (!incomingHasData && existingHasData) continue;
      }

      merged[k] = v;
    }

    const uploadedAt = new Date().toISOString();
    const payload    = JSON.stringify({ uploadedAt, metrics: merged });
    await putAdaptive(METRICS_PATH, Buffer.from(payload), "application/json");
    return NextResponse.json({ uploadedAt, source: "mmr-pdf", newMonth });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Blob write failed." },
      { status: 500 }
    );
  }
}
