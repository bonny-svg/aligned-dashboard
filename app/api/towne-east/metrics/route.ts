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
    const merged: Record<string, unknown> = { ...existing };
    for (const [k, v] of Object.entries(incoming)) {
      // Keep incoming value if it's a non-zero number, non-empty array, or non-empty string.
      // Fall back to existing value if incoming is 0 / null / undefined / empty array.
      if (v === null || v === undefined) continue;
      if (typeof v === "number" && v === 0 && typeof existing[k] === "number" && (existing[k] as number) !== 0) continue;
      if (Array.isArray(v) && v.length === 0 && Array.isArray(existing[k]) && (existing[k] as unknown[]).length > 0) continue;
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
