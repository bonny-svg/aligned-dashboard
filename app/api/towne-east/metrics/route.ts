// Accepts pre-computed TowneEastMetrics JSON from the email agent's MMR/PDF fast-path.
// Writes directly to towne-east/latest/metrics.json so the dashboard can read it
// without needing the three OneSite XLS files.
//
// POST: application/json { metrics: TowneEastMetrics }
// Protected by x-upload-key (same env var as the snapshot endpoint)

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
  try {
    const body = await req.json() as { metrics?: unknown };
    metrics = body.metrics;
    if (!metrics || typeof metrics !== "object") {
      return NextResponse.json({ error: "Body must be { metrics: {...} }" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    // Merge with existing metrics so an MMR-only run doesn't zero out
    // occupancy/leasing data that was set by a full OneSite XLS run.
    // Fields are only overwritten when the incoming value is non-zero / non-empty.
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

    // Fields that come from the weekly financial reports (Transaction Summary,
    // Delinquency). These are always authoritative — never preserve a stale value
    // from a prior month. If the agent didn't have the report this run, 0 is correct.
    const ALWAYS_OVERWRITE = new Set([
      "totalCharged", "totalCollected", "collectionRatePct",
      "delinquentBalance", "priorPeriodBalance", "newDelinquencyThisPeriod", "delinquentCount",
      "topDelinquents", "asOf", "uploadedAt",
    ]);

    // Fields from the rent roll that benefit from merge (not in every email).
    // Only preserve these from existing if the incoming value is zero/empty.
    const merged: Record<string, unknown> = { ...existing };
    for (const [k, v] of Object.entries(incoming)) {
      if (v === null || v === undefined) continue;
      // Financial/delinquency fields: always write, even if 0
      if (ALWAYS_OVERWRITE.has(k)) { merged[k] = v; continue; }
      // Occupancy/leasing fields: skip zeros to preserve rent-roll data across emails
      if (typeof v === "number" && v === 0 && typeof existing[k] === "number" && (existing[k] as number) !== 0) continue;
      if (Array.isArray(v) && v.length === 0 && Array.isArray(existing[k]) && (existing[k] as unknown[]).length > 0) continue;
      // leaseExpirationByMonth: don't overwrite good data with all-zero rows
      if (k === "leaseExpirationByMonth" && Array.isArray(v) && Array.isArray(existing[k])) {
        const incomingHasData = (v as {expiring?: number}[]).some((e) => (e.expiring ?? 0) > 0);
        const existingHasData = (existing[k] as {expiring?: number}[]).some((e) => (e.expiring ?? 0) > 0);
        if (!incomingHasData && existingHasData) continue;
      }
      merged[k] = v;
    }

    const uploadedAt = new Date().toISOString();
    const payload    = JSON.stringify({ uploadedAt, metrics: merged });
    await putAdaptive(METRICS_PATH, Buffer.from(payload), "application/json");
    return NextResponse.json({ uploadedAt, source: "mmr-pdf" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Blob write failed." },
      { status: 500 }
    );
  }
}
